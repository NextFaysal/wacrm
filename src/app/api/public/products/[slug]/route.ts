import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

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

    return NextResponse.json({ product });
  } catch (err) {
    console.error('[public-product] fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
