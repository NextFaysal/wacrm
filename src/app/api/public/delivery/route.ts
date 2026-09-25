import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const accountIdParam = searchParams.get('account_id');

    const admin = supabaseAdmin();
    let accountId = accountIdParam;

    // If slug provided, lookup account_id from product
    if (!accountId && slug) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      const query = admin.from('products').select('account_id').eq('is_active', true);
      const { data: prod } = await (isUuid ? query.eq('id', slug) : query.eq('slug', slug)).maybeSingle();
      if (prod?.account_id) {
        accountId = prod.account_id;
      }
    }

    // Fallback: pick the first account if still unknown
    if (!accountId) {
      const { data: acc } = await admin.from('accounts').select('id').limit(1).maybeSingle();
      accountId = acc?.id || null;
    }

    if (!accountId) {
      return NextResponse.json({
        zones: [
          { id: '1', name: 'ঢাকার ভেতরে', code: 'inside_dhaka', charge: 100, is_free: false, estimated_time: '২৪ - ৪৮ ঘণ্টা' },
          { id: '2', name: 'ঢাকার বাইরে', code: 'outside_dhaka', charge: 150, is_free: false, estimated_time: '২ - ৩ কার্যদিবস' },
        ],
        settings: {
          free_delivery_global: false,
          free_delivery_min_qty: 2,
          free_delivery_min_amount: 0,
          free_delivery_banner_text: '🎁 ধামাকা অফার: ২ বা ততোধিক পিস অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি!',
        },
      });
    }

    const [{ data: zones }, { data: settings }] = await Promise.all([
      admin
        .from('delivery_zones')
        .select('id, name, code, charge, is_free, estimated_time, sort_order')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      admin
        .from('delivery_settings')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);

    const resolvedSettings = settings || {
      free_delivery_global: false,
      free_delivery_min_qty: 2,
      free_delivery_min_amount: 0,
      free_delivery_banner_text: '🎁 ধামাকা অফার: ২ বা ততোধিক পিস অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি!',
      cod_enabled: true,
      advance_charge_required: false,
    };

    return NextResponse.json({
      success: true,
      zones: zones || [],
      settings: resolvedSettings,
    });
  } catch (err: unknown) {
    console.error('[public-delivery] fetch error:', err);
    return NextResponse.json({
      zones: [
        { id: '1', name: 'ঢাকার ভেতরে', code: 'inside_dhaka', charge: 100, is_free: false, estimated_time: '২৪ - ৪৮ ঘণ্টা' },
        { id: '2', name: 'ঢাকার বাইরে', code: 'outside_dhaka', charge: 150, is_free: false, estimated_time: '২ - ৩ কার্যদিবস' },
      ],
      settings: {
        free_delivery_global: false,
        free_delivery_min_qty: 2,
        free_delivery_min_amount: 0,
      },
    });
  }
}
