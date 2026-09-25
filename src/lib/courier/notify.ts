import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

export type CourierNotificationType = 'OUT_FOR_DELIVERY' | 'IN_TRANSIT' | 'DELIVERED';

interface OrderNotifyContext {
  id: string;
  account_id: string;
  conversation_id?: string | null;
  customer_name: string;
  customer_address?: string | null;
  invoice_no?: string | null;
  product_name?: string | null;
  total_amount?: number | null;
  advance_paid?: number | null;
  courier_provider?: string | null;
  courier_tracking_code?: string | null;
}

/**
 * Sends real-time WhatsApp courier delivery updates to customers
 * STRICTLY within the Meta Free Messaging Window (72h CTWA Ad / 24h organic).
 * If the free window has expired, this function safely skips sending to prevent
 * unauthorized Meta template billing and API 131047 errors.
 */
export async function notifyCustomerCourierUpdate(
  supabase: SupabaseClient,
  order: OrderNotifyContext,
  eventType: CourierNotificationType,
  details?: { trackingCode?: string; trackingUrl?: string }
): Promise<{ sent: boolean; reason?: string }> {
  if (!order.conversation_id) {
    return { sent: false, reason: 'NO_CONVERSATION_ID' };
  }

  // 1. Verify Active Free Window
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, free_window_expires_at, is_ad_referral, last_customer_message_at, updated_at')
    .eq('id', order.conversation_id)
    .maybeSingle();

  if (convErr || !conv) {
    console.warn('[courier-notify] Conversation not found:', order.conversation_id);
    return { sent: false, reason: 'CONVERSATION_NOT_FOUND' };
  }

  const now = new Date();
  let freeWindowExpiresAt: Date;

  if (conv.free_window_expires_at) {
    freeWindowExpiresAt = new Date(conv.free_window_expires_at);
  } else {
    // Fallback: derive from last message or updated_at
    const lastInteraction = new Date(conv.last_customer_message_at || conv.updated_at || now);
    const windowHours = conv.is_ad_referral ? 72 : 24;
    freeWindowExpiresAt = new Date(lastInteraction.getTime() + windowHours * 60 * 60 * 1000);
  }

  if (now > freeWindowExpiresAt) {
    console.log(
      `[courier-notify] Free window expired for conv ${order.conversation_id} (expired at ${freeWindowExpiresAt.toISOString()}). Skipping notification to avoid Meta charges.`
    );
    return { sent: false, reason: 'FREE_WINDOW_EXPIRED' };
  }

  // 2. Compute Invoice & COD details
  const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const totalAmount = Number(order.total_amount) || 0;
  const advanceAmount = Number(order.advance_paid) || 0;
  const codDue = Math.max(0, totalAmount - advanceAmount);
  const trackingCode = details?.trackingCode || order.courier_tracking_code || '';
  const customerName = order.customer_name || 'গ্রাহক';

  let messageText = '';

  switch (eventType) {
    case 'OUT_FOR_DELIVERY': {
      const trackingLine = trackingCode ? `\n🚚 ট্র্যাকিং কোড: *${trackingCode}*` : '';
      messageText =
        `আসসালামু আলাইকুম ${customerName}! 🚚\n\n` +
        `আপনার অর্ডারটি (*${invoiceNo}*) আজ ডেলিভারিম্যানের কাছে হস্তান্তর করা হয়েছে। কিছুক্ষণের মধ্যে ডেলিভারিম্যান কল করে আপনার সাথে যোগাযোগ করবেন।\n\n` +
        `📦 প্রোডাক্ট: *${order.product_name || 'প্রিমিয়াম ঘড়ি'}*\n` +
        `💰 ক্যাশ অন ডেলিভারি: *৳${codDue.toLocaleString('en-BD')}*\n` +
        (order.customer_address ? `📍 ঠিকানা: ${order.customer_address}\n` : '') +
        `${trackingLine}\n\n` +
        `পার্সেলটি গ্রহণ করার পূর্বে অবশ্যই চেক করে নেওয়ার সুযোগ রয়েছে। ধন্যবাদ আমাদের সাথে থাকার জন্য! ⌚`;
      break;
    }

    case 'IN_TRANSIT': {
      const trackingLine = trackingCode ? `\n🚚 কুরিয়ার ট্র্যাকিং কোড: *${trackingCode}*` : '';
      messageText =
        `আসসালামু আলাইকুম ${customerName}! 📦\n\n` +
        `আপনার অর্ডারটি (*${invoiceNo}*) কুরিয়ারে বুকিং সম্পন্ন হয়েছে এবং আপনার শহরের উদ্দেশ্যে রওনা হয়েছে।${trackingLine}\n\n` +
        `🚚 ডেলিভারি সময়: সাধারণত ঢাকার ভিতরে ২৪-৪৮ ঘণ্টা, ঢাকার বাহিরে ৪৮-৭২ ঘণ্টা সময় লাগতে পারে। সাথে থাকার জন্য ধন্যবাদ! ✨`;
      break;
    }

    case 'DELIVERED': {
      messageText =
        `আসসালামু আলাইকুম ${customerName}! 🎁\n\n` +
        `আপনার পার্সেলটি (*${invoiceNo}*) সফলভাবে ডেলিভারি হয়েছে। আমাদের ঘড়িটি আপনার কেমন লেগেছে? আপনার মূল্যবান মতামত জানাতে পারেন।\n\n` +
        `ভবিষ্যতে যেকোনো প্রয়োজনে বা ১ বছরের ওয়ারেন্টির তথ্যের জন্য আমাদের এই নম্বরে যোগাযোগ করতে পারেন। আমাদের সাথে থাকার জন্য অনেক ধন্যবাদ! 🥰`;
      break;
    }
  }

  if (!messageText) return { sent: false, reason: 'EMPTY_MESSAGE' };

  try {
    await sendMessageToConversation(supabase, order.account_id, {
      conversationId: order.conversation_id,
      messageType: 'text',
      contentText: messageText,
    });
    return { sent: true };
  } catch (err) {
    console.warn('[courier-notify] Failed to send WhatsApp message:', err);
    return { sent: false, reason: 'SEND_FAILED' };
  }
}
