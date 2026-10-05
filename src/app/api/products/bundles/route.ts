import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/products/bundles
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data, error } = await supabase
      .from('product_bundles')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code !== 'PGRST205') {
        console.warn('[bundles] fetch error:', error);
      }
      return NextResponse.json({ bundles: [] });
    }

    return NextResponse.json({ bundles: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/products/bundles
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.name?.trim() || !body?.price) {
      return NextResponse.json({ error: 'Bundle name and price are required' }, { status: 400 });
    }

    const name = body.name.trim();
    const slug = (body.slug?.trim() || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + `-${Math.random().toString(36).substring(2, 6)}`;

    const { data, error } = await supabase
      .from('product_bundles')
      .insert({
        account_id: accountId,
        name,
        slug,
        price: Number(body.price) || 0,
        regular_price: body.regular_price ? Number(body.regular_price) : null,
        image_url: body.image_url?.trim() || null,
        description: body.description?.trim() || null,
        badge_text: body.badge_text?.trim() || 'COMBO DEAL',
        items: Array.isArray(body.items) ? body.items : [],
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[bundles] insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bundle: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/products/bundles?id=<id>
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Bundle ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('product_bundles')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    return toErrorResponse(err);
  }
}
