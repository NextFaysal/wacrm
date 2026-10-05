import { NextResponse, after } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { dispatchCourierOrder, getLiveCourierTracking } from '@/lib/courier/dispatch';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { sendMetaConversionsEvent } from '@/lib/meta/conversions-api';

/**
 * GET /api/orders
 * List commerce orders with filters.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const riskLevel = searchParams.get('risk');
    const search = searchParams.get('search');

    let query = supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (riskLevel && riskLevel !== 'all') {
      query = query.eq('risk_level', riskLevel);
    }
    if (search) {
      query = query.or(`customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[orders] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ orders: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/orders
 * Create an order.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.customerName || !body?.customerPhone || !body?.productName) {
      return NextResponse.json(
        { error: 'Customer name, phone and product name are required' },
        { status: 400 }
      );
    }

    const qty = Number(body.quantity) || 1;
    const unitPrice = Number(body.unitPrice) || 0;
    const deliveryCharge = Number(body.deliveryCharge) || 0;
    const totalAmount = unitPrice * qty + deliveryCharge;

    const advancePaid = Number(body.advancePaid || body.advance_paid) || 0;
    const advanceMethod = body.advanceMethod || body.advance_method || (advancePaid > 0 ? 'bkash' : 'cash');
    const advanceTrxId = body.advanceTrxId || body.advance_trx_id || null;
    const advanceStatus = advancePaid > 0 ? 'paid' : 'unpaid';

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        account_id: accountId,
        conversation_id: body.conversationId || null,
        contact_id: body.contactId || null,
        product_id: body.productId || null,
        product_name: String(body.productName).trim(),
        variant: body.variant || null,
        quantity: qty,
        unit_price: unitPrice,
        delivery_charge: deliveryCharge,
        total_amount: totalAmount,
        advance_paid: advancePaid,
        advance_method: advanceMethod,
        advance_trx_id: advanceTrxId,
        advance_status: advanceStatus,
        customer_name: String(body.customerName).trim(),
        customer_phone: String(body.customerPhone).trim(),
        customer_address: String(body.customerAddress || '').trim(),
        thana: body.thana?.trim() || null,
        district: body.district?.trim() || null,
        status: body.status || 'NEW',
        risk_level: body.riskLevel || 'LOW',
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[orders] insert error:', error);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Atomic Stock Decrement & Audit Log
    if (body.productId && order?.id) {
      try {
        await supabase.rpc('decrement_product_stock', {
          p_product_id: body.productId,
          p_quantity: qty,
          p_variant_id: body.variantId || null,
          p_order_id: order.id,
        });
      } catch (stockErr) {
        console.warn('[orders] stock decrement error:', stockErr);
      }
    }

    // Dispatch Meta Conversions API (CAPI) Purchase Event
    after(async () => {
      try {
        await sendMetaConversionsEvent({
          accountId,
          eventName: 'Purchase',
          eventId: `order_${order.id}`,
          userData: {
            phone: body.customerPhone,
            firstName: body.customerName,
          },
          customData: {
            value: totalAmount,
            currency: 'BDT',
            content_name: body.productName,
            order_id: order.id,
            num_items: qty,
          },
        });
      } catch (capiErr) {
        console.warn('[orders] CAPI purchase dispatch error:', capiErr);
      }
    });

    return NextResponse.json({ success: true, order });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PATCH /api/orders
 * Update order status, book courier, or approve high-risk orders.
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Fetch existing order to inspect current state
    const { data: existingOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', body.id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (fetchErr || !existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if dispatch to courier is requested
    if (body.action === 'book_courier') {
      const order = existingOrder;
      let provider = (body.provider as 'steadfast' | 'pathao' | 'auto') || 'steadfast';

      if (provider === 'auto') {
        const { getRecommendedCourier } = await import('@/lib/courier/auto-assign');
        const recommendation = await getRecommendedCourier(supabase, accountId, {
          district: order.district,
          address: order.customer_address,
        });
        provider = recommendation.recommendedProvider === 'pathao' ? 'pathao' : 'steadfast';
      }

      const { data: config } = await supabase
        .from('courier_configs')
        .select('*')
        .eq('account_id', accountId)
        .eq('provider', provider)
        .maybeSingle();

      if (!config || !config.is_active || !config.api_key) {
        return NextResponse.json({ error: `${provider.toUpperCase()} Courier is not configured or inactive.` }, { status: 400 });
      }

      const courierResult = await dispatchCourierOrder(
        config,
        {
          provider,
          recipient_name: order.customer_name,
          recipient_phone: order.customer_phone,
          recipient_address: order.customer_address,
          cod_amount: Math.max(0, order.total_amount - (order.advance_paid || 0)),
          note: `Order #${order.invoice_no || order.id.slice(0, 8)}: ${order.product_name} (${order.variant || 'Standard'})`,
          color_variant: order.variant || undefined,
          conversation_id: order.conversation_id || undefined,
          contact_id: order.contact_id || undefined,
        },
        supabase
      );

      if (!courierResult.success) {
        return NextResponse.json({ error: courierResult.error || 'Courier dispatch failed' }, { status: 502 });
      }

      const { data: updatedOrder } = await supabase
        .from('orders')
        .update({
          status: 'COURIER_BOOKED',
          courier_provider: courierResult.provider,
          courier_tracking_code: courierResult.tracking_code,
          courier_consignment_id: courierResult.consignment_id ? String(courierResult.consignment_id) : null,
          courier_status: 'in_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single();

      // Automated WhatsApp Courier Tracking Message to Customer
      if (order.conversation_id && courierResult.tracking_code) {
        try {
          const codDue = Math.max(0, order.total_amount - (order.advance_paid || 0));
          const trackingMsg = `আসসালামু আলাইকুম ${order.customer_name}! 🚚\n\nআপনার পার্সেলটি কুরিয়ারে বুকিং সম্পন্ন হয়েছে।\n\n📦 কুরিয়ার সার্ভিস: ${courierResult.provider.toUpperCase()}\n🔖 ট্র্যাকিং কোড: ${courierResult.tracking_code}\n${courierResult.tracking_url ? `🔗 লাইভ ট্র্যাক লিংক: ${courierResult.tracking_url}\n` : ''}💰 কুরিয়ারে প্রদেয় (COD): ৳${codDue.toLocaleString('en-BD')}\n\nখুব শীঘ্রই ডেলিভারি ম্যান আপনার ঠিকানায় পার্সেলটি নিয়ে যাবেন। যেকোনো তথ্যের জন্য আমাদের এখানে মেসেজ দিন। ধন্যবাদ! ✨`;

          await sendMessageToConversation(supabase, accountId, {
            conversationId: order.conversation_id,
            messageType: 'text',
            contentText: trackingMsg,
          });
        } catch (e) {
          console.warn('[orders] WhatsApp courier notification warning:', e);
        }
      }

      return NextResponse.json({ success: true, order: updatedOrder, courier: courierResult });
    }

    // Check if Courier Live Status Sync is requested
    if (body.action === 'sync_courier') {
      const order = existingOrder;
      if (!order.courier_tracking_code) {
        return NextResponse.json({ error: 'Order has no courier tracking code' }, { status: 400 });
      }

      const provider = (order.courier_provider || 'steadfast') as 'steadfast' | 'pathao';
      const { data: config } = await supabase
        .from('courier_configs')
        .select('*')
        .eq('account_id', accountId)
        .eq('provider', provider)
        .maybeSingle();

      const trackingResult = await getLiveCourierTracking(config, provider, order.courier_tracking_code);

      // Map courier delivery_status to OrderStatus
      let mappedStatus = order.status;
      const rawStatus = (trackingResult.status || '').toLowerCase();
      if (rawStatus === 'delivered' || rawStatus === 'partial_delivered') {
        mappedStatus = 'DELIVERED';
      } else if (rawStatus === 'out_for_delivery') {
        mappedStatus = 'OUT_FOR_DELIVERY';
      } else if (rawStatus === 'in_transit' || rawStatus === 'pending') {
        mappedStatus = order.status === 'NEW' || order.status === 'CONFIRMED' ? 'COURIER_BOOKED' : order.status;
      } else if (rawStatus === 'cancelled') {
        mappedStatus = 'CANCELLED';
      }

      // Restock if status changed to CANCELLED or RETURNED
      if (
        (mappedStatus === 'CANCELLED' || mappedStatus === 'RETURNED') &&
        order.product_id &&
        order.status !== 'CANCELLED' &&
        order.status !== 'RETURNED'
      ) {
        try {
          await supabase.rpc('increment_product_stock', {
            p_product_id: order.product_id,
            p_quantity: order.quantity,
            p_variant_id: null,
            p_order_id: order.id,
            p_reason: 'courier_cancelled',
          });
        } catch (e) {
          console.warn('[orders] sync restock warning:', e);
        }
      }

      const { data: updatedOrder, error: updateErr } = await supabase
        .from('orders')
        .update({
          courier_status: trackingResult.status,
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
      }

      return NextResponse.json({ success: true, order: updatedOrder, tracking: trackingResult });
    }

    // Check if Bulk Status Update is requested
    if (body.action === 'bulk_status') {
      const orderIds: string[] = Array.isArray(body.order_ids) ? body.order_ids : [];
      const newStatus = body.status;
      if (!orderIds.length || !newStatus) {
        return NextResponse.json({ error: 'Order IDs and new status are required' }, { status: 400 });
      }

      // If cancelling/returning in bulk, restock them
      if (newStatus === 'CANCELLED' || newStatus === 'RETURNED') {
        const { data: toRestock } = await supabase
          .from('orders')
          .select('id, product_id, quantity, status')
          .in('id', orderIds)
          .eq('account_id', accountId)
          .neq('status', 'CANCELLED')
          .neq('status', 'RETURNED');

        if (toRestock && toRestock.length > 0) {
          for (const item of toRestock) {
            if (item.product_id) {
              try {
                await supabase.rpc('increment_product_stock', {
                  p_product_id: item.product_id,
                  p_quantity: item.quantity,
                  p_variant_id: null,
                  p_order_id: item.id,
                  p_reason: newStatus === 'CANCELLED' ? 'order_cancelled' : 'order_returned',
                });
              } catch (e) {
                console.warn('[orders] bulk restock warning:', e);
              }
            }
          }
        }
      }

      const { error: bulkErr } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .in('id', orderIds)
        .eq('account_id', accountId);

      if (bulkErr) {
        return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: orderIds.length, status: newStatus });
    }

    // Check if order is being Cancelled or Returned - restore stock atomically!
    if (
      (body.status === 'CANCELLED' || body.status === 'RETURNED') &&
      existingOrder.product_id &&
      existingOrder.status !== 'CANCELLED' &&
      existingOrder.status !== 'RETURNED'
    ) {
      try {
        await supabase.rpc('increment_product_stock', {
          p_product_id: existingOrder.product_id,
          p_quantity: existingOrder.quantity,
          p_variant_id: null,
          p_order_id: existingOrder.id,
          p_reason: body.status === 'CANCELLED' ? 'order_cancelled' : 'order_returned',
        });
      } catch (restockErr) {
        console.warn('[orders] stock restore warning:', restockErr);
      }
    }

    // Regular field updates (including comprehensive order edits)
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.risk_level !== undefined) updates.risk_level = body.risk_level;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.advance_paid !== undefined) updates.advance_paid = Number(body.advance_paid);
    if (body.advance_trx_id !== undefined) updates.advance_trx_id = body.advance_trx_id;
    if (body.advance_method !== undefined) updates.advance_method = body.advance_method;
    if (body.advance_status !== undefined) updates.advance_status = body.advance_status;

    // Editable order details
    if (body.customer_name !== undefined) updates.customer_name = String(body.customer_name).trim();
    if (body.customer_phone !== undefined) updates.customer_phone = String(body.customer_phone).trim();
    if (body.customer_address !== undefined) updates.customer_address = String(body.customer_address).trim();
    if (body.thana !== undefined) updates.thana = body.thana?.trim() || null;
    if (body.district !== undefined) updates.district = body.district?.trim() || null;
    if (body.product_name !== undefined) updates.product_name = String(body.product_name).trim();
    if (body.variant !== undefined) updates.variant = body.variant?.trim() || null;
    if (body.quantity !== undefined) updates.quantity = Number(body.quantity) || 1;
    if (body.unit_price !== undefined) updates.unit_price = Number(body.unit_price) || 0;
    if (body.delivery_charge !== undefined) updates.delivery_charge = Number(body.delivery_charge) || 0;
    if (body.total_amount !== undefined) updates.total_amount = Number(body.total_amount) || 0;

    const { data: order, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', body.id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[orders] update error:', error);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order });
  } catch (err) {
    return toErrorResponse(err);
  }
}
