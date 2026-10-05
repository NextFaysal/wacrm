import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * POST /api/products/bulk
 * Bulk insert or update products from CSV/Excel import.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    const itemsToInsert = body.items.map((item: any) => {
      const name = (item.name || 'Untitled Product').trim();
      const baseSlug = (item.slug?.trim() || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;

      return {
        account_id: accountId,
        name,
        sku: item.sku?.trim() || null,
        barcode: item.barcode?.trim() || null,
        slug,
        price: Number(item.price) || 0,
        regular_price: item.regular_price ? Number(item.regular_price) : null,
        cost_price: item.cost_price ? Number(item.cost_price) : 0,
        stock_quantity: Math.max(0, Number(item.stock_quantity) || 10),
        low_stock_threshold: Number(item.low_stock_threshold) || 5,
        category: item.category?.trim() || 'General',
        unit: item.unit?.trim() || 'pcs',
        badge_text: item.badge_text?.trim() || null,
        description: item.description?.trim() || null,
        image_url: item.image_url?.trim() || null,
        images: item.image_url ? [item.image_url.trim()] : [],
        is_active: item.is_active !== undefined ? Boolean(item.is_active) : true,
      };
    });

    const { data, error } = await supabase
      .from('products')
      .insert(itemsToInsert)
      .select('id, name, sku, price, stock_quantity');

    if (error) {
      console.error('[bulk-products] error:', error);
      return NextResponse.json({ error: error.message || 'Failed to import products' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported_count: data?.length || 0,
      products: data,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
