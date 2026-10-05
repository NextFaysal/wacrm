import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { createBkashPayment } from '@/lib/payment/bkash';

export async function POST(request: Request) {
  try {
    const { paymentToken } = await request.json();

    if (!paymentToken) {
      return NextResponse.json({ error: 'Payment token is required' }, { status: 400 });
    }

    // 1. Fetch payment link
    const { data: link, error: linkErr } = await supabaseAdmin()
      .from('payment_links')
      .select('*, order:orders(*)')
      .eq('payment_token', paymentToken)
      .single();

    if (linkErr || !link) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    }

    if (link.status === 'completed') {
      return NextResponse.json({ error: 'Payment has already been completed' }, { status: 400 });
    }

    // 2. Fetch account's bKash gateway config
    const { data: gateway } = await supabaseAdmin()
      .from('payment_gateways')
      .select('*')
      .eq('account_id', link.account_id)
      .eq('gateway', 'bkash')
      .eq('is_enabled', true)
      .single();

    if (!gateway || !gateway.config?.app_key || !gateway.config?.app_secret) {
      return NextResponse.json(
        {
          error:
            'bKash PGW is not configured or disabled for this merchant. Please use manual bKash or contact the seller.',
        },
        { status: 400 }
      );
    }

    const host = request.headers.get('host') || 'wacrm.live';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const callbackUrl = `${protocol}://${host}/api/payment/bkash/callback?paymentToken=${paymentToken}`;

    const invoiceNumber = link.order?.invoice_no || `INV-${link.payment_token.slice(0, 10)}`;

    const { paymentID, bkashURL, error: bkashErr } = await createBkashPayment(
      {
        app_key: gateway.config.app_key,
        app_secret: gateway.config.app_secret,
        username: gateway.config.username,
        password: gateway.config.password,
        is_sandbox: gateway.is_sandbox,
      },
      {
        amount: Number(link.amount),
        invoiceNumber,
        callbackUrl,
        payerReference: link.customer_phone,
      }
    );

    if (bkashErr || !bkashURL) {
      return NextResponse.json({ error: bkashErr || 'Failed to initialize bKash' }, { status: 500 });
    }

    // Store gateway payment id
    await supabaseAdmin()
      .from('payment_links')
      .update({ gateway_payment_id: paymentID })
      .eq('id', link.id);

    return NextResponse.json({ bkashURL, paymentID });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
