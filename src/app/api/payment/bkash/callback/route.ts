import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { executeBkashPayment } from '@/lib/payment/bkash';
import { completePaymentLink } from '@/lib/payment/link-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const paymentToken = searchParams.get('paymentToken');
  const paymentID = searchParams.get('paymentID');
  const status = searchParams.get('status');

  const host = request.headers.get('host') || 'wacrm.live';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;

  if (!paymentToken) {
    return NextResponse.redirect(`${baseUrl}/pay/invalid?error=missing_token`);
  }

  const returnUrl = `${baseUrl}/pay/${paymentToken}`;

  if (status === 'cancel' || status === 'failure') {
    return NextResponse.redirect(`${returnUrl}?status=${status}&error=${encodeURIComponent('Payment was cancelled or failed')}`);
  }

  if (status !== 'success' || !paymentID) {
    return NextResponse.redirect(`${returnUrl}?status=error&error=${encodeURIComponent('Invalid payment callback')}`);
  }

  try {
    // 1. Fetch payment link to get account_id
    const { data: link, error: linkErr } = await supabaseAdmin()
      .from('payment_links')
      .select('*')
      .eq('payment_token', paymentToken)
      .single();

    if (linkErr || !link) {
      return NextResponse.redirect(`${returnUrl}?status=error&error=${encodeURIComponent('Payment link not found')}`);
    }

    // 2. Fetch gateway credentials
    const { data: gateway } = await supabaseAdmin()
      .from('payment_gateways')
      .select('*')
      .eq('account_id', link.account_id)
      .eq('gateway', 'bkash')
      .single();

    if (!gateway) {
      return NextResponse.redirect(`${returnUrl}?status=error&error=${encodeURIComponent('Gateway configuration missing')}`);
    }

    // 3. Execute bKash payment to confirm capture
    const execRes = await executeBkashPayment(
      {
        app_key: gateway.config.app_key,
        app_secret: gateway.config.app_secret,
        username: gateway.config.username,
        password: gateway.config.password,
        is_sandbox: gateway.is_sandbox,
      },
      paymentID
    );

    if (!execRes.success || !execRes.trxID) {
      return NextResponse.redirect(
        `${returnUrl}?status=failed&error=${encodeURIComponent(execRes.error || 'bKash transaction verification failed')}`
      );
    }

    // 4. Complete payment link & update order & dispatch CAPI & send auto-receipt
    await completePaymentLink({
      paymentToken,
      paymentMethod: 'bkash',
      trxId: execRes.trxID,
      amount: execRes.amount,
      gatewayPaymentId: paymentID,
      gatewayResponse: execRes.data as unknown as Record<string, unknown>,
    });

    return NextResponse.redirect(`${returnUrl}?status=success&trxId=${execRes.trxID}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown execution error';
    return NextResponse.redirect(`${returnUrl}?status=error&error=${encodeURIComponent(errorMsg)}`);
  }
}
