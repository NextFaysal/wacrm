import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { dispatchCourierOrder } from '@/lib/courier/dispatch';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';

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
      const provider = (body.provider as 'steadfast' | 'pathao') || 'steadfast';
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

    // Regular field updates
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
