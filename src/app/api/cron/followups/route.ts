import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { engineSendText } from '@/lib/flows/meta-send';
import { loadAiConfig } from '@/lib/ai/config';
import { generateReply } from '@/lib/ai/generate';

let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleCronFollowups(request);
}

export async function POST(request: Request) {
  return handleCronFollowups(request);
}

async function handleCronFollowups(request: Request) {
  // Optional cron authorization guard
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = supabaseAdmin();
  const nowIso = new Date().toISOString();

  // 1. Fetch pending followups scheduled on or before now
  const { data: followups, error } = await db
    .from('ai_followups')
    .select(`
      id,
      account_id,
      conversation_id,
      contact_id,
      product_id,
      scheduled_at,
      message_prompt,
      conversations (
        id,
        assigned_agent_id,
        ai_autoreply_disabled,
        last_message_at,
        user_id,
        free_window_expires_at,
        is_ad_referral,
        ai_followup_count
      ),
      contacts (
        id,
        name,
        phone
      ),
      products (
        id,
        name,
        price,
        colors
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .limit(20);

  if (error) {
    console.error('[cron-followups] query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!followups || followups.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No pending followups due' });
  }

  let sentCount = 0;
  let cancelledCount = 0;

  for (const item of followups) {
    const conv = item.conversations as any;
    const contact = item.contacts as any;
    const product = item.products as any;

    // Safety Gate 1: If human agent assigned or AI disabled, cancel follow-up
    if (conv?.assigned_agent_id || conv?.ai_autoreply_disabled) {
      await db.from('ai_followups').update({ status: 'cancelled' }).eq('id', item.id);
      cancelledCount++;
      continue;
    }

    // Safety Gate 2: Check if customer already placed an order recently
    const { data: recentOrder } = await db
      .from('orders')
      .select('id')
      .eq('conversation_id', item.conversation_id)
      .limit(1)
      .maybeSingle();

    if (recentOrder) {
      await db.from('ai_followups').update({ status: 'cancelled' }).eq('id', item.id);
      cancelledCount++;
      continue;
    }

    // Safety Gate 3: Check if customer messaged after this follow-up was scheduled
    if (conv?.last_message_at && new Date(conv.last_message_at) > new Date(item.scheduled_at)) {
      await db.from('ai_followups').update({ status: 'cancelled' }).eq('id', item.id);
      cancelledCount++;
      continue;
    }

    // Safety Gate 4 (Cost Optimizer): Check if Meta messaging window has expired
    // 72h for Meta Ads referrals, 24h for organic. If expired, cancel to avoid extra cost.
    if (conv?.free_window_expires_at && new Date(nowIso) > new Date(conv.free_window_expires_at)) {
      await db.from('ai_followups').update({ status: 'cancelled' }).eq('id', item.id);
      cancelledCount++;
      continue;
    }

    // Safety Gate 5 (Anti-Spam & Customer Preference):
    // Strict cap of 3 follow-ups max within 72 hours, and cancel if customer declined
    if (
      (conv?.ai_followup_count || 0) >= 3 ||
      conv?.ai_state === 'FUTURE_PURCHASE' ||
      conv?.ai_state === 'DECLINED'
    ) {
      await db.from('ai_followups').update({ status: 'cancelled' }).eq('id', item.id);
      cancelledCount++;
      continue;
    }

    // Find WhatsApp config owner user_id for the account
    const { data: waCfg } = await db
      .from('whatsapp_config')
      .select('user_id')
      .eq('account_id', item.account_id)
      .maybeSingle();

    const configOwnerUserId = waCfg?.user_id || conv?.user_id;
    if (!configOwnerUserId) {
      continue;
    }

    // Compose polite, non-intrusive Bengali sales follow-up text
    let followUpText = '';
    const customerSalutation = contact?.name ? `${contact.name} ভাই` : 'ভাইয়া';

    if (product?.name) {
      const colors = product.colors?.length ? product.colors.join(' বা ') : 'পছন্দের';
      followUpText = `আসসালামু আলাইকুম ${customerSalutation}! 😊\n` +
        `আপনি আমাদের *${product.name}* ঘড়িটি সম্পর্কে জানতে চেয়েছিলেন।\n` +
        `ঘড়িটির সীমিত সংখ্যক স্টক অবশিষ্ট আছে। আপনি কি ${colors} কালারটি কনফার্ম করতে চান? ডেলিভারি সংক্রান্ত যেকোনো তথ্যের জন্য জানাতে পারেন! ✨`;
    } else {
      followUpText = `আসসালামু আলাইকুম ${customerSalutation}! 😊\n` +
        `আমাদের ঘড়ির কালেকশন সম্পর্কে কোনো প্রশ্ন বা তথ্য জানার থাকলে নির্দ্বিধায় মেসেজ দিতে পারেন। ধন্যবাদ আমাদের সাথে থাকার জন্য! ✨`;
    }

    // Try generating dynamic follow-up via AI if config active
    try {
      const aiConfig = await loadAiConfig(db, item.account_id);
      if (aiConfig?.isActive && aiConfig.apiKey) {
        const dynamicReply = await generateReply({
          config: aiConfig,
          systemPrompt: `You are a polite, helpful Bangladeshi watch sales executive. Compose a short 2-3 line friendly follow-up message on WhatsApp to a customer who asked about ${product?.name || 'our watch collection'}. Prompt instruction: "${item.message_prompt || 'Polite check-in'}". Write purely in conversational Bangla with emojis. Do not sound pushy.`,
          messages: [{ role: 'user', content: `Customer name: ${contact?.name || 'N/A'}. Please follow up politely.` }],
        });
        if (dynamicReply.text && dynamicReply.text.trim().length > 10) {
          followUpText = dynamicReply.text.trim();
        }
      }
    } catch (e) {
      // Fallback text stays intact
    }

    // Send WhatsApp message
    try {
      await engineSendText({
        accountId: item.account_id,
        userId: configOwnerUserId,
        conversationId: item.conversation_id,
        contactId: item.contact_id,
        text: followUpText,
        aiGenerated: true,
      });

      // Mark follow-up as sent
      await db.from('ai_followups').update({
        status: 'sent',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);

      // Increment conversation follow-up count (up to 3 max)
      const nextCount = (conv?.ai_followup_count || 0) + 1;
      await db.from('conversations').update({
        ai_followup_count: nextCount,
      }).eq('id', item.conversation_id);

      // If fewer than 3 follow-ups sent, schedule next round 24h later if Meta window allows
      if (nextCount < 3 && conv?.free_window_expires_at) {
        const nextSchedule = new Date(Date.now() + 24 * 60 * 60 * 1000);
        if (nextSchedule < new Date(conv.free_window_expires_at)) {
          await db.from('ai_followups').insert({
            account_id: item.account_id,
            conversation_id: item.conversation_id,
            contact_id: item.contact_id,
            product_id: item.product_id,
            scheduled_at: nextSchedule.toISOString(),
            status: 'pending',
            message_prompt: nextCount === 1 ? 'Free delivery incentive follow-up' : 'Final courtesy check follow-up',
          });
        }
      }

      // Audit log
      await db.from('ai_audit_log').insert({
        account_id: item.account_id,
        conversation_id: item.conversation_id,
        contact_id: item.contact_id,
        tool_name: 'automated_followup_sent',
        input: { followupId: item.id, prompt: item.message_prompt },
        output: { text: followUpText },
        status: 'success',
      });

      sentCount++;
    } catch (sendErr) {
      console.error('[cron-followups] send error:', sendErr);
    }
  }

  return NextResponse.json({
    success: true,
    processed: followups.length,
    sent: sentCount,
    cancelled: cancelledCount,
  });
}
