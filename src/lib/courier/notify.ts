import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { sendSms } from '@/lib/sms/sms-service';

export type CourierNotificationType =
  | 'OUT_FOR_DELIVERY'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED_DELIVERY'
  | 'HOLD_ALERT';

interface OrderNotifyContext {
  id: string;
  account_id: string;
  conversation_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_address?: string | null;
  invoice_no?: string | null;
  product_name?: string | null;
  total_amount?: number | null;
  advance_paid?: number | null;
  courier_provider?: string | null;
  courier_tracking_code?: string | null;
  review_token?: string | null;
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

  // 2. Compute Invoice, COD & Review details
  const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const totalAmount = Number(order.total_amount) || 0;
  const advanceAmount = Number(order.advance_paid) || 0;
  const codDue = Math.max(0, totalAmount - advanceAmount);
  const trackingCode = details?.trackingCode || order.courier_tracking_code || '';
  const customerName = order.customer_name || 'গ্রাহক';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wacrm.live';

  let reviewToken = order.review_token;
  if (eventType === 'DELIVERED' && !reviewToken) {
    reviewToken = crypto.randomUUID();
    // Persist review_token asynchronously
    supabase
      .from('orders')
      .update({ review_token: reviewToken, review_requested_at: new Date().toISOString() })
      .eq('id', order.id)
      .then();
  }
  const reviewUrl = reviewToken ? `${appUrl.replace(/\/$/, '')}/review/${reviewToken}` : '';

  if (now > freeWindowExpiresAt) {
    if (order.customer_phone) {
      let smsMsg = '';
      if (eventType === 'DELIVERED') {
        smsMsg = `ধন্যবাদ! আপনার পার্সেল (${invoiceNo}) সফলভাবে ডেলিভারি হয়েছে। আপনার অভিজ্ঞতা জানিয়ে জিতে নিন ১০০ টাকার কুপন: ${reviewUrl || appUrl}`;
      } else if (eventType === 'OUT_FOR_DELIVERY') {
        const trackUrl = `${appUrl.replace(/\/$/, '')}/track/${encodeURIComponent(trackingCode || invoiceNo)}`;
        smsMsg = `আপনার পার্সেল (${invoiceNo}) আজ ডেলিভারির জন্য বের হয়েছে। রাইডার কল করবেন। লাইভ ট্র্যাক: ${trackUrl}`;
      } else {
        const trackUrl = `${appUrl.replace(/\/$/, '')}/track/${encodeURIComponent(trackingCode || invoiceNo)}`;
        smsMsg = `আপনার পার্সেল (${invoiceNo}) কুরিয়ারে বুকিং হয়েছে। লাইভ ট্র্যাক করুন: ${trackUrl}`;
      }

      await sendSms({
        accountId: order.account_id,
        phone: order.customer_phone,
        message: smsMsg,
        orderId: order.id,
      });
      return { sent: true, reason: 'SMS_FALLBACK_SENT' };
    }
    return { sent: false, reason: 'FREE_WINDOW_EXPIRED' };
  }

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
      const reviewAction = reviewUrl
        ? `\n\n🎁 *আপনার মতামত আমাদের জন্য অমূল্য!*\n` +
          `প্রোডাক্টটির একটি ছবি ও ১ মিনিটে রিভিউ দিয়ে পরবর্তী অর্ডারে জিতে নিন *৳১০০ ডিসকাউন্ট কুপন*:\n` +
          `👉 ${reviewUrl}\n\n`
        : '\n\n';

      messageText =
        `আসসালামু আলাইকুম ${customerName}! 🎁\n\n` +
        `আপনার পার্সেলটি (*${invoiceNo}*) সফলভাবে ডেলিভারি হয়েছে। আশা করি প্রোডাক্টটি আপনার পছন্দ হয়েছে!` +
        reviewAction +
        `ভবিষ্যতে যেকোনো প্রয়োজনে বা ওয়ারেন্টির তথ্যের জন্য আমাদের এই নম্বরে যোগাযোগ করতে পারেন। আমাদের সাথে থাকার জন্য অনেক ধন্যবাদ! 🥰`;
      break;
    }

    case 'FAILED_DELIVERY':
    case 'HOLD_ALERT': {
      const trackingLine = trackingCode ? `\n🚚 কুরিয়ার ট্র্যাকিং কোড: *${trackingCode}*` : '';
      messageText =
        `আসসালামু আলাইকুম ${customerName}! ⚠️\n\n` +
        `আপনার অর্ডারটির (*${invoiceNo}*) ডেলিভারিম্যান আজ আপনার এলাকায় ডেলিভারির জন্য গিয়েছিলেন কিন্তু যোগাযোগ করা সম্ভব হয়নি বা ডেলিভারি স্থগিত রয়েছে।${trackingLine}\n\n` +
        `📦 প্রোডাক্ট: *${order.product_name || 'অর্ডারকৃত পণ্য'}*\n` +
        `💰 বকেয়া COD মূল্য: *৳${codDue.toLocaleString('en-BD')}*\n\n` +
        `পার্সেলটি যেন রিটার্ন হয়ে বাতিল না হয়ে যায়, সেজন্য অনুগ্রহ করে রাইডারের কলে যোগাযোগ করুন অথবা এখনই এই মেসেজের রিপ্লাই দিয়ে জানান কখন ডেলিভারি নিলে আপনার সুবিধা হবে। ধন্যবাদ! ❤️`;
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
