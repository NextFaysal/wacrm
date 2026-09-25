import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { getTrackingUrl } from '@/lib/courier/utils';

export async function GET(
  _request: Request,
  props: { params: Promise<{ invoiceNo: string }> }
) {
  try {
    const { invoiceNo } = await props.params;
    if (!invoiceNo) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const cleanNo = decodeURIComponent(invoiceNo).trim();

    // Query order by invoice_no or ID prefix
    let orderQuery = admin
      .from('orders')
      .select(`
        id,
        invoice_no,
        product_name,
        variant,
        quantity,
        unit_price,
        delivery_charge,
        total_amount,
        advance_paid,
        customer_name,
        customer_phone,
        customer_address,
        thana,
        district,
        status,
        courier_provider,
        courier_tracking_code,
        courier_status,
        created_at,
        notes
      `);

    if (cleanNo.toUpperCase().startsWith('INV-')) {
      orderQuery = orderQuery.eq('invoice_no', cleanNo);
    } else {
      orderQuery = orderQuery.or(`invoice_no.eq.${cleanNo},id.eq.${cleanNo}`);
    }

    const { data: orders, error } = await orderQuery.limit(1);

    if (error) {
      console.error('[invoice-api] query error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const order = orders?.[0];
    if (!order) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const totalAmount = Number(order.total_amount) || 0;
    const advancePaid = Number(order.advance_paid) || 0;
    const codDue = Math.max(0, totalAmount - advancePaid);
    const unitPrice = Number(order.unit_price) || 0;
    const qty = Number(order.quantity) || 1;
    const subtotal = unitPrice * qty;

    const trackingUrl =
      order.courier_provider && order.courier_tracking_code
        ? getTrackingUrl(order.courier_provider as any, order.courier_tracking_code)
        : null;

    // Public invoice payload (sanitized)
    const invoiceData = {
      id: order.id,
      invoiceNo: order.invoice_no || `INV-${order.id.slice(0, 8).toUpperCase()}`,
      createdAt: order.created_at,
      status: order.status,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        address: order.customer_address,
        thana: order.thana,
        district: order.district,
      },
      item: {
        productName: order.product_name,
        variant: order.variant || 'Standard',
        quantity: qty,
        unitPrice,
        subtotal,
      },
      pricing: {
        subtotal,
        deliveryCharge: Number(order.delivery_charge) || 0,
        totalAmount,
        advancePaid,
        codDue,
      },
      courier: {
        provider: order.courier_provider,
        trackingCode: order.courier_tracking_code,
        status: order.courier_status,
        trackingUrl,
      },
      store: {
        name: 'Watch Gallery BD',
        phone: '+880 1800-000000',
        warranty: '১ বছর মেশিন এবং কালার ওয়ারেন্টি',
        supportEmail: 'support@watchgallerybd.com',
      },
    };

    return NextResponse.json(invoiceData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
