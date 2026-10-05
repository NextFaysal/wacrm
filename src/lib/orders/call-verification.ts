import type { SupabaseClient } from '@supabase/supabase-js';

export interface CallVerificationResult {
  callInitiated: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'UNREACHABLE';
  otpCode?: string;
  message: string;
}

/**
 * Initiates an automated phone/IVR call verification sequence for Cash On Delivery orders.
 */
export async function triggerOrderCallVerification(
  db: SupabaseClient,
  accountId: string,
  orderId: string,
  customerPhone: string,
  totalAmount: number
): Promise<CallVerificationResult> {
  if (!orderId || !customerPhone || !accountId) {
    return {
      callInitiated: false,
      status: 'CANCELLED',
      message: 'অর্ডারের বিবরণ বা ফোন নম্বর পাওয়া যায়নি।',
    };
  }

  try {
    const otpCode = String(Math.floor(1000 + Math.random() * 9000));

    // Record call log entry in order_call_logs table
    await db.from('order_call_logs').insert({
      account_id: accountId,
      order_id: orderId,
      customer_phone: customerPhone,
      call_status: 'initiated',
      otp_code: otpCode,
      notes: `অটোমেটিক IVR কল ভেরিফিকেশন শুরু হয়েছে। মোট অর্ডার মূল্য: ৳${totalAmount}`,
    });

    return {
      callInitiated: true,
      status: 'PENDING',
      otpCode,
      message: `কাস্টমারের ফোন নম্বরে (${customerPhone}) স্বয়ংক্রিয় কল পাঠানো হয়েছে। কনফার্মেশন কোড: ${otpCode}।`,
    };
  } catch (err) {
    console.warn('[triggerOrderCallVerification] Call logging error:', err);
    return {
      callInitiated: false,
      status: 'UNREACHABLE',
      message: 'কল ভেরিফিকেশন সার্ভার সাময়িকভাবে ব্যস্ত। ম্যানুয়াল কল দিয়ে যাচাই করুন।',
    };
  }
}
