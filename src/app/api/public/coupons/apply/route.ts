import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export async function POST(request: Request) {
  try {
    const admin = supabaseAdmin();
    const body = await request.json().catch(() => null);

    const code = body?.code ? String(body.code).trim().toUpperCase() : '';
    const amount = Number(body?.amount) || 0;
    const accountId = body?.accountId;

    if (!code) {
      return NextResponse.json({ error: 'কুপন কোড প্রদান করুন' }, { status: 400 });
    }

    let query = admin
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('is_active', true);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: coupon, error } = await query.maybeSingle();

    if (error || !coupon) {
      return NextResponse.json({ error: 'কুপন কোডটি সঠিক নয় অথবা মেয়াদ শেষ হয়ে গেছে' }, { status: 404 });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'এই কুপনের মেয়াদ শেষ হয়ে গেছে' }, { status: 400 });
    }

    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return NextResponse.json({ error: 'এই কুপনের সর্বোচ্চ ব্যবহারের সীমা শেষ হয়েছে' }, { status: 400 });
    }

    if (coupon.min_order_amount && amount < Number(coupon.min_order_amount)) {
      return NextResponse.json(
        { error: `এই কুপনটি ব্যবহার করতে ন্যূনতম ৳${Number(coupon.min_order_amount).toLocaleString('en-BD')} এর অর্ডার করতে হবে` },
        { status: 400 }
      );
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(amount, Number(coupon.discount_value));
    } else if (coupon.discount_type === 'percentage') {
      discountAmount = Math.round((amount * Number(coupon.discount_value)) / 100);
      if (coupon.max_discount && discountAmount > Number(coupon.max_discount)) {
        discountAmount = Number(coupon.max_discount);
      }
    }

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        discountAmount,
      },
    });
  } catch (err) {
    console.error('[coupon-apply] error:', err);
    return NextResponse.json({ error: 'কুপন যাচাই করতে সমস্যা হয়েছে' }, { status: 500 });
  }
}
