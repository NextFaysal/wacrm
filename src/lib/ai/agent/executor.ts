import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiConfig } from '@/lib/ai/types';
import type { ConversationMemory, ConversationState, AdReferralData, RiskCheckResult } from '@/types/commerce';
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
import { loadBusinessContext } from '../business-context';
import { getHumanGreeting, getHumanObjectionResponse } from '../human-personality';
import { loadAiPersonaConfig, buildPersonaSystemPromptAddition } from '@/lib/ai/persona-config';
import { syncMemoryToContact } from './memory-sync';

export interface ExecuteAgentArgs {
  db: SupabaseClient;
  accountId: string;
  conversationId: string;
  contactId: string;
  configOwnerUserId: string;
  inboundText: string;
  inboundMessageId?: string;
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

  // 1. Load Conversation State, Memory, Business Context, and AI Action Settings
  const [convRes, bizCtx, actionSettingsRes, customActionsRes, personaConfig] = await Promise.all([
    db
      .from('conversations')
      .select('id, ai_state, ai_memory, ai_autoreply_disabled, assigned_agent_id')
      .eq('id', conversationId)
      .maybeSingle(),
    loadBusinessContext(accountId, db),
    db.from('ai_action_settings').select('*').eq('account_id', accountId).maybeSingle(),
    db.from('ai_custom_actions').select('*').eq('account_id', accountId).eq('is_active', true),
    loadAiPersonaConfig(db, accountId),
  ]);

  const conv = convRes.data;
  const convErr = convRes.error;

  if (convErr || !conv) return { handled: false };
  if (conv.ai_autoreply_disabled || conv.assigned_agent_id) {
    return { handled: false }; // Human agent owns this conversation
  }

  const actionSettings = actionSettingsRes.data || {
    auto_order_creation: true,
    auto_courier_booking: false,
    risk_engine: true,
    auto_followup: true,
    send_product_images: true,
    voice_notes: true,
  };
  const customActions = customActionsRes.data || [];

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

    // Sync persistent memory to customer contact profile
    void syncMemoryToContact(db, contactId, memory, accountId);
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
      inboundMessageId: args.inboundMessageId,
    });
  };

  // Strip voice note envelope prefix if present so entity extraction and matching work cleanly
  const effectiveInboundText = inboundText.replace(/^🎙️\s*\[ভয়েস\s*নোট\]:\s*/i, '').trim() || inboundText;

  // Extract entities from inbound message
  const extracted = extractCustomerEntities(effectiveInboundText, memory);

  // Auto-cancel any pending scheduled follow-ups since customer has messaged
  await AI_COMMERCE_TOOLS.cancel_followup.handler({}, toolCtx);

  // If customer provided a TrxID for advance payment
  if (extracted.trxId) {
    memory.last_customer_intent = 'ADVANCE_PAYMENT';
    await logAudit('detect_advance_payment', { trxId: extracted.trxId, method: extracted.paymentMethod, amount: extracted.paymentAmount }, { success: true });
    try {
      const payRes: any = await AI_COMMERCE_TOOLS.record_advance_payment.handler(
        {
          trxId: extracted.trxId,
          amount: extracted.paymentAmount || bizCtx.advanceDeliveryFee || 150,
          method: extracted.paymentMethod || 'bKash',
          phone: memory.customer_phone || undefined,
          orderId: memory.order_id || undefined,
        },
        toolCtx
      );
      if (payRes?.success) {
        await reply(payRes.message || 'আপনার অগ্রিম পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে! ধন্যবাদ 😊');
        return { handled: true };
      } else if (payRes?.error) {
        await reply(payRes.error);
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
  // Scenario B3: Customer asks for Catalog or other recommendations
  // ----------------------------------------------------
  if (extracted.detectedIntent === 'RECOMMENDATION_INQUIRY') {
    const recRes = (await AI_COMMERCE_TOOLS.recommend_products.handler({}, toolCtx)) as any;
    if (recRes?.success && recRes.products?.length > 0) {
      let recText = `জি! আমাদের কাছে আরও কিছু চমৎকার প্রিমিয়াম ${bizCtx.productNoun} রয়েছে:\n\n`;
      recRes.products.forEach((p: any, idx: number) => {
        const variantText = p.colors ? ` (ভেরিয়েন্ট: ${p.colors})` : '';
        recText += `${idx + 1}. *${p.name}* — মাত্র ৳${p.price.toLocaleString('en-BD')}${variantText}\n`;
      });
      recText += `\nআপনার পছন্দের প্রোডাক্টটি জানালে বিস্তারিত ও অফার প্রাইজ জানিয়ে দিচ্ছি! 😊`;
      await reply(recText);
      await logAudit('recommend_products', { text: inboundText }, recRes);
      return { handled: true };
    }
  }

  // ----------------------------------------------------
  // Scenario B3.5: Customer asks for Product Photos / Colors / Real Pictures
  // ----------------------------------------------------
  const isImageRequest =
    extracted.detectedIntent === 'IMAGE_REQUEST' ||
    /(ছবি|ফটো|পিক|পিকচার|photo|image|pic|picture|chobi|বাস্তব ছবি|আসল ছবি|রিয়েল ছবি|কালার দেখতে চাই|কালারের ছবি|রং দেখতে চাই|কালারগুলো দেখান|কালার দেখান|color dekhaw|pic den|photo den|chobi den|chobi pathan|image pathan|pic pathan)/i.test(effectiveInboundText);

  if (isImageRequest && actionSettings.send_product_images) {
    let targetProductId = memory.interested_product_id;
    let targetProductName = memory.interested_product_name;

    if (!targetProductId) {
      // Find matching product by text or fallback to active product
      const match = await matchProductFromInbound(db, accountId, effectiveInboundText, referral, bizCtx);
      if (match.matched && match.product) {
        targetProductId = match.product.id;
        targetProductName = match.product.name;
      }
    }

    if (!targetProductId) {
      const { data: firstProd } = await db
        .from('products')
        .select('id, name')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (firstProd) {
        targetProductId = firstProd.id;
        targetProductName = firstProd.name;
      }
    }

    if (targetProductId) {
      await transition('PRODUCT_INFORMATION_SENT', {
        interested_product_id: targetProductId,
        interested_product_name: targetProductName || undefined,
      });

      const imgRes = (await AI_COMMERCE_TOOLS.send_product_images.handler(
        {
          productId: targetProductId,
          color: extracted.variant || undefined,
        },
        toolCtx
      )) as any;

      const colorMention = extracted.variant ? ` (${extracted.variant} কালার)` : '';
      const prodName = targetProductName || bizCtx.productNoun;
      let photoConfirmMsg = '';

      if (imgRes?.success) {
        photoConfirmMsg = `জি ভাইয়া/আপু! আমি ${prodName}${colorMention}-এর ছবি হোয়াটসঅ্যাপে পাঠিয়ে দিয়েছি 📸✨\n\nছবি দেখে জানান কেমন লাগলো, আর কোনো কিছু জানার থাকলে বা অর্ডার করতে চাইলে অবশ্যই বলবেন! 😊`;
      } else {
        photoConfirmMsg = `জি ভাইয়া/আপু, ${prodName}${colorMention}-এর ছবি দ্রুতই পাঠিয়ে দিচ্ছি। আপনার কি নির্দিষ্ট কোনো কালার বা ভ্যারিয়েন্ট পছন্দ আছে? 😊`;
      }

      await reply(photoConfirmMsg);
      await logAudit('send_product_images_request', { text: inboundText, variant: extracted.variant }, imgRes);
      return { handled: true, nextState: 'PRODUCT_INFORMATION_SENT' };
    }
  }

  // ----------------------------------------------------
  // Ultra-Fast Store FAQ / Immediate Intent Match (< 5ms response, 0 OpenAI cost)
  // Intercepts repetitive FAQs (warranty, delivery fees, battery, open-box checking)
  // before running heavy LLMs or RAG loops.
  // ----------------------------------------------------
  if (!extracted.phone && !extracted.fullAddress) {
    const fastFaq = matchFastStoreFaq(effectiveInboundText, bizCtx);
    if (fastFaq.matched && fastFaq.replyText) {
      await reply(fastFaq.replyText);
      await logAudit('fast_faq_match', { text: inboundText, intent: fastFaq.intent }, { success: true });
      return { handled: true };
    }
  }

  // ----------------------------------------------------
  // Scenario B4: Standalone Greeting (Hi, Hello, Salam)
  // ----------------------------------------------------
  if (/^(hi|hello|hey|salam|assalamu\s*alaikum|assalamualaikum|হ্যাল+ও|হাই|সালাম|আসসালামু\s*আলাইকুম)[.!?\s]*$/i.test(effectiveInboundText.trim())) {
    const greeting = getHumanGreeting({
      customerName: memory.customer_name,
      isReturning: Boolean(memory.order_id),
    });
    await reply(greeting);
    return { handled: true };
  }

  // ----------------------------------------------------
  // Scenario B5: Shop Location / Showroom Inquiry
  // ----------------------------------------------------
  if (/দোকান কোথায়|শো-রুম|শোরুম|লোকেশন|ঠিকানা কোথায়|dokan kothay|location kothay|showroom|outlet/i.test(effectiveInboundText) && !extracted.phone && !extracted.fullAddress) {
    await reply(getHumanObjectionResponse('SHOP_LOCATION', bizCtx.storeName));
    return { handled: true };
  }

  // ----------------------------------------------------
  // Scenario B6: Bargaining / Discount Request
  // ----------------------------------------------------
  if (/কম রাখা যাবে|ডিসকাউন্ট হবে|কম হবে|বেশি দাম|দাম বেশি|একটু কমান|discount|dam kom|kom koren/i.test(effectiveInboundText)) {
    await reply(getHumanObjectionResponse('BARGAIN', bizCtx.storeName));
    return { handled: true };
  }

  // ----------------------------------------------------
  // Scenario C: Facebook Ad Entry / Initial Inquiry
  // ----------------------------------------------------
  const isInitialEntry =
    currentState === 'NEW' ||
    currentState === 'PRODUCT_IDENTIFICATION' ||
    !memory.interested_product_id;

  if (isInitialEntry) {
    const match = await matchProductFromInbound(db, accountId, effectiveInboundText, referral, bizCtx);
    if (match.matched && match.product) {
      await transition('PRODUCT_INFORMATION_SENT', {
        interested_product_id: match.product.id,
        interested_product_name: match.product.name,
      });

      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'PRODUCT_INQUIRY' }, toolCtx);

      // Send variant photos if available and enabled
      if (match.colorImages.length > 0 && actionSettings.send_product_images) {
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

      // Schedule automated follow-up in 60 minutes if enabled
      if (actionSettings.auto_followup) {
        await AI_COMMERCE_TOOLS.schedule_followup.handler(
          {
            minutesDelay: 60,
            productId: match.product.id,
            prompt: `Customer viewed initial offer for ${match.product.name}. Ask politely about preferred variant/size/color or if they need any details.`,
          },
          toolCtx
        );
      }

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

      // 4. Load account business name dynamically
      const { data: accountRow } = await db
        .from('accounts')
        .select('name')
        .eq('id', accountId)
        .maybeSingle();

      const storeName = accountRow?.name || 'আমাদের শপ';

      // 5. Construct high-converting Bengali sales agent persona prompt
      const systemPrompt = buildBanglaSalesPrompt({
        storeName: bizCtx.storeName || storeName,
        customerName: memory.customer_name || null,
        customerPhone: memory.customer_phone || null,
        isReturningCustomer: Boolean(memory.order_id),
        activeProducts: activeProducts || [],
        currentProduct,
        currentState,
        memory,
        deliveryBanner: deliverySettings?.free_delivery_banner_text || bizCtx.freeDeliveryBanner || null,
        customSystemPrompt: config.systemPrompt || null,
        context: bizCtx,
        personaPrompt: buildPersonaSystemPromptAddition(personaConfig),
      });

      // 5. Prepare dynamic tools with action toggles & custom tools
      const dynamicTools: any = { ...AI_COMMERCE_TOOLS };
      if (!actionSettings.send_product_images) {
        delete dynamicTools.send_product_images;
      }
      if (!actionSettings.auto_order_creation) {
        delete dynamicTools.create_order;
      }
      if (!actionSettings.auto_courier_booking) {
        delete dynamicTools.book_courier;
      }

      // Add custom user-defined actions
      for (const ca of customActions) {
        dynamicTools[ca.name] = {
          name: ca.name,
          description: ca.description,
          parameters: { type: 'object', properties: {} },
          handler: async (_callArgs: any, _ctx: any) => {
            if (ca.action_type === 'fixed_reply') {
              const msg = ca.config?.message || '';
              if (msg) await reply(msg);
              return { success: true, sent_message: msg };
            } else if (ca.action_type === 'instant_coupon') {
              const prefix = ca.config?.coupon_prefix || 'SPECIAL';
              const amount = Number(ca.config?.discount_amount) || 100;
              const code = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
              await db.from('coupons').insert({
                account_id: accountId,
                code,
                discount_type: 'fixed',
                discount_value: amount,
                min_order_amount: 0,
                usage_limit: 1,
                is_active: true,
              });
              const msg = ca.config?.message
                ? ca.config.message.replace('{CODE}', code)
                : `আপনার জন্য বিশেষ ছাড়ের কুপন কোড: ${code} (৳${amount} ছাড়)!`;
              await reply(msg);
              return { success: true, coupon_code: code, discount_amount: amount };
            } else if (ca.action_type === 'notify_owner') {
              const phone = ca.config?.owner_phone;
              const title = ca.config?.alert_title || 'AI Manager Alert';
              return { success: true, alerted_phone: phone, alert_title: title };
            } else if (ca.action_type === 'webhook') {
              const url = ca.config?.webhook_url;
              if (url) {
                try {
                  await fetch(url, {
                    method: ca.config?.webhook_method || 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      account_id: accountId,
                      conversation_id: conversationId,
                      customer_phone: memory.customer_phone,
                      customer_name: memory.customer_name,
                      action: ca.name,
                      timestamp: new Date().toISOString(),
                    }),
                  });
                } catch (e) {
                  console.warn('[custom-action] Webhook error:', e);
                }
              }
              return { success: true, triggered_webhook: url };
            }
            return { success: true };
          },
        };
      }

      // Execute LLM with full tools loop
      const llmResult = await runLlmAgentWithTools({
        config,
        systemPrompt,
        messages: history,
        tools: dynamicTools,
        toolContext: toolCtx,
        maxTurns: 5,
      });

      if (llmResult.text && llmResult.text.trim()) {
        const cleanedReply = sanitizeLlmReply(llmResult.text.trim());
        if (cleanedReply) {
          await reply(cleanedReply);
        }

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
          replyText: cleanedReply || llmResult.text,
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

    // Calculate customer risk if enabled
    let risk: RiskCheckResult = {
      riskLevel: 'LOW',
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      cancellationRate: 0,
      requiresHumanApproval: false,
      reasons: [],
    };
    if (actionSettings.risk_engine) {
      risk = await calculateCustomerRisk(db, accountId, memory.customer_phone!);
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
    }

    // Check if auto order creation is enabled
    if (!actionSettings.auto_order_creation) {
      await AI_COMMERCE_TOOLS.apply_tag.handler({ tagName: 'ORDER_INFO_COLLECTED' }, toolCtx);
      await AI_COMMERCE_TOOLS.handoff_to_human.handler(
        {
          reason: 'Customer placed order information, waiting for human confirmation (Auto Order Creation is disabled)',
          summary: `Customer: ${memory.customer_name} | Phone: ${memory.customer_phone} | Address: ${memory.full_address}`,
        },
        toolCtx
      );
      await transition('WAITING_FOR_HUMAN_APPROVAL', memory);
      await reply('ধন্যবাদ! আপনার অর্ডারের সকল তথ্য গ্রহণ করা হয়েছে। আমাদের প্রতিনিধি দ্রুত আপনার সাথে যোগাযোগ করে অর্ডারটি কনফার্ম করে দেবেন। 😊');
      return { handled: true, nextState: 'WAITING_FOR_HUMAN_APPROVAL', handedOff: true };
    }

    // Low / Medium Risk & Auto-Order Enabled: Proceed to create order
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

    // Book courier automatically only if auto_courier_booking is enabled
    let courierInfo: any = null;
    if (actionSettings.auto_courier_booking) {
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
    }

    await transition('ORDER_CREATED', memory);

    // Send professional WhatsApp order confirmation card with digital invoice
    const trackingMsg = courierInfo?.trackingCode
      ? `\n🚚 কুরিয়ার ট্র্যাকিং কোড: *${courierInfo.trackingCode}*`
      : '';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const invoiceUrl = orderResult.invoiceNo ? `\n🧾 ডিজিটাল ক্যাশ মেমো: ${siteUrl}/invoice/${orderResult.invoiceNo}` : '';

    const confirmMsg =
      `✅ *আপনার অর্ডারটি কনফার্ম করা হয়েছে আশা করি দ্রুত সময়ের মধ্যে পেয়ে যাবেন আমাদের সাথে থাকার জন্য ধন্যবাদ।*\n\n` +
      `📦 প্রোডাক্ট: *${orderResult.productName}*\n` +
      `🎨 ভ্যারিয়েন্ট: *${orderResult.variant || 'Standard'}*\n` +
      `🔢 পরিমাণ: *${orderResult.quantity}টি*\n` +
      `💰 সর্বমোট মূল্য: *৳${orderResult.totalAmount.toLocaleString('en-BD')}* (ক্যাশ অন ডেলিভারি)\n` +
      `📍 ডেলিভারি ঠিকানা: ${orderResult.customerName}, ${memory.full_address}\n` +
      `🚚 ডেলিভারি সময়: ঢাকার ভিতরে ${bizCtx.deliveryInsideDhaka}, ঢাকার বাহিরে ${bizCtx.deliveryOutsideDhaka}।\n` +
      `${trackingMsg}${invoiceUrl}\n\n` +
      `পার্সেল রিসিভ করার সময় ${bizCtx.productNoun}টি চেক করে নেওয়ার সুযোগ রয়েছে। ধন্যবাদ আমাদের সাথে থাকার জন্য! 😊`;

    await reply(confirmMsg);
    return { handled: true, nextState: 'ORDER_CREATED' };
  }

  // ----------------------------------------------------
  // Scenario F: Dynamic Product Questions (Material, Size, Battery, Warranty, Delivery, Purity)
  // ----------------------------------------------------
  if (currentProduct) {
    const q = inboundText.toLowerCase();
    const bType = bizCtx.businessType || 'general';

    // 1. Water Resistance (Watches & Electronics only)
    if (/waterproof|পানি লাগলে|water resistant|পানি নিরোধক/i.test(q)) {
      if (currentProduct.water_resistance) {
        await reply(`এটির স্পেসিফিকেশন হলো ${currentProduct.water_resistance}। কিছুটা পানি প্রতিরোধ করতে পারে (হালকা পানিতে সমস্যা হবে না)। 🛡️`);
        return { handled: true };
      } else if (bType === 'watches' || bType === 'electronics') {
        await reply('এই মডেলটি সাধারণ ব্যবহারের জন্য তৈরি। পানিতে ভেজানো বা ডুবিয়ে রাখা থেকে দূরে রাখলে দীর্ঘস্থায়ী সার্ভিস পাবেন। 🛡️');
        return { handled: true };
      }
    }

    // 2. Warranty / Guarantee / Quality Assurance
    if (/warranty|ওয়ারেন্টি|গ্যারান্টি|কতদিন|মেশিন|কালার নষ্ট|নষ্ট হলে|সার্ভিসিং/i.test(q)) {
      const warrantyText = currentProduct.warranty_months
        ? `${currentProduct.warranty_months} মাসের অফিশিয়াল ওয়ারেন্টি`
        : bizCtx.warrantyPolicy;
      await reply(`${warrantyText} থাকবে এবং পার্সেল রিসিভ করার সময় চেক করে নেওয়ার পুরো সুযোগ রয়েছে। 😊`);
      return { handled: true };
    }

    // 3. Delivery Time
    if (/delivery|ডেলিভারি|কবে পাব|কতদিন|সময় লাগ|কখন পাব/i.test(q)) {
      await reply(`আমাদের ডেলিভারি সাধারণত ঢাকার ভিতরে ${bizCtx.deliveryInsideDhaka} এবং ঢাকার বাহিরে ${bizCtx.deliveryOutsideDhaka} সময় লাগতে পারে। 🚚`);
      return { handled: true };
    }

    // 4. Battery / Charging (Electronics & Watches)
    if (/battery|ব্যাটারি|ব্যাটারী|ব্যাকআপ|চার্জ|power/i.test(q)) {
      if (bType === 'watches' || bType === 'electronics') {
        await reply('এটিতে হাই কোয়ালিটি লং লাস্টিং ব্যাটারি দেওয়া আছে যা দীর্ঘস্থায়ী ব্যাকআপ দেয়। 🔋');
        return { handled: true };
      }
    }

    // 5. Material, Fabric, Leather, or Ingredients
    if (/strap|চেইন|বেল্ট|material|ম্যাটেরিয়াল|ফেব্রিক|কাপড়|সুতি|কটন|লেদার|উপাদান/i.test(q)) {
      if (bType === 'fashion') {
        await reply('এটির ফেব্রিক অত্যন্ত উন্নত মানের, নরম ও আরামদায়ক। কালার বা ফিনিশিং নিয়ে সম্পূর্ণ নিশ্চিন্ত থাকতে পারেন। ✨');
        return { handled: true };
      } else if (bType === 'accessories') {
        await reply('এটিতে প্রিমিয়াম কোয়ালিটি জেনুইন লেদার/ম্যাটেরিয়াল ব্যবহার করা হয়েছে। ফিনিশিং ও স্টিচিং অত্যন্ত নিখুঁত ও টেকসই। ✨');
        return { handled: true };
      } else if (bType === 'food') {
        await reply('এটি ১০০% খাঁটি, প্রাকৃতিক ও নিরাপদ উপাদান থেকে তৈরি। কোনো ভেজাল বা প্রিজারভেটিভ নেই। 🍃');
        return { handled: true };
      } else {
        const material = currentProduct.strap_type || currentProduct.movement || 'উন্নত মানের প্রিমিয়াম উপাদান';
        await reply(`এটির উপাদান/ম্যাটেরিয়াল হলো: ${material}। গুণগত মান অত্যন্ত আরামদায়ক ও টেকসই। ✨`);
        return { handled: true };
      }
    }

    // 6. Size, Dial, Fitting, or Measurements
    if (/dial|সাইজ|size|ডায়াল|ফিটিং|মাপ|চার্ট/i.test(q)) {
      if (bType === 'fashion') {
        const variantList = currentProduct.variants?.map((v) => v.name).filter(Boolean);
        const avail = variantList?.length ? ` (Available: ${variantList.join(', ')})` : '';
        await reply(`আমাদের সাইজ চার্ট অত্যন্ত স্ট্যান্ডার্ড ও পারফেক্ট ফিটিং${avail}। আপনার পছন্দের সাইজটি জানাতে পারেন। সাইজ মিসম্যাচ হলে তাৎক্ষণিক এক্সচেঞ্জ সুবিধাও রয়েছে! ✨`);
        return { handled: true };
      } else if (bType === 'watches') {
        const size = currentProduct.dial_size || 'স্ট্যান্ডার্ড সাইজ';
        await reply(`এটির ডায়াল সাইজ হলো: ${size}। হাতে পরলে অত্যন্ত আকর্ষণীয় ও মানানসই লুক দেয়। ✨`);
        return { handled: true };
      } else {
        const size = currentProduct.dial_size || 'স্ট্যান্ডার্ড সাইজ';
        await reply(`এটির সাইজ/পরিমাপ হলো: ${size}। ব্যবহার করতে অত্যন্ত চমৎকার ও মানানসই। ✨`);
        return { handled: true };
      }
    }

    // 7. Colors & Variants
    if (/color|কালার|রং|variant|ভেরিয়েন্ট|ডিজাইন/i.test(q)) {
      const colors = currentProduct.colors?.length ? currentProduct.colors.join(', ') : 'স্ট্যান্ডার্ড';
      await reply(`এই মডেলটি বর্তমানে *${colors}* অপশনে available আছে। আপনি কোনটি নিতে চান? 😊`);
      return { handled: true };
    }
  }

  // Default fallback if unhandled
  return { handled: false };
}

function sanitizeLlmReply(text: string): string {
  // Strip markdown image tags ![alt](url)
  let cleaned = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // Strip bare markdown links pointing to images [alt](http...jpg)
  cleaned = cleaned.replace(/\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp|gif)[^)]*)\)/gi, '');
  // Clean up any triple or more blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

