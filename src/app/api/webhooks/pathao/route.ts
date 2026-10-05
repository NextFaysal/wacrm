import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { notifyCustomerCourierUpdate } from '@/lib/courier/notify';

const DEFAULT_PATHAO_SECRET = 'f3992ecc-59da-4cbe-a049-a13da2018d51';

/**
 * GET /api/webhooks/pathao
 * Health check endpoint for Pathao webhook.
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ status: 'ok', provider: 'pathao', timestamp: new Date().toISOString() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Pathao-Merchant-Webhook-Integration-Secret': DEFAULT_PATHAO_SECRET,
      },
    }
  );
}

/**
 * POST /api/webhooks/pathao
 * Real-time event receiver for Pathao Courier.
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
      return new NextResponse(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const eventName = String(payload.event || '').toLowerCase();
    const signature = request.headers.get('x-pathao-signature') || '';

    // Check if this is the Pathao Webhook Integration Handshake
    if (eventName === 'webhook_integration') {
      const integrationSecret = signature || DEFAULT_PATHAO_SECRET;
      return new NextResponse(
        JSON.stringify({ success: true, message: 'Pathao webhook integration verified' }),
        {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
            'X-Pathao-Merchant-Webhook-Integration-Secret': integrationSecret,
          },
        }
      );
    }

    const consignmentId = payload.consignment_id ? String(payload.consignment_id) : null;
    const merchantOrderId = payload.merchant_order_id ? String(payload.merchant_order_id) : null;

    // 1. Find matching order
    let orderQuery = admin.from('orders').select('*');
    if (consignmentId && merchantOrderId) {
      orderQuery = orderQuery.or(
        `courier_consignment_id.eq.${consignmentId},invoice_no.eq.${merchantOrderId},id.eq.${merchantOrderId}`
      );
    } else if (consignmentId) {
      orderQuery = orderQuery.eq('courier_consignment_id', consignmentId);
    } else if (merchantOrderId) {
      orderQuery = orderQuery.or(`invoice_no.eq.${merchantOrderId},id.eq.${merchantOrderId}`);
    }

    const { data: matchedOrders } = await orderQuery.limit(1);
    const order = matchedOrders?.[0] || null;

    // Resolve integration secret for response headers
    let integrationSecret = DEFAULT_PATHAO_SECRET;
    if (order?.account_id) {
      const { data: config } = await admin
        .from('courier_configs')
        .select('webhook_secret, secret_key')
        .eq('account_id', order.account_id)
        .eq('provider', 'pathao')
        .maybeSingle();

      if (config?.webhook_secret) integrationSecret = config.webhook_secret;
      else if (config?.secret_key) integrationSecret = config.secret_key;
    }

    // 2. Map Event to Order Status
    if (order) {
      const updates: Record<string, unknown> = {
        courier_status: eventName,
        updated_at: new Date().toISOString(),
      };

      if (eventName === 'order.delivered' || eventName === 'order.partial-delivery') {
        updates.status = 'DELIVERED';

        // Automated WhatsApp Delivery Thank You Message (checks Meta free window)
        if (order.status !== 'DELIVERED' && order.conversation_id) {
          try {
            await notifyCustomerCourierUpdate(admin, order, 'DELIVERED', {
              trackingCode: consignmentId || order.courier_tracking_code || undefined,
            });
          } catch (e) {
            console.warn('[pathao-webhook] WhatsApp delivery msg warning:', e);
          }
        }
      } else if (
        eventName === 'order.returned' ||
        eventName === 'order.returned-to-merchant' ||
        eventName === 'order.paid-return'
      ) {
        updates.status = 'RETURNED';

        // Atomic Stock Restoration
        if (order.status !== 'RETURNED' && order.status !== 'CANCELLED' && order.product_id) {
          try {
            await admin.rpc('increment_product_stock', {
              p_product_id: order.product_id,
              p_quantity: order.quantity,
              p_variant_id: null,
              p_order_id: order.id,
              p_reason: 'order_returned',
            });
          } catch (e) {
            console.warn('[pathao-webhook] stock restore warning:', e);
          }
        }
      } else if (eventName === 'order.assigned-for-delivery') {
        updates.status = 'OUT_FOR_DELIVERY';
        if (order.status !== 'OUT_FOR_DELIVERY' && order.conversation_id) {
          try {
            await notifyCustomerCourierUpdate(admin, order, 'OUT_FOR_DELIVERY', {
              trackingCode: consignmentId || order.courier_tracking_code || undefined,
            });
          } catch (e) {
            console.warn('[pathao-webhook] WhatsApp out-for-delivery msg warning:', e);
          }
        }
      } else if (
        eventName === 'order.picked' ||
        eventName === 'order.in-transit' ||
        eventName === 'order.at-the-sorting-hub' ||
        eventName === 'order.received-at-last-mile-hub'
      ) {
        if (order.status === 'COURIER_BOOKED' || order.status === 'CONFIRMED' || order.status === 'NEW') {
          updates.status = 'SHIPPED';
          if (order.conversation_id) {
            try {
              await notifyCustomerCourierUpdate(admin, order, 'IN_TRANSIT', {
                trackingCode: consignmentId || order.courier_tracking_code || undefined,
              });
            } catch (e) {
              console.warn('[pathao-webhook] WhatsApp in-transit msg warning:', e);
            }
          }
        }
      } else if (
        eventName === 'order.delivery-failed' ||
        eventName === 'order.on-hold' ||
        eventName === 'order.rescheduled'
      ) {
        if (order.conversation_id) {
          try {
            await notifyCustomerCourierUpdate(admin, order, 'FAILED_DELIVERY', {
              trackingCode: consignmentId || order.courier_tracking_code || undefined,
            });
          } catch (e) {
            console.warn('[pathao-webhook] WhatsApp failed-delivery msg warning:', e);
          }
        }
      }

      await admin.from('orders').update(updates).eq('id', order.id);

      // Also update courier_orders table if row exists
      if (consignmentId) {
        await admin
          .from('courier_orders')
          .update({
            status: eventName,
            updated_at: new Date().toISOString(),
          })
          .eq('consignment_id', consignmentId);
      }
    }

    // 3. Record audit log
    await admin.from('courier_webhook_logs').insert({
      account_id: order?.account_id || null,
      provider: 'pathao',
      event_type: eventName,
      consignment_id: consignmentId,
      order_id: order?.id || null,
      payload,
      status: 'processed',
    });

    return new NextResponse(
      JSON.stringify({ success: true, event: eventName }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Pathao-Merchant-Webhook-Integration-Secret': integrationSecret,
        },
      }
    );
  } catch (err) {
    console.error('[pathao-webhook] fatal error:', err);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Pathao-Merchant-Webhook-Integration-Secret': DEFAULT_PATHAO_SECRET,
      },
    });
  }
}
