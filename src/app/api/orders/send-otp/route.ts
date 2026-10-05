import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { sendOrderConfirmationOtp } from '@/lib/sms/sms-service';

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent');
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data: order, error } = await db
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('account_id', accountId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.customer_phone) {
      return NextResponse.json({ error: 'Customer phone number is missing' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'wacrm.live';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    const result = await sendOrderConfirmationOtp({
      accountId,
      orderId: order.id,
      phone: order.customer_phone,
      customerName: order.customer_name || undefined,
      invoiceNo: order.invoice_no || undefined,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      otp: result.otp,
      confirmUrl: result.confirmUrl,
      message: 'OTP ও কনফার্মেশন লিঙ্ক SMS এর মাধ্যমে সফলভাবে পাঠানো হয়েছে!',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
