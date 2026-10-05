import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { sendSms } from '@/lib/sms/sms-service';

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const { phone, message, orderId } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
    }

    const result = await sendSms({
      accountId,
      phone,
      message,
      orderId: orderId || null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, provider: result.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
