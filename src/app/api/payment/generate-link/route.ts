import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { createDynamicPaymentLink } from '@/lib/payment/link-service';

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const body = await request.json();

    const {
      orderId,
      conversationId,
      amount,
      currency,
      purpose,
      customerName,
      customerPhone,
    } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    if (!customerPhone) {
      return NextResponse.json({ error: 'Customer phone number is required' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'wacrm.live';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const result = await createDynamicPaymentLink({
      accountId,
      orderId: orderId || null,
      conversationId: conversationId || null,
      amount: Number(amount),
      currency: currency || 'BDT',
      purpose: purpose || 'advance_payment',
      customerName: customerName || null,
      customerPhone: String(customerPhone).trim(),
      baseUrl,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
