import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type FollowupSettings,
  type DispatchSummary,
  DEFAULT_FOLLOWUP_SETTINGS,
} from '@/types/followup';
import { loadBusinessContext } from '@/lib/ai/business-context';
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { runAbandonedCartRecovery } from '@/lib/ai/agent/abandoned-recovery';

export function toInternationalBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) {
    return `+${digits}`;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `+88${digits}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `+880${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export { DEFAULT_FOLLOWUP_SETTINGS };

export async function getAccountFollowupSettings(
  db: SupabaseClient,
  accountId: string
): Promise<FollowupSettings> {
  const { data, error } = await db
    .from('followup_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return {
      account_id: accountId,
      ...DEFAULT_FOLLOWUP_SETTINGS,
    };
  }

  return {
    account_id: accountId,
    abandoned_checkout_enabled: data.abandoned_checkout_enabled ?? true,
    abandoned_checkout_delay_minutes: Number(data.abandoned_checkout_delay_minutes) || 45,
    abandoned_checkout_template:
      data.abandoned_checkout_template || DEFAULT_FOLLOWUP_SETTINGS.abandoned_checkout_template,
    advance_payment_enabled: data.advance_payment_enabled ?? true,
    advance_payment_delay_hours: Number(data.advance_payment_delay_hours) || 2,
    advance_payment_template:
      data.advance_payment_template || DEFAULT_FOLLOWUP_SETTINGS.advance_payment_template,
    bkash_number: data.bkash_number || null,
    store_url: data.store_url || null,
    incomplete_chat_enabled: data.incomplete_chat_enabled ?? true,
    incomplete_chat_delay_hours: Number(data.incomplete_chat_delay_hours) || 2,
    max_followup_attempts: Number(data.max_followup_attempts) || 2,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function runAccountFollowupQueue(
  db: SupabaseClient,
  accountId: string
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: {
      abandonedCheckoutSent: 0,
      advancePaymentSent: 0,
      incompleteChatSent: 0,
    },
  };

  // 1. Check if WhatsApp is configured for this account
  const { data: waConfig } = await db
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!waConfig || !waConfig.phone_number_id || !waConfig.access_token) {
    return summary;
  }

  const [settings, biz] = await Promise.all([
    getAccountFollowupSettings(db, accountId),
    loadBusinessContext(accountId, db),
  ]);

  const now = new Date();
  const storeName = biz.storeName || 'আমাদের শপ';
  const bkashNumber =
    settings.bkash_number || biz.supportPhone || biz.whatsappNumber || '01XXXXXXXXX';
  const baseUrl = settings.store_url || process.env.NEXT_PUBLIC_APP_URL || '';

  // -------------------------------------------------------------
  // TRIGGER 1: ABANDONED CHECKOUTS
  // -------------------------------------------------------------
  if (settings.abandoned_checkout_enabled) {
    const delayMs = settings.abandoned_checkout_delay_minutes * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - delayMs).toISOString();

    const { data: abandonedLeads, error: leadsErr } = await db
      .from('abandoned_checkouts')
      .select('id, product_id, product_name, customer_name, customer_phone, followup_count, last_followup_at, created_at')
      .eq('account_id', accountId)
      .eq('recovered', false)
      .lt('followup_count', settings.max_followup_attempts)
      .lte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(15);

    if (!leadsErr && abandonedLeads && abandonedLeads.length > 0) {
      for (const lead of abandonedLeads) {
        summary.processed++;

        // If already sent 1 followup, wait at least 20 hours before 2nd attempt
        if (lead.followup_count > 0 && lead.last_followup_at) {
          const hoursSinceLast =
            (now.getTime() - new Date(lead.last_followup_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLast < 20) {
            summary.skipped++;
            continue;
          }
        }

        // Check if customer already placed an order with this phone
        const { data: matchedOrder } = await db
          .from('orders')
          .select('id')
          .eq('account_id', accountId)
          .eq('customer_phone', lead.customer_phone)
          .limit(1)
          .maybeSingle();

        if (matchedOrder) {
          await db
            .from('abandoned_checkouts')
            .update({ recovered: true, recovery_order_id: matchedOrder.id })
            .eq('id', lead.id);
          summary.skipped++;
          continue;
        }

        // Build checkout URL
        let checkoutUrl = baseUrl;
        if (lead.product_id) {
          const { data: prod } = await db
            .from('products')
            .select('slug')
            .eq('id', lead.product_id)
            .maybeSingle();
          if (prod?.slug) {
            checkoutUrl = `${baseUrl}/p/${prod.slug}`;
          }
        }

        const customerName = lead.customer_name?.trim() || 'গ্রাহক';
        const productName = lead.product_name?.trim() || 'পছন্দের পণ্য';

        const messageText = settings.abandoned_checkout_template
          .replace(/\{\{customer_name\}\}/g, customerName)
          .replace(/\{\{product_name\}\}/g, productName)
          .replace(/\{\{store_name\}\}/g, storeName)
          .replace(/\{\{checkout_url\}\}/g, checkoutUrl);

        try {
          const intlPhone = toInternationalBdPhone(lead.customer_phone);
          const resolved = await resolveConversationByPhone(
            db,
            accountId,
            intlPhone,
            customerName
          );

          await sendMessageToConversation(db, accountId, {
            conversationId: resolved.conversationId,
            messageType: 'text',
            contentText: messageText,
          });

          await db
            .from('abandoned_checkouts')
            .update({
              followup_count: (lead.followup_count || 0) + 1,
              last_followup_at: now.toISOString(),
            })
            .eq('id', lead.id);

          await db.from('followup_logs').insert({
            account_id: accountId,
            trigger_type: 'ABANDONED_CHECKOUT',
            recipient_phone: lead.customer_phone,
            recipient_name: customerName,
            reference_id: lead.id,
            message_text: messageText,
            status: 'SENT',
          });

          summary.sent++;
          summary.details.abandonedCheckoutSent++;
        } catch (err: any) {
          console.warn(`[followup] Failed abandoned checkout dispatch for ${lead.id}:`, err?.message);
          summary.failed++;
          await db.from('followup_logs').insert({
            account_id: accountId,
            trigger_type: 'ABANDONED_CHECKOUT',
            recipient_phone: lead.customer_phone,
            recipient_name: customerName,
            reference_id: lead.id,
            message_text: messageText,
            status: 'FAILED',
            error_reason: err?.message || 'Send error',
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // TRIGGER 2: PENDING ADVANCE DELIVERY CHARGE PAYMENT REMINDER
  // -------------------------------------------------------------
  if (settings.advance_payment_enabled) {
    const delayMs = settings.advance_payment_delay_hours * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - delayMs).toISOString();

    const { data: pendingAdvanceOrders, error: advanceErr } = await db
      .from('orders')
      .select('id, customer_name, customer_phone, total_amount, advance_amount, advance_paid, advance_status, advance_reminder_count, last_advance_reminder_at, status, created_at')
      .eq('account_id', accountId)
      .eq('advance_paid', false)
      .in('status', ['NEW', 'PENDING', 'CONFIRMED'])
      .lt('advance_reminder_count', settings.max_followup_attempts)
      .lte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(15);

    if (!advanceErr && pendingAdvanceOrders && pendingAdvanceOrders.length > 0) {
      for (const order of pendingAdvanceOrders) {
        summary.processed++;

        // Space 2nd reminder by at least 20 hours
        if (order.advance_reminder_count > 0 && order.last_advance_reminder_at) {
          const hoursSinceLast =
            (now.getTime() - new Date(order.last_advance_reminder_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLast < 20) {
            summary.skipped++;
            continue;
          }
        }

        const customerName = order.customer_name?.trim() || 'গ্রাহক';
        const advanceAmt = Number(order.advance_amount) || biz.advanceDeliveryFee || 150;
        const shortOrderId = order.id.slice(0, 8).toUpperCase();

        const messageText = settings.advance_payment_template
          .replace(/\{\{customer_name\}\}/g, customerName)
          .replace(/\{\{order_id\}\}/g, shortOrderId)
          .replace(/\{\{advance_amount\}\}/g, String(advanceAmt))
          .replace(/\{\{bkash_number\}\}/g, bkashNumber)
          .replace(/\{\{store_name\}\}/g, storeName);

        try {
          const intlPhone = toInternationalBdPhone(order.customer_phone);
          const resolved = await resolveConversationByPhone(
            db,
            accountId,
            intlPhone,
            customerName
          );

          await sendMessageToConversation(db, accountId, {
            conversationId: resolved.conversationId,
            messageType: 'text',
            contentText: messageText,
          });

          await db
            .from('orders')
            .update({
              advance_reminder_count: (order.advance_reminder_count || 0) + 1,
              last_advance_reminder_at: now.toISOString(),
            })
            .eq('id', order.id);

          await db.from('followup_logs').insert({
            account_id: accountId,
            trigger_type: 'ADVANCE_PAYMENT',
            recipient_phone: order.customer_phone,
            recipient_name: customerName,
            reference_id: order.id,
            message_text: messageText,
            status: 'SENT',
          });

          summary.sent++;
          summary.details.advancePaymentSent++;
        } catch (err: any) {
          console.warn(`[followup] Failed advance payment reminder for order ${order.id}:`, err?.message);
          summary.failed++;
          await db.from('followup_logs').insert({
            account_id: accountId,
            trigger_type: 'ADVANCE_PAYMENT',
            recipient_phone: order.customer_phone,
            recipient_name: customerName,
            reference_id: order.id,
            message_text: messageText,
            status: 'FAILED',
            error_reason: err?.message || 'Send error',
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // TRIGGER 3: INCOMPLETE WHATSAPP CHAT RECOVERY
  // -------------------------------------------------------------
  if (settings.incomplete_chat_enabled) {
    try {
      const chatRecovery = await runAbandonedCartRecovery(db, accountId);
      summary.processed += chatRecovery.processed;
      summary.sent += chatRecovery.recoveredSent;
      summary.skipped += chatRecovery.skipped;
      summary.details.incompleteChatSent += chatRecovery.recoveredSent;
    } catch (e: any) {
      console.warn(`[followup] Incomplete chat recovery error for account ${accountId}:`, e?.message);
    }
  }

  return summary;
}
