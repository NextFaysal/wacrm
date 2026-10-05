import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { verifyOrderConfirmation } from '@/lib/sms/sms-service';

export async function POST(request: Request) {
  try {
    const { token, otp, orderId } = await request.json();

    const tokenOrOtp = token || otp;
    if (!tokenOrOtp) {
      return NextResponse.json({ error: 'Token or OTP is required' }, { status: 400 });
    }

    const result = await verifyOrderConfirmation({
      tokenOrOtp,
      orderId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Verification failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, orderId: result.orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
