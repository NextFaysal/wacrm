import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import type { BusinessSettings } from '@/types/business';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug?: string }> }
) {
  try {
    const { slug } = await params;
    const admin = supabaseAdmin();

    let business: BusinessSettings | null = null;
    let accountId: string | null = null;

    if (slug && slug !== 'default') {
      // Find business settings by store_slug
      const { data: bData } = await admin
        .from('business_settings')
        .select('*')
        .eq('store_slug', slug)
        .maybeSingle();

      if (bData) {
        business = bData;
        accountId = bData.account_id;
      }
    }

    // Fallback: if no store_slug match, or no slug provided, take the first business_settings or first account
    if (!business) {
      const { data: bFallback } = await admin
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (bFallback) {
        business = bFallback;
        accountId = bFallback.account_id;
      } else {
        const { data: acc } = await admin.from('accounts').select('id, name').limit(1).maybeSingle();
        if (acc) {
          accountId = acc.id;
          business = {
            id: 'default',
            account_id: acc.id,
            store_name: acc.name || 'Online Store',
            business_type: 'general',
            tagline: 'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
            hero_title: 'আমাদের এক্সক্লুসিভ কালেকশন',
            hero_subtitle: 'পছন্দের পণ্যটি অর্ডার করুন ক্যাশ অন ডেলিভারিতে',
            logo_url: null,
            banner_url: null,
            store_slug: 'default',
            support_phone: null,
            support_email: null,
            whatsapp_number: null,
            address: null,
            currency_symbol: '৳',
            primary_color: '#f59e0b',
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
            announcement_text: '🔥 সীমিত সময়ের স্পেশাল অফার! দ্রুত অর্ডার কনফার্ম করুন!',
            announcement_enabled: true,
          };
        }
      }
    }

    if (!accountId) {
      return NextResponse.json({
        business: null,
        products: [],
        categories: [],
      });
    }

    // Fetch active products for this account
    const { data: products, error: prodErr } = await admin
      .from('products')
      .select('id, name, sku, slug, price, regular_price, image_url, images, category, stock_quantity, low_stock_threshold, badge_text, view_count, total_sold, colors, variants, is_active, created_at')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (prodErr) {
      console.error('[public-store] products query error:', prodErr);
    }

    // Fetch active product bundles
    const { data: bundles } = await admin
      .from('product_bundles')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Extract categories
    const categoriesSet = new Set<string>();
    (products || []).forEach((p) => {
      if (p.category && p.category.trim()) {
        categoriesSet.add(p.category.trim());
      }
    });

    return NextResponse.json({
      success: true,
      business,
      products: products || [],
      bundles: bundles || [],
      categories: Array.from(categoriesSet),
    });
  } catch (err) {
    console.error('[public-store] error:', err);
    return NextResponse.json({ error: 'Failed to load store data' }, { status: 500 });
  }
}
