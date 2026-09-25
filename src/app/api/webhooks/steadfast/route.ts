import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { notifyCustomerCourierUpdate } from '@/lib/courier/notify';

/**
 * GET /api/webhooks/steadfast
 * Health check endpoint for Steadfast webhook configuration.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', provider: 'steadfast', timestamp: new Date().toISOString() });
}

/**
 * POST /api/webhooks/steadfast
 * Real-time event receiver for Steadfast Courier.
 */
export async function POST(request: Request) {
  const admin = supabaseAdmin();
  let rawBody = '';

  try {
    rawBody = await request.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const givenSignature = request.headers.get('x-signature') || '';
    const idempotencyKey = request.headers.get('idempotency-key');

    // Extract Bearer token if present
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    // 1. Find matching order & courier config
    const consignmentId = payload.consignment_id ? String(payload.consignment_id) : null;
    const invoice = payload.invoice ? String(payload.invoice) : null;
    const trackingId = payload.tracking_id ? String(payload.tracking_id) : null;

    let orderQuery = admin.from('orders').select('*');
    if (consignmentId && invoice) {
      orderQuery = orderQuery.or(`courier_consignment_id.eq.${consignmentId},invoice_no.eq.${invoice}`);
    } else if (consignmentId) {
      orderQuery = orderQuery.eq('courier_consignment_id', consignmentId);
    } else if (invoice) {
      orderQuery = orderQuery.eq('invoice_no', invoice);
    } else if (trackingId) {
      orderQuery = orderQuery.eq('courier_tracking_code', trackingId);
    } else {
      console.warn('[steadfast-webhook] Payload missing consignment_id or invoice');
    }

    const { data: matchedOrders } = await orderQuery.limit(1);
    const order = matchedOrders?.[0] || null;

    // 2. Validate HMAC signature if courier_configs has a secret/token
    if (order?.account_id) {
      const { data: config } = await admin
        .from('courier_configs')
        .select('*')
        .eq('account_id', order.account_id)
        .eq('provider', 'steadfast')
        .maybeSingle();

      const secret = config?.webhook_secret || config?.secret_key || bearerToken;
      if (secret && givenSignature) {
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        if (
          givenSignature.length !== expected.length ||
          !crypto.timingSafeEqual(Buffer.from(givenSignature), Buffer.from(expected))
        ) {
          console.warn('[steadfast-webhook] HMAC signature mismatch');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    const notificationType = String(payload.notification_type || 'delivery_status');
    const courierStatus = String(payload.status || '').toLowerCase();
    const trackingMessage = payload.tracking_message ? String(payload.tracking_message) : null;

    // 3. Process Status Updates
    if (order) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (notificationType === 'delivery_status') {
        updates.courier_status = courierStatus;

        if (courierStatus === 'delivered' || courierStatus === 'partial_delivered') {
          updates.status = 'DELIVERED';

          // Automated WhatsApp Delivery Thank You Message (checks Meta free window)
          if (order.status !== 'DELIVERED' && order.conversation_id) {
            try {
              await notifyCustomerCourierUpdate(admin, order, 'DELIVERED', {
                trackingCode: trackingId || order.courier_tracking_code || consignmentId,
              });
            } catch (e) {
              console.warn('[steadfast-webhook] WhatsApp delivery msg warning:', e);
            }
          }
        } else if (courierStatus === 'in_transit' || courierStatus === 'out_for_delivery') {
          const nextStatus = courierStatus === 'out_for_delivery' ? 'OUT_FOR_DELIVERY' : 'SHIPPED';
          if (order.status !== nextStatus) {
            updates.status = nextStatus;
            if (order.conversation_id) {
              try {
                await notifyCustomerCourierUpdate(
                  admin,
                  order,
                  courierStatus === 'out_for_delivery' ? 'OUT_FOR_DELIVERY' : 'IN_TRANSIT',
                  { trackingCode: trackingId || order.courier_tracking_code || consignmentId }
                );
              } catch (e) {
                console.warn('[steadfast-webhook] WhatsApp tracking msg warning:', e);
              }
            }
          }
        } else if (courierStatus === 'cancelled') {
          updates.status = 'CANCELLED';

          // Atomic Stock Restoration
          if (order.status !== 'CANCELLED' && order.product_id) {
            try {
              await admin.rpc('increment_product_stock', {
                p_product_id: order.product_id,
                p_quantity: order.quantity,
                p_variant_id: null,
                p_order_id: order.id,
                p_reason: 'order_cancelled',
              });
            } catch (e) {
              console.warn('[steadfast-webhook] stock restore warning:', e);
            }
          }
        }
      }

      if (trackingMessage) {
        const cleanNote = order.notes ? `${order.notes} | ${trackingMessage}` : trackingMessage;
        updates.notes = cleanNote.slice(0, 500);
      }

      await admin.from('orders').update(updates).eq('id', order.id);

      // Also update courier_orders table if row exists
      if (consignmentId) {
        await admin
          .from('courier_orders')
          .update({
            status: courierStatus || 'updated',
            note: trackingMessage || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('consignment_id', consignmentId);
      }
    }

    // 4. Record audit log
    await admin.from('courier_webhook_logs').insert({
      account_id: order?.account_id || null,
      provider: 'steadfast',
      event_type: notificationType,
      consignment_id: consignmentId,
      order_id: order?.id || null,
      payload,
      status: 'processed',
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err) {
    console.error('[steadfast-webhook] fatal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
