import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/products/categories
 * List product categories for the account.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('account_id', accountId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      // Table might not exist yet or no rows
      console.warn('[categories] fetch error:', error);
      return NextResponse.json({ categories: [] });
    }

    return NextResponse.json({ categories: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/products/categories
 * Create a new category.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const name = body.name.trim();
    const slug = (body.slug?.trim() || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        account_id: accountId,
        name,
        slug,
        icon: body.icon?.trim() || 'Package',
        description: body.description?.trim() || null,
        display_order: Number(body.display_order) || 0,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[categories] insert error:', error);
      return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/products/categories?id=<categoryId>
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    return toErrorResponse(err);
  }
}
