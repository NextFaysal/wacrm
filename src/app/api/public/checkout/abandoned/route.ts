import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { validateBDPhone } from '@/lib/ai/agent/risk-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const admin = supabaseAdmin();
    const body = await request.json().catch(() => null);

    if (!body?.customerPhone?.trim()) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }

    const phoneVal = validateBDPhone(body.customerPhone.trim());
    if (!phoneVal.valid || !phoneVal.normalized) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }
    const phone = phoneVal.normalized;

    // Fetch product to get account_id and product name
    let prodQuery = admin.from('products').select('id, name, account_id, price');
    if (body.productId) {
      prodQuery = prodQuery.eq('id', body.productId);
    } else if (body.slug) {
      prodQuery = prodQuery.eq('slug', body.slug);
    } else {
      return NextResponse.json({ error: 'Product reference missing' }, { status: 400 });
    }

    const { data: product, error: prodErr } = await prodQuery.maybeSingle();
    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check if an existing abandoned lead exists in the last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from('abandoned_checkouts')
      .select('id, recovered')
      .eq('account_id', product.account_id)
      .eq('customer_phone', phone)
      .gt('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.recovered) {
        return NextResponse.json({ success: true, message: 'Already recovered' });
      }
      // Update details
      await admin
        .from('abandoned_checkouts')
        .update({
          customer_name: body.customerName?.trim() || null,
          customer_address: body.customerAddress?.trim() || null,
          variant: body.variant || 'Standard',
          quantity: Number(body.quantity) || 1,
          total_amount: Number(body.totalAmount) || Number(product.price) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      return NextResponse.json({ success: true, leadId: existing.id, updated: true });
    }

    // Insert new abandoned checkout lead
    const { data: inserted, error: insertErr } = await admin
      .from('abandoned_checkouts')
      .insert({
        account_id: product.account_id,
        product_id: product.id,
        product_name: product.name,
        customer_name: body.customerName?.trim() || null,
        customer_phone: phone,
        customer_address: body.customerAddress?.trim() || null,
        variant: body.variant || 'Standard',
        quantity: Number(body.quantity) || 1,
        total_amount: Number(body.totalAmount) || Number(product.price) || 0,
        recovered: false,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[abandoned-checkout] Insert error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, leadId: inserted.id }, { status: 201 });
  } catch (err: any) {
    console.error('[abandoned-checkout] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
