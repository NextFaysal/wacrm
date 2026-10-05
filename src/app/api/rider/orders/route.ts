import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { notifyCustomerCourierUpdate } from '@/lib/courier/notify';

/**
 * GET /api/rider/orders
 * Returns orders assigned to the delivery rider or parcels currently out for delivery.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('riderPhone')?.trim();
    const pin = searchParams.get('pin')?.trim();

    const db = supabaseAdmin();

    let rider: any = null;
    let accountId: string | null = null;

    if (phone) {
      const { data: matchedRider } = await db
        .from('delivery_riders')
        .select('*')
        .eq('phone', phone)
        .eq('status', 'active')
        .maybeSingle();

      if (matchedRider) {
        if (pin && matchedRider.pin_code && matchedRider.pin_code !== pin) {
          return NextResponse.json({ error: 'ভুল পিন কোড (Invalid PIN)' }, { status: 401 });
        }
        rider = matchedRider;
        accountId = matchedRider.account_id;
      }
    }

    // If no specific rider found or demo mode, load out for delivery orders
    let query = db
      .from('orders')
      .select('id, invoice_no, customer_name, customer_phone, customer_address, total_amount, advance_paid, status, delivery_notes, rider_name, rider_phone, rider_collected_amount, created_at')
      .in('status', ['OUT_FOR_DELIVERY', 'CONFIRMED', 'PROCESSING', 'DELIVERED', 'FAILED_DELIVERY'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (rider?.id) {
      query = query.or(`rider_id.eq.${rider.id},status.eq.OUT_FOR_DELIVERY`);
    } else if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: orders, error: ordErr } = await query;
    if (ordErr) throw ordErr;

    const orderList = orders || [];
    let codToCollect = 0;
    let completedCount = 0;
    let pendingCount = 0;

    for (const ord of orderList) {
      const total = Number(ord.total_amount) || 0;
      const adv = Number(ord.advance_paid) || 0;
      const due = Math.max(0, total - adv);

      if (ord.status === 'DELIVERED') {
        completedCount++;
      } else {
        pendingCount++;
        codToCollect += due;
      }
    }

    return NextResponse.json({
      success: true,
      rider: rider || {
        name: 'এক্সপ্রেস রাইডার (Express Runner)',
        phone: phone || '01700000000',
        vehicle_type: 'bike',
      },
      stats: {
        totalOrders: orderList.length,
        completedCount,
        pendingCount,
        codToCollect,
      },
      orders: orderList,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/rider/orders
 * Updates delivery status (Delivered / Failed / Rescheduled) and logs COD cash collection.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body?.orderId || !body?.action) {
      return NextResponse.json({ error: 'orderId and action are required' }, { status: 400 });
    }

    const { orderId, action, collectedAmount, notes = '', riderPhone } = body;
    const db = supabaseAdmin();

    const { data: order, error: ordErr } = await db
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (ordErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'delivered') {
      updates.status = 'DELIVERED';
      updates.delivered_by_rider_at = new Date().toISOString();
      updates.rider_collected_amount = Number(collectedAmount) || (Number(order.total_amount) - Number(order.advance_paid || 0));
      updates.rider_notes = notes.trim();

      // Update rider total deliveries counter if rider is registered
      if (riderPhone) {
        try {
          const { data: rRow } = await db
            .from('delivery_riders')
            .select('id, total_deliveries')
            .eq('phone', riderPhone)
            .maybeSingle();

          if (rRow) {
            await db
              .from('delivery_riders')
              .update({ total_deliveries: (rRow.total_deliveries || 0) + 1 })
              .eq('id', rRow.id);
          }
        } catch {
          // ignore
        }
      }

      // Notify customer with 1-click review link with ৳100 discount coupon
      try {
        await notifyCustomerCourierUpdate(db, order, 'DELIVERED');
      } catch (e) {
        console.warn('[rider-api] notify error:', e);
      }

    } else if (action === 'failed') {
      updates.status = 'FAILED_DELIVERY';
      updates.rider_notes = notes.trim();

      try {
        await notifyCustomerCourierUpdate(db, order, 'FAILED_DELIVERY');
      } catch (e) {
        console.warn('[rider-api] notify error:', e);
      }

    } else if (action === 'out_for_delivery') {
      updates.status = 'OUT_FOR_DELIVERY';
      try {
        await notifyCustomerCourierUpdate(db, order, 'OUT_FOR_DELIVERY');
      } catch (e) {
        console.warn('[rider-api] notify error:', e);
      }
    }

    const { data: updatedOrder, error: updateErr } = await db
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
