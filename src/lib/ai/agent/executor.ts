import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiConfig } from '@/lib/ai/types';
import type { ConversationMemory, ConversationState, AdReferralData } from '@/types/commerce';
import type { Product } from '@/types/watch';
import { AI_COMMERCE_TOOLS, type ToolContext } from './tools';
import { extractCustomerEntities, computeMissingOrderFields } from './extractor';
import { matchProductFromInbound } from './ad-matcher';
import { calculateCustomerRisk } from './risk-engine';
import { engineSendText, loadAccountMetaCredentials } from '@/lib/flows/meta-send';
import { sendHumanLikeMessages } from '@/lib/ai/human-simulation';
import { logAiUsage } from '@/lib/ai/usage';
import { buildBanglaSalesPrompt } from './sales-prompt';
import { runLlmAgentWithTools } from './llm-runner';
import { buildConversationContext } from '@/lib/ai/context';
import { matchFastStoreFaq } from './fast-faq';

export interface ExecuteAgentArgs {
  db: SupabaseClient;
  accountId: string;
  conversationId: string;
  contactId: string;
  configOwnerUserId: string;
  inboundText: string;
  referral?: AdReferralData | null;
  config: AiConfig;
}

export interface AgentExecutionResult {
  handled: boolean;
  replyText?: string;
  nextState?: ConversationState;
  handedOff?: boolean;
}

export async function executeAiCommerceAgent(args: ExecuteAgentArgs): Promise<AgentExecutionResult> {
  const { db, accountId, conversationId, contactId, configOwnerUserId, inboundText, referral, config } = args;

  // 1. Load Conversation State and Memory
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('id, ai_state, ai_memory, ai_autoreply_disabled, assigned_agent_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr || !conv) return { handled: false };
  if (conv.ai_autoreply_disabled || conv.assigned_agent_id) {
    return { handled: false }; // Human agent owns this conversation
  }

  const currentState: ConversationState = (conv.ai_state as ConversationState) || 'NEW';
  let memory: ConversationMemory = (conv.ai_memory as ConversationMemory) || {};

  // Store referral if present
  if (referral) {
    memory.referral = referral;
  }

  const toolCtx: ToolContext = {
    db,
    accountId,
    conversationId,
    contactId,
    configOwnerUserId,
    memory,
    currentState,
  };

  // Helper to log audit entries
  const logAudit = async (toolName: string, input: any, output: any, status: 'success' | 'failure' | 'requires_approval' = 'success', err?: string) => {
    try {
      await db.from('ai_audit_log').insert({
        account_id: accountId,
        conversation_id: conversationId,
        contact_id: contactId,
        tool_name: toolName,
        input,
        output,
        status,
        error_message: err || null,
      });
    } catch (e) {
      console.warn('[ai-audit] log failed:', e);
    }
  };

  // Helper to update state and memory
  const transition = async (nextState: ConversationState, memUpdates: Partial<ConversationMemory> = {}) => {
    memory = { ...memory, ...memUpdates };
    await db
      .from('conversations')
      .update({
        ai_state: nextState,
        ai_memory: memory,
      })
      .eq('id', conversationId);
  };

  // Helper to reply to customer with natural typing delay and multi-bubble splitting
  const reply = async (text: string) => {
    let phoneId: string | undefined;
    let token: string | undefined;
    try {
      const credentials = await loadAccountMetaCredentials(db, accountId);
      phoneId = credentials?.phoneNumberId;
      token = credentials?.accessToken;
    } catch {
      // Credentials lookup is best-effort
    }

    await sendHumanLikeMessages({
      accountId,
      userId: configOwnerUserId,
      conversationId,
      contactId,
      text,
      phoneNumberId: phoneId,
      accessToken: token,
    });
  };

  // Extract entities from inbound message
  const extracted = extractCustomerEntities(inboundText, memory);

  // Auto-cancel any pending scheduled follow-ups since customer has messaged
  await AI_COMMERCE_TOOLS.cancel_followup.handler({}, toolCtx);

  // If customer provided a TrxID for advance payment
  if (extracted.trxId) {
    memory.last_customer_intent = 'ADVANCE_PAYMENT';
    await logAudit('detect_advance_payment', { trxId: extracted.trxId, method: extracted.paymentMethod }, { success: true });
    try {
      const payRes: any = await AI_COMMERCE_TOOLS.record_advance_payment.handler(
        {
          trxId: extracted.trxId,
          amount: 150, // standard advance delivery fee
          method: extracted.paymentMethod || 'bKash',
          phone: memory.customer_phone || undefined,
          orderId: memory.order_id || undefined,
        },
        toolCtx
      );
      if (payRes?.success) {
        await reply(payRes.message || 'আপনার অগ্রিম পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে! ধন্যবাদ 😊');
        return { handled: true };
      }
    } catch (e) {
      console.warn('[executor] Advance payment auto-record warning:', e);
    }
  }

  // ----------------------------------------------------
  // Scenario A: Customer explicitly requests human or complains
  // ----------------------------------------------------
  if (extracted.detectedIntent === 'HUMAN_AGENT_REQUEST') {
    await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'HUMAN_HANDOFF' }, toolCtx);
    await AI_COMMERCE_TOOLS.handoff_to_human.handler(
      {
        reason: 'Customer requested human agent',
        summary: `Customer asked to talk to a human agent. Last message: "${inboundText}"`,
      },
      toolCtx
    );
    await logAudit('handoff_to_human', { reason: 'Customer requested human' }, { success: true });
    await reply('আমাদের একজন কাস্টমার প্রতিনিধি আপনার সাথে শীঘ্রই যুক্ত হচ্ছেন। অনুগ্রহ করে একটু অপেক্ষা করুন। 😊');
    return { handled: true, handedOff: true };
  }

  // ----------------------------------------------------
  // Scenario B: Customer indicates they won't buy now ("এখন নেব না", "পরে নেব", "এখন না")
  // Stop all follow-ups immediately and permanently for this conversation
  // ----------------------------------------------------
  if (extracted.detectedIntent === 'FUTURE_PURCHASE') {
    await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'FUTURE_PURCHASE' }, toolCtx);
    await AI_COMMERCE_TOOLS.cancel_followup.handler({}, toolCtx);

    await db
      .from('conversations')
      .update({
        ai_state: 'FUTURE_PURCHASE',
        ai_followup_count: 99, // Permanently disables all future follow-up sequences
        ai_memory: { ...memory, last_customer_intent: 'FUTURE_PURCHASE', followups_disabled: true },
      })
      .eq('id', conversationId);

    await logAudit('cancel_all_followups', { reason: 'Customer declined/stated not buying now' }, { success: true });
    await reply('কোন ব্যাপার না আমাদের সাথে থাকার জন্য ধন্যবাদ 🥰 পরবর্তীতে যেকোনো সময় আপনার প্রয়োজন হলে আমাদের জানাবেন। ভালো থাকবেন!');
    return { handled: true, nextState: 'FOLLOW_UP_SCHEDULED' };
  }

  // ----------------------------------------------------
  // Scenario B1: Customer inquires about Order Status / Delivery Tracking
  // ----------------------------------------------------
  const isAskingAboutExistingOrder =
    extracted.detectedIntent === 'ORDER_STATUS_INQUIRY' ||
    Boolean(extracted.invoiceNo) ||
    ((memory.order_id || currentState === 'ORDER_CREATED') &&
      /কবে পাব|কতদিন|কত দিন|সময় লাগ|ডেলিভারি কবে|কখন পাব|ট্র্যাকিং|কোথায়|kobe pabo|status|order/i.test(inboundText));

  if (isAskingAboutExistingOrder) {
    const statusRes = (await AI_COMMERCE_TOOLS.get_order_status.handler(
      {
        orderId: extracted.invoiceNo || memory.order_id,
        phone: extracted.phone || memory.customer_phone,
      },
      toolCtx
    )) as any;

    if (statusRes?.replyText) {
      await reply(statusRes.replyText);
      await logAudit('check_order_status', { text: inboundText, invoiceNo: extracted.invoiceNo }, statusRes);
      return { handled: true };
    }
  }

  // ----------------------------------------------------
  // Scenario B2: Customer Complaint, Damaged Watch, or Return / Exchange Request
  // ----------------------------------------------------
  if (extracted.detectedIntent === 'RETURN_OR_COMPLAINT') {
    const complaintRes = (await AI_COMMERCE_TOOLS.handle_order_complaint.handler(
      {
        issueType: /(কালার|রং|color|exchange|চেঞ্জ|বদল)/i.test(inboundText) ? 'color_exchange' : 'damaged_product',
        description: inboundText,
      },
      toolCtx
    )) as any;

    if (complaintRes?.replyText) {
      await reply(complaintRes.replyText);
      await logAudit('handle_order_complaint', { text: inboundText }, complaintRes);
      return { handled: true };
    }
  }

  // ----------------------------------------------------
  // Scenario B3: Customer asks for Catalog or other watch recommendations
  // ----------------------------------------------------
  if (extracted.detectedIntent === 'RECOMMENDATION_INQUIRY') {
    const recRes = (await AI_COMMERCE_TOOLS.recommend_products.handler({}, toolCtx)) as any;
    if (recRes?.success && recRes.products?.length > 0) {
      let recText = `জি ভাইয়া! আমাদের কাছে আরও কিছু চমৎকার প্রিমিয়াম ঘড়ি রয়েছে:\n\n`;
      recRes.products.forEach((p: any, idx: number) => {
        recText += `${idx + 1}. *${p.name}* — মাত্র ৳${p.price.toLocaleString('en-BD')}\n   (কালার: ${p.colors}, বেল্ট: ${p.strap})\n\n`;
      });
      recText += `আপনি কি লেদার বেল্ট নাকি মেটাল চেইন ওয়াচ বেশি পছন্দ করেন? জানাবেন, আপনার পছন্দের সেরা ঘড়িটি দেখিয়ে দিচ্ছি! 😊`;
      await reply(recText);
      await logAudit('recommend_products', { text: inboundText }, recRes);
      return { handled: true };
    }
  }

  // ----------------------------------------------------
  // Ultra-Fast Store FAQ / Immediate Intent Match (< 5ms response, 0 OpenAI cost)
  // Intercepts repetitive FAQs (warranty, delivery fees, battery, open-box checking)
  // before running heavy LLMs or RAG loops.
  // ----------------------------------------------------
  if (!extracted.phone && !extracted.fullAddress) {
    const fastFaq = matchFastStoreFaq(inboundText, 'Watch Gallery BD');
    if (fastFaq.matched && fastFaq.replyText) {
      await reply(fastFaq.replyText);
      await logAudit('fast_faq_match', { text: inboundText, intent: fastFaq.intent }, { success: true });
      return { handled: true };
    }
  }

  // ----------------------------------------------------
  // Scenario C: Facebook Ad Entry / Initial Inquiry
  // ----------------------------------------------------
  const isInitialEntry =
    currentState === 'NEW' ||
    currentState === 'PRODUCT_IDENTIFICATION' ||
    !memory.interested_product_id;

  if (isInitialEntry) {
    const match = await matchProductFromInbound(db, accountId, inboundText, referral);
    if (match.matched && match.product) {
      await transition('PRODUCT_INFORMATION_SENT', {
        interested_product_id: match.product.id,
        interested_product_name: match.product.name,
      });

      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'PRODUCT_INQUIRY' }, toolCtx);

      // Send variant photos if available
      if (match.colorImages.length > 0) {
        await AI_COMMERCE_TOOLS.send_product_images.handler(
          {
            productId: match.product.id,
            images: match.colorImages,
          },
          toolCtx
        );
      }

      // Send super offer pitch
      if (match.initialPitchText) {
        await reply(match.initialPitchText);
      }

      // Schedule automated follow-up in 60 minutes if customer leaves it unreplied
      await AI_COMMERCE_TOOLS.schedule_followup.handler(
        {
          minutesDelay: 60,
          productId: match.product.id,
          prompt: 'Customer viewed initial offer. Ask if they prefer Black or Silver color.',
        },
        toolCtx
      );

      await logAudit('match_product_and_send_offer', { text: inboundText }, { productId: match.product.id });
      return { handled: true, nextState: 'PRODUCT_INFORMATION_SENT' };
    }
  }

  // Retrieve current product context from memory
  let currentProduct: Product | null = null;
  if (memory.interested_product_id) {
    const { data: p } = await db
      .from('products')
      .select('*')
      .eq('id', memory.interested_product_id)
      .maybeSingle();
    currentProduct = p as Product | null;
  }

  // ----------------------------------------------------
  // Scenario D: Purchase Intent or Collecting Order Information
  // ----------------------------------------------------
  const hasPurchaseIntent =
    extracted.detectedIntent === 'PURCHASE_INTENT' ||
    currentState === 'PURCHASE_INTENT' ||
    currentState === 'COLLECTING_ORDER_INFORMATION' ||
    currentState === 'VALIDATING_ORDER_INFORMATION';

  // Merge any extracted fields into memory
  const memoryUpdates: Partial<ConversationMemory> = {};
  if (extracted.name && !memory.customer_name) memoryUpdates.customer_name = extracted.name;
  if (extracted.phone && !memory.customer_phone) memoryUpdates.customer_phone = extracted.phone;
  if (extracted.fullAddress) memoryUpdates.full_address = extracted.fullAddress;
  if (extracted.thana) memoryUpdates.thana = extracted.thana;
  if (extracted.district) memoryUpdates.district = extracted.district;
  if (extracted.variant) memoryUpdates.selected_variant = extracted.variant;
  if (extracted.quantity) memoryUpdates.quantity = extracted.quantity;

  if (Object.keys(memoryUpdates).length > 0) {
    memory = { ...memory, ...memoryUpdates };
  }

  // ----------------------------------------------------
  // Primary Brain: LLM Agent with Autonomous Tool-Calling
  // ----------------------------------------------------
  if (config?.apiKey) {
    try {
      // 1. Fetch active products for prompt catalog
      const { data: activeProducts } = await db
        .from('products')
        .select('*')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8);

      // 2. Fetch shipping banner if any
      const { data: deliverySettings } = await db
        .from('delivery_settings')
        .select('free_delivery_banner_text')
        .eq('account_id', accountId)
        .maybeSingle();

      // 3. Load conversation turns for context
      const history = await buildConversationContext(db, conversationId, 14);
      if (history.length === 0 || history[history.length - 1].content !== inboundText) {
        history.push({ role: 'user', content: inboundText });
      }

      // 4. Construct high-converting Bengali sales agent persona prompt
      const systemPrompt = buildBanglaSalesPrompt({
        storeName: 'Watch Gallery BD',
        customerName: memory.customer_name || null,
        customerPhone: memory.customer_phone || null,
        isReturningCustomer: Boolean(memory.order_id),
        activeProducts: activeProducts || [],
        currentProduct,
        currentState,
        memory,
        deliveryBanner: deliverySettings?.free_delivery_banner_text || null,
        customSystemPrompt: config.systemPrompt || null,
      });

      // 5. Execute LLM with full tools loop
      const llmResult = await runLlmAgentWithTools({
        config,
        systemPrompt,
        messages: history,
        tools: AI_COMMERCE_TOOLS,
        toolContext: toolCtx,
        maxTurns: 5,
      });

      if (llmResult.text && llmResult.text.trim()) {
        await reply(llmResult.text.trim());

        if (llmResult.usage) {
          void logAiUsage(db, {
            accountId,
            conversationId,
            mode: 'auto_reply',
            provider: config.provider,
            model: config.model,
            usage: llmResult.usage,
          });
        }

        const wasHandedOff = llmResult.toolsExecuted.includes('handoff_to_human');
        return {
          handled: true,
          replyText: llmResult.text,
          nextState: memory.order_id ? 'ORDER_CREATED' : currentState,
          handedOff: wasHandedOff,
        };
      }
    } catch (llmErr) {
      console.warn('[executor] LLM tool loop warning (falling back to rule engine):', llmErr);
    }
  }

  if (hasPurchaseIntent || extracted.phone || extracted.fullAddress) {
    await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'PURCHASE_INTENT' }, toolCtx);

    // Compute missing fields
    const { collected, missing, promptForMissing } = computeMissingOrderFields(memory);
    memory.collected_fields = collected;
    memory.missing_fields = missing;

    // If any critical information is missing, ask only for missing details
    if (missing.length > 0) {
      await transition('COLLECTING_ORDER_INFORMATION', memory);
      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'ORDER_INFORMATION_PENDING' }, toolCtx);

      if (promptForMissing) {
        await reply(promptForMissing);
      }
      return { handled: true, nextState: 'COLLECTING_ORDER_INFORMATION' };
    }

    // ----------------------------------------------------
    // Scenario E: All Order Information Collected -> Risk Check & Order Creation
    // ----------------------------------------------------
    await transition('RISK_CHECK', memory);

    // Calculate customer risk
    const risk = await calculateCustomerRisk(db, accountId, memory.customer_phone!);
    memory.risk_result = risk;
    await logAudit('calculate_customer_risk', { phone: memory.customer_phone }, risk);

    // High Risk Decision: Pause and hand off to human agent
    if (risk.requiresHumanApproval) {
      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'HIGH_RISK_CUSTOMER' }, toolCtx);
      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'HUMAN_HANDOFF' }, toolCtx);

      const summary =
        `⚠️ HIGH RISK CUSTOMER DETECTED\n` +
        `Customer: ${memory.customer_name || 'N/A'}\n` +
        `Phone: ${memory.customer_phone}\n` +
        `Product: ${currentProduct?.name || memory.interested_product_name}\n` +
        `Color: ${memory.selected_variant || 'Default'}\n` +
        `Address: ${memory.full_address}\n` +
        `Reasons: ${risk.reasons.join('; ')}\n` +
        `Cancellation Rate: ${risk.cancellationRate}%\n` +
        `Steadfast Ratio: ${risk.steadfastDeliveryRatio ?? 'N/A'}%`;

      await AI_COMMERCE_TOOLS.handoff_to_human.handler(
        {
          reason: 'High cancellation/return risk requires manual human approval',
          summary,
        },
        toolCtx
      );

      await transition('WAITING_FOR_HUMAN_APPROVAL', memory);

      // Customer-facing message
      await reply('আপনার অর্ডারটি কনফার্ম করার আগে আমাদের একজন প্রতিনিধি আপনার সাথে কথা বলবেন। একটু অপেক্ষা করুন। 😊');
      return { handled: true, nextState: 'WAITING_FOR_HUMAN_APPROVAL', handedOff: true };
    }

    // Low / Medium Risk: Proceed to create order
    await transition('ORDER_CREATING', memory);

    const orderResult = (await AI_COMMERCE_TOOLS.create_order.handler(
      {
        customerName: memory.customer_name,
        customerPhone: memory.customer_phone,
        fullAddress: memory.full_address,
        thana: memory.thana,
        district: memory.district,
        productId: currentProduct?.id || memory.interested_product_id,
        variant: memory.selected_variant || 'Standard',
        quantity: memory.quantity || 1,
      },
      toolCtx
    )) as any;

    await logAudit('create_order', { phone: memory.customer_phone }, orderResult);

    if (orderResult.error) {
      if (orderResult.requiresHumanApproval) {
        await reply('আপনার অর্ডারটি পর্যালোচনা করার জন্য আমাদের প্রতিনিধি একটু পরেই যোগাযোগ করবেন। 😊');
        return { handled: true, handedOff: true };
      }
      await reply(`অর্ডার সৃষ্টিতে সমস্যা হয়েছে: ${orderResult.error}। অনুগ্রহ করে তথ্য পুনরায় চেক করুন।`);
      return { handled: true };
    }

    memory.order_id = orderResult.orderId;
    await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'ORDER_CREATED' }, toolCtx);
    await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'ORDER_CONFIRMED' }, toolCtx);

    // Book courier automatically if safe
    let courierInfo: any = null;
    try {
      const courierResult = (await AI_COMMERCE_TOOLS.book_courier.handler(
        { orderId: orderResult.orderId, preferredProvider: 'steadfast' },
        toolCtx
      )) as any;
      if (courierResult?.success) {
        courierInfo = courierResult;
        memory.courier_tracking = courierResult.trackingCode;
        memory.courier_consignment_id = courierResult.consignmentId;
        await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'COURIER_BOOKED' }, toolCtx);
        await logAudit('book_courier', { orderId: orderResult.orderId }, courierResult);
      }
    } catch (e) {
      console.warn('[executor] Courier booking auto-call error (will continue):', e);
    }

    await transition('ORDER_CREATED', memory);

    // Send professional WhatsApp order confirmation card with digital invoice
    const trackingMsg = courierInfo?.trackingCode
      ? `\n🚚 কুরিয়ার ট্র্যাকিং কোড: *${courierInfo.trackingCode}*`
      : '';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://watchgallerybd.com';
    const invoiceUrl = orderResult.invoiceNo ? `\n🧾 ডিজিটাল ক্যাশ মেমো: ${siteUrl}/invoice/${orderResult.invoiceNo}` : '';

    const confirmMsg =
      `✅ *আপনার অর্ডারটি কনফার্ম করা হয়েছে আশা করি দ্রুত সমায় এর মধ্যে পেয়ে যাবেন আমাদের সাথে থাকার জন্য ধন্যবাদ।*\n\n` +
      `📦 প্রোডাক্ট: *${orderResult.productName}*\n` +
      `🎨 কালার: *${orderResult.variant || 'Standard'}*\n` +
      `🔢 পরিমাণ: *${orderResult.quantity}টি*\n` +
      `💰 সর্বমোট মূল্য: *৳${orderResult.totalAmount.toLocaleString('en-BD')}* (ক্যাশ অন ডেলিভারি)\n` +
      `📍 ডেলিভারি ঠিকানা: ${orderResult.customerName}, ${memory.full_address}\n` +
      `🚚 ডেলিভারি সময়: ঢাকার ভিতরে ২৪ থেকে ৪৮ ঘন্টা, ঢাকার বাহিরে ৪৮ থেকে ৭২ ঘন্টা।\n` +
      `${trackingMsg}${invoiceUrl}\n\n` +
      `পার্সেল রিসিভ করার আগে ঘড়িটি চেক করে নেওয়ার সুযোগ রয়েছে। ধন্যবাদ আমাদের সাথে থাকার জন্য! 😊`;

    await reply(confirmMsg);
    return { handled: true, nextState: 'ORDER_CREATED' };
  }

  // ----------------------------------------------------
  // Scenario F: Product Questions (Waterproof, Battery, Material, Warranty, Delivery)
  // ----------------------------------------------------
  if (currentProduct) {
    const q = inboundText.toLowerCase();

    if (/waterproof|পানি লাগলে|water resistant|পানি নিরোধক/i.test(q)) {
      await reply('Water resistant (ওয়াটার রেজিস্ট্যান্ট) মানে হলো এমন ঘড়ি যা কিছুটা পানি প্রতিরোধ করতে পারে, তবে পুরোপুরি পানি নিরোধক বা waterproof নয়।');
      return { handled: true };
    }

    if (/warranty|ওয়ারেন্টি|গ্যারান্টি|কতদিন|মেশিন|কালার/i.test(q)) {
      await reply('এক বছরে মেশিন এবং কালারের ওয়ারেন্টি থাকবে (তবে আমাদের ঘড়িগুলো নরমালে দুই তিন বছরে কিছু হয় না ) 😊');
      return { handled: true };
    }

    if (/delivery|ডেলিভারি|কবে পাব|কতদিন|সময় লাগ/i.test(q)) {
      await reply('আমাদের ডেলিভারি সাধারণত ঢাকার ভিতরে ২৪ থেকে ৪৮ ঘন্টা ঢাকার বাহিরে ৪৮ থেকে ৭২ ঘন্টা মতো সময় লাগতে পারে।');
      return { handled: true };
    }

    if (/battery|ব্যাটারি|ব্যাটারী/i.test(q)) {
      await reply(`ঘড়িটিতে হাই কোয়ালিটি লং লাস্টিং ব্যাটারি দেওয়া আছে এবং আমরা ফ্রি গিফট হিসেবে ১টি অতিরিক্ত ব্যাটারি দিচ্ছি! 🎁`);
      return { handled: true };
    }

    if (/strap|চেইন|বেল্ট|material/i.test(q)) {
      const strap = currentProduct.strap_type || 'Genuine Leather';
      await reply(`এটির স্ট্র্যাপ ম্যাটেরিয়াল হলো প্রিমিয়াম ${strap}। পড়তে অত্যন্ত আরামদায়ক ও টেকসই।`);
      return { handled: true };
    }

    if (/dial|সাইজ|size/i.test(q)) {
      const dial = currentProduct.dial_size || '42mm';
      await reply(`ঘড়িটির ডায়াল সাইজ হলো ${dial}। পুরুষদের হাতে খুব সুন্দর মানানসই প্রিমিয়াম লুক দেয়। ✨`);
      return { handled: true };
    }

    if (/color|কালার|রং/i.test(q)) {
      const colors = currentProduct.colors?.join(', ') || 'Black, Silver';
      await reply(`এই মডেলটি বর্তমানে *${colors}* কালারে available আছে। আপনি কোনটি নিতে চান? 😊`);
      return { handled: true };
    }
  }

  // Default fallback if unhandled
  return { handled: false };
}
