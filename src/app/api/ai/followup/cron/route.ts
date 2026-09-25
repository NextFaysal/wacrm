import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { engineSendText, loadAccountMetaCredentials } from '@/lib/flows/meta-send';

/**
 * GET /api/ai/followup/cron
 * Drain due automated WhatsApp follow-ups for unreplied leads.
 */
export async function GET(request: Request) {
  try {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    const { data: dueFollowups, error } = await admin
      .from('ai_followups')
      .select('*, products(name, colors)')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[ai-followup-cron] fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!dueFollowups || dueFollowups.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let sent = 0;
    let cancelled = 0;

    for (const item of dueFollowups) {
      // 1. Check if customer messaged after this followup was scheduled
      const { data: recentMsgs } = await admin
        .from('messages')
        .select('id, created_at')
        .eq('conversation_id', item.conversation_id)
        .eq('sender_type', 'customer')
        .gt('created_at', item.created_at)
        .limit(1);

      if (recentMsgs && recentMsgs.length > 0) {
        // Customer already messaged back! Cancel follow-up so we don't send outdated messages
        await admin
          .from('ai_followups')
          .update({ status: 'cancelled', updated_at: now })
          .eq('id', item.id);
        cancelled++;
        continue;
      }

      // 2. Check if conversation is handed off or assigned to a human
      const { data: conv } = await admin
        .from('conversations')
        .select('ai_autoreply_disabled, assigned_agent_id')
        .eq('id', item.conversation_id)
        .maybeSingle();

      if (conv?.ai_autoreply_disabled || conv?.assigned_agent_id) {
        await admin
          .from('ai_followups')
          .update({ status: 'cancelled', updated_at: now })
          .eq('id', item.id);
        cancelled++;
        continue;
      }

      // 3. Craft personalized polite follow-up message
      const productName = item.products?.name || 'ঘড়িটি';
      const colors = item.products?.colors?.join(' অথবা ') || 'Black অথবা Silver';
      const text = `😊 আসসালামু আলাইকুম! ${productName} সম্পর্কে কোনো প্রশ্ন আছে কি? আপনি ${colors} কালার পছন্দ করছেন জানালে এখনই ডেলিভারির ব্যবস্থা করতে পারবো।`;

      try {
        // Find config owner user id
        const { data: waCfg } = await admin
          .from('whatsapp_config')
          .select('user_id')
          .eq('account_id', item.account_id)
          .maybeSingle();

        const configOwnerUserId = waCfg?.user_id || item.account_id;

        await engineSendText({
          accountId: item.account_id,
          userId: configOwnerUserId,
          conversationId: item.conversation_id,
          contactId: item.contact_id,
          text,
          aiGenerated: true,
        });

        await admin
          .from('ai_followups')
          .update({ status: 'sent', updated_at: now })
          .eq('id', item.id);

        sent++;
      } catch (err) {
        console.error('[ai-followup-cron] send error:', err);
      }
    }

    return NextResponse.json({ processed: dueFollowups.length, sent, cancelled });
  } catch (err) {
    console.error('[ai-followup-cron] fatal error:', err);
    return NextResponse.json({ error: 'Cron execution failed' }, { status: 500 });
  }
}
