import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export async function GET(request: Request) {
  try {
    const admin = supabaseAdmin();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const { data: reviews, error } = await admin
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[public-reviews] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    return NextResponse.json({ reviews: reviews || [] });
  } catch (err) {
    console.error('[public-reviews] fatal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
