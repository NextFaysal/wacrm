import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params;
    if (!slug) return NextResponse.json({ success: false });

    const admin = supabaseAdmin();

    // Find product id by slug or UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const query = admin.from('products').select('id').eq('is_active', true);
    const { data: prod } = await (isUuid ? query.eq('id', slug) : query.eq('slug', slug)).maybeSingle();

    if (prod?.id) {
      await admin.rpc('increment_product_views', { p_product_id: prod.id });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 200 }); // Never crash on view increment
  }
}
