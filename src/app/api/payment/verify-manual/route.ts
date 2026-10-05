import { NextResponse } from 'next/server';
import { completePaymentLink } from '@/lib/payment/link-service';

export async function POST(request: Request) {
  try {
    const { paymentToken, trxId, paymentMethod, senderNumber } = await request.json();

    if (!paymentToken) {
      return NextResponse.json({ error: 'Payment token is required' }, { status: 400 });
    }

    if (!trxId || String(trxId).trim().length < 4) {
      return NextResponse.json({ error: 'Valid Transaction ID (TrxID) is required' }, { status: 400 });
    }

    const cleanTrxId = String(trxId).trim().toUpperCase();
    const method = paymentMethod || 'bkash';

    const result = await completePaymentLink({
      paymentToken,
      paymentMethod: method,
      trxId: cleanTrxId,
      gatewayResponse: {
        manual_submission: true,
        sender_number: senderNumber || null,
        submitted_at: new Date().toISOString(),
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to complete payment' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'পেমেন্ট ভেরিফিকেশন সফল হয়েছে!',
      paymentLink: result.paymentLink,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
