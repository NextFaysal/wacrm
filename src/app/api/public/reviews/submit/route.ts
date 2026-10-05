import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function POST(request: Request) {
  try {
    const { token, rating, reviewText, customerName, customerCity, photoUrls, imageUrl } = await request.json();

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return NextResponse.json({ error: 'Valid rating (1-5 stars) is required' }, { status: 400 });
    }

    if (!reviewText || String(reviewText).trim().length < 3) {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 });
    }

    const db = supabaseAdmin();
    let order: Record<string, unknown> | null = null;
    let productId: string | null = null;
    let accountId: string | null = null;

    if (token) {
      // Find order by review_token or id
      const { data: matchedOrder } = await db
        .from('orders')
        .select('*')
        .or(`review_token.eq.${token},id.eq.${token}`)
        .maybeSingle();

      if (matchedOrder) {
        order = matchedOrder;
        productId = matchedOrder.product_id;
        accountId = matchedOrder.account_id;
      }
    }

    // If order was not found by token, look up product from body if provided
    if (!productId || !accountId) {
      const { data: firstProd } = await db
        .from('products')
        .select('id, account_id')
        .limit(1)
        .single();

      if (!firstProd) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      productId = firstProd.id;
      accountId = firstProd.account_id;
    }

    // 1. Insert product review
    const { data: newReview, error: revErr } = await db
      .from('product_reviews')
      .insert({
        account_id: accountId,
        product_id: productId,
        order_id: order?.id || null,
        customer_name: customerName || (order?.customer_name as string) || 'Verified Customer',
        customer_city: customerCity || 'Dhaka',
        customer_phone: order?.customer_phone as string | undefined,
        rating: Number(rating),
        review_text: String(reviewText).trim(),
        image_url: imageUrl || photoUrls?.[0] || null,
        photo_urls: photoUrls || [],
        is_verified_purchase: !!order,
        is_active: true,
      })
      .select('*')
      .single();

    if (revErr) {
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }

    // 2. Mark order review as submitted
    if (order?.id) {
      await db
        .from('orders')
        .update({
          review_submitted_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }

    // 3. Guarantee a reward coupon for the reviewer
    const rewardCoupon = 'THANKYOU100';

    return NextResponse.json({
      success: true,
      review: newReview,
      rewardCoupon,
      message: 'রিভিউ দেওয়ার জন্য আন্তরিক ধন্যবাদ! পরবর্তী কেনাকাটায় ৳১০০ ডিসকাউন্ট উপভোগ করুন।',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
