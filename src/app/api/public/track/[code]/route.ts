import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;

    if (!code) {
      return NextResponse.json({ error: 'Tracking code is required' }, { status: 400 });
    }

    const db = supabaseAdmin();
    const cleanCode = decodeURIComponent(code).trim();

    // Look up by courier_tracking_code, invoice_no, or id
    const { data: order, error } = await db
      .from('orders')
      .select('id, account_id, invoice_no, customer_name, customer_phone, shipping_address, total_amount, advance_paid, status, courier_status, courier_provider, courier_tracking_code, created_at, updated_at')
      .or(`courier_tracking_code.eq.${cleanCode},invoice_no.eq.${cleanCode},id.eq.${cleanCode}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    // Store branding
    const { data: store } = await db
      .from('business_settings')
      .select('store_name, logo_url, tagline, support_phone, currency_symbol')
      .eq('account_id', order.account_id)
      .single();

    // Mask phone for privacy (e.g. 017****1234)
    const rawPhone = order.customer_phone || '';
    const maskedPhone =
      rawPhone.length > 6
        ? `${rawPhone.slice(0, 3)}****${rawPhone.slice(-4)}`
        : rawPhone;

    return NextResponse.json({
      order: {
        ...order,
        customer_phone: maskedPhone,
      },
      store: store || {
        store_name: 'WACRM Store',
        currency_symbol: '৳',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
