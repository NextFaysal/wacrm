import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug or ID is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Try finding by slug first, then by UUID id
    let query = admin
      .from('products')
      .select('*')
      .eq('is_active', true);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    if (isUuid) {
      query = query.or(`slug.eq.${slug},id.eq.${slug}`);
    } else {
      query = query.eq('slug', slug);
    }

    const { data: product, error } = await query.maybeSingle();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch business settings for branding and spec labels
    const { data: business } = await admin
      .from('business_settings')
      .select('*')
      .eq('account_id', product.account_id)
      .maybeSingle();

    // Fetch active reviews for this product
    const { data: reviews } = await admin
      .from('product_reviews')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      product,
      reviews: reviews || [],
      business: business || {
        store_name: 'Online Store',
        business_type: 'general',
        tagline: 'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
        spec_label_1: 'মডেল / কোড',
        spec_label_2: 'ম্যাটেরিয়াল / উপাদান',
        spec_label_3: 'সাইজ / পরিমাপ',
        spec_label_4: 'ওয়ারেন্টি / গ্যারান্টি',
        feature_1_title: 'ক্যাশ অন ডেলিভারি',
        feature_1_subtitle: 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ',
        feature_2_title: 'সুপারফাস্ট ডেলিভারি',
        feature_2_subtitle: 'সারাদেশে দ্রুত হোম ডেলিভারি',
        feature_3_title: '১০০% অরিজিনাল',
        feature_3_subtitle: 'নিখুঁত কোয়ালিটি গ্যারান্টি',
        announcement_text: '🔥 সীমিত সময়ের স্পেশাল অফার! পার্সেল হাতে পেয়ে খুলে দেখে মূল্য পরিশোধের ১০০% সুযোগ!',
        announcement_enabled: true,
      },
    });
  } catch (err) {
    console.error('[public-product] fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
