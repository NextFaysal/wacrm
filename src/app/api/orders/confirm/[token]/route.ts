import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data: conf, error } = await db
      .from('order_confirmations')
      .select('*, order:orders(*)')
      .eq('confirmation_token', token)
      .single();

    if (error || !conf) {
      return NextResponse.json({ error: 'Confirmation link not found or expired' }, { status: 404 });
    }

    const { data: store } = await db
      .from('business_settings')
      .select('store_name, logo_url, tagline, support_phone, currency_symbol')
      .eq('account_id', conf.account_id)
      .single();

    return NextResponse.json({
      confirmation: conf,
      order: conf.order,
      store: store || { store_name: 'WACRM Store', currency_symbol: '৳' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
