import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { sendSms } from '@/lib/sms/sms-service';

/**
 * GET /api/cron/review-drip
 * Automated 24h Post-Delivery Customer Review Drip Worker.
 * Scans delivered orders that haven't submitted a review yet and sends
 * an automated 1-click UGC review request with a ৳100 discount coupon incentive.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('key');

    // Optional secret check if CRON_SECRET is configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
      // Allow testing in development mode
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
      }
    }

    const admin = supabaseAdmin();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://wacrm.live').replace(/\/$/, '');

    // Look for orders delivered at least 12 hours ago, up to 14 days ago,
    // where review has not yet been submitted, and no review request was sent in the last 48 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: eligibleOrders, error } = await admin
      .from('orders')
      .select('id, account_id, conversation_id, customer_name, customer_phone, invoice_no, product_name, review_token, review_requested_at, review_submitted_at, updated_at')
      .eq('status', 'DELIVERED')
      .is('review_submitted_at', null)
      .is('review_requested_at', null)
      .lt('updated_at', twelveHoursAgo)
      .gt('updated_at', fourteenDaysAgo)
      .limit(30);

    if (error) {
      console.error('[review-drip-cron] Fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!eligibleOrders || eligibleOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible orders pending review drip',
        processed: 0,
      });
    }

    let sentWhatsApp = 0;
    let sentSmsCount = 0;
    let failedCount = 0;

    for (const order of eligibleOrders) {
      try {
        let reviewToken = order.review_token;
        if (!reviewToken) {
          reviewToken = crypto.randomUUID();
          await admin
            .from('orders')
            .update({ review_token: reviewToken })
            .eq('id', order.id);
        }

        const reviewUrl = `${appUrl}/review/${reviewToken}`;
        const customerName = order.customer_name || 'সম্মানিত গ্রাহক';
        const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;

        let deliveredViaWhatsApp = false;

        // Try WhatsApp if conversation_id is available
        if (order.conversation_id) {
          // Check free window
          const { data: conv } = await admin
            .from('conversations')
            .select('free_window_expires_at, last_customer_message_at, is_ad_referral')
            .eq('id', order.conversation_id)
            .maybeSingle();

          const now = new Date();
          let freeWindowExpiresAt: Date;
          if (conv?.free_window_expires_at) {
            freeWindowExpiresAt = new Date(conv.free_window_expires_at);
          } else {
            const lastInteraction = new Date(conv?.last_customer_message_at || now);
            const windowHours = conv?.is_ad_referral ? 72 : 24;
            freeWindowExpiresAt = new Date(lastInteraction.getTime() + windowHours * 60 * 60 * 1000);
          }

          if (now <= freeWindowExpiresAt) {
            const message =
              `আসসালামু আলাইকুম ${customerName}! 🌟\n\n` +
              `আপনার পার্সেলটি (*${invoiceNo}*) সফলভাবে ডেলিভারি হয়েছে। আমাদের প্রোডাক্ট ও সার্ভিস আপনার কেমন লেগেছে?\n\n` +
              `📸 মাত্র ১ মিনিটে একটি ছবি ও মূল্যবান মতামত জানিয়ে জিতে নিন পরবর্তী অর্ডারের জন্য *৳১০০ ডিসকাউন্ট কুপন*:\n` +
              `👉 ${reviewUrl}\n\n` +
              `আপনার সুন্দর মতামতের অপেক্ষায় রইলাম! ❤️`;

            await sendMessageToConversation(admin, order.account_id, {
              conversationId: order.conversation_id,
              messageType: 'text',
              contentText: message,
            });

            deliveredViaWhatsApp = true;
            sentWhatsApp++;
          }
        }

        // If WhatsApp couldn't be sent, fall back to SMS
        if (!deliveredViaWhatsApp && order.customer_phone) {
          const smsMsg = `আসসালামু আলাইকুম! আপনার পার্সেল (${invoiceNo}) কেমন লেগেছে? ১ মিনিটে রিভিউ দিয়ে জিতে নিন ১০০ টাকার কুপন: ${reviewUrl}`;
          const smsRes = await sendSms({
            accountId: order.account_id,
            phone: order.customer_phone,
            message: smsMsg,
            orderId: order.id,
          });

          if (smsRes.success) {
            sentSmsCount++;
          } else {
            failedCount++;
          }
        }

        // Update review_requested_at timestamp
        await admin
          .from('orders')
          .update({ review_requested_at: new Date().toISOString() })
          .eq('id', order.id);

      } catch (itemErr) {
        console.warn('[review-drip-cron] Error processing order:', order.id, itemErr);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: eligibleOrders.length,
      sentWhatsApp,
      sentSms: sentSmsCount,
      failed: failedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
