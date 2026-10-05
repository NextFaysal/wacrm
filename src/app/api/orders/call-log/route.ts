import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { sendSms } from '@/lib/sms/sms-service';

/**
 * GET /api/orders/call-log?orderId=...
 * Returns call history for a specific order.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('order_call_logs')
      .select('*, caller:caller_id(full_name, email)')
      .eq('account_id', accountId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[order-call-logs] fetch error:', error);
      return NextResponse.json({ logs: [] });
    }

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/orders/call-log
 * Records an agent's phone call outcome and updates the order status accordingly.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    if (!body?.callOutcome) {
      return NextResponse.json({ error: 'callOutcome is required' }, { status: 400 });
    }

    const {
      orderId,
      callOutcome,
      rescheduledDate,
      cancellationReason,
      notes = '',
      shouldSendSms = true,
    } = body;

    // 1. Fetch current order
    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .eq('id', orderId)
      .single();

    if (ordErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const customerPhone = String(order.customer_phone || '').trim();
    const invoiceNo = order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://wacrm.live').replace(/\/$/, '');

    let smsSent = false;

    // 2. Perform automated follow-up SMS if requested
    if (shouldSendSms && customerPhone) {
      if (callOutcome === 'no_answer' || callOutcome === 'busy') {
        // Ensure confirmation token exists
        let confToken = order.confirmation_token;
        if (!confToken) {
          confToken = crypto.randomUUID();
          await supabase
            .from('order_confirmations')
            .insert({
              account_id: accountId,
              order_id: order.id,
              customer_phone: customerPhone,
              otp_code: Math.floor(1000 + Math.random() * 9000).toString(),
              confirmation_token: confToken,
              status: 'pending',
            });
        }
        const confirmUrl = `${appUrl}/confirm/${confToken}`;
        const smsMsg = `আসসালামু আলাইকুম! আপনার অর্ডারটি (${invoiceNo}) নিশ্চিত করতে আমরা কল দিয়েছিলাম কিন্তু পাইনি। অনুগ্রহ করে এই লিঙ্কে ১ ক্লিকে কনফার্ম করুন: ${confirmUrl}`;
        const smsRes = await sendSms({
          accountId,
          phone: customerPhone,
          message: smsMsg,
          orderId: order.id,
        });
        smsSent = smsRes.success;
      } else if (callOutcome === 'confirmed') {
        const trackUrl = `${appUrl}/track/${encodeURIComponent(order.courier_tracking_code || invoiceNo)}`;
        const smsMsg = `ধন্যবাদ! আপনার অর্ডারটি (${invoiceNo}) সফলভাবে নিশ্চিত হয়েছে। পার্সেল ডেলিভারি লাইভ ট্র্যাক করুন: ${trackUrl}`;
        const smsRes = await sendSms({
          accountId,
          phone: customerPhone,
          message: smsMsg,
          orderId: order.id,
        });
        smsSent = smsRes.success;
      }
    }

    // 3. Insert Call Log Record
    const { data: callLog, error: logErr } = await supabase
      .from('order_call_logs')
      .insert({
        account_id: accountId,
        order_id: orderId,
        caller_id: userId || null,
        customer_phone: customerPhone,
        call_outcome: callOutcome,
        rescheduled_date: rescheduledDate || null,
        cancellation_reason: cancellationReason || null,
        notes: notes.trim(),
        sms_sent: smsSent,
      })
      .select('*')
      .single();

    if (logErr) {
      console.warn('[order-call-logs] insert log error:', logErr);
    }

    // 4. Update Order Status & Call Tracking
    const orderUpdates: Record<string, unknown> = {
      last_called_at: new Date().toISOString(),
      last_caller_id: userId || null,
      call_attempt_count: (Number(order.call_attempt_count) || 0) + 1,
      updated_at: new Date().toISOString(),
    };

    switch (callOutcome) {
      case 'confirmed':
        orderUpdates.call_status = 'called_confirmed';
        orderUpdates.status = 'CONFIRMED';
        orderUpdates.confirmation_status = 'confirmed';
        break;

      case 'no_answer':
        orderUpdates.call_status = 'called_no_answer';
        break;

      case 'busy':
        orderUpdates.call_status = 'called_busy';
        break;

      case 'rescheduled':
        orderUpdates.call_status = 'called_rescheduled';
        if (rescheduledDate) {
          orderUpdates.target_delivery_date = rescheduledDate;
          orderUpdates.delivery_notes = `গ্রাহক অনুরোধে ডেলিভারি পেছানো হয়েছে: ${rescheduledDate}. ${order.delivery_notes || ''}`.trim();
        }
        break;

      case 'cancelled':
      case 'wrong_number':
        orderUpdates.call_status = 'called_cancelled';
        orderUpdates.status = 'CANCELLED';
        orderUpdates.confirmation_status = 'rejected';

        // Atomic Stock Restoration if not already cancelled
        if (order.status !== 'CANCELLED' && order.product_id) {
          try {
            await supabase.rpc('increment_product_stock', {
              p_product_id: order.product_id,
              p_quantity: order.quantity || 1,
            });
          } catch (e) {
            console.warn('[call-log] stock restoration failed:', e);
          }
        }
        break;
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(orderUpdates)
      .eq('id', orderId)
      .select('*')
      .single();

    if (updateErr) {
      console.error('[order-call-logs] order update error:', updateErr);
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      log: callLog,
      order: updatedOrder,
      smsSent,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
