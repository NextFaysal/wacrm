import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/products
 * List products for the account with optional category & search filter.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('products')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[products] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json({ products: data || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/products
 * Create a new product.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.name || !body?.price) {
      return NextResponse.json(
        { error: 'Product name and price are required' },
        { status: 400 }
      );
    }

    const baseSlug = (body.slug?.trim() || body.name.trim())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;

    const imagesArray = Array.isArray(body.images)
      ? body.images.filter((url: string) => typeof url === 'string' && url.trim().length > 0)
      : body.image_url
      ? [body.image_url.trim()]
      : [];

    const { data, error } = await supabase
      .from('products')
      .insert({
        account_id: accountId,
        name: body.name.trim(),
        sku: body.sku?.trim() || null,
        slug,
        price: Number(body.price) || 0,
        regular_price: body.regular_price ? Number(body.regular_price) : null,
        cost_price: body.cost_price !== undefined && body.cost_price !== '' ? Number(body.cost_price) : 0,
        barcode: body.barcode?.trim() || null,
        unit: body.unit?.trim() || 'pcs',
        custom_attributes: Array.isArray(body.custom_attributes) ? body.custom_attributes : [],
        image_url: body.image_url?.trim() || (imagesArray[0] || null),
        images: imagesArray,
        video_url: body.video_url?.trim() || null,
        category: body.category?.trim() || 'General',
        dial_size: body.dial_size?.trim() || null,
        water_resistance: body.water_resistance?.trim() || null,
        movement: body.movement?.trim() || null,
        strap_type: body.strap_type?.trim() || null,
        colors: Array.isArray(body.colors) ? body.colors : [],
        warranty_months: Number(body.warranty_months) || 12,
        stock_quantity: Number(body.stock_quantity) || 10,
        low_stock_threshold: Number(body.low_stock_threshold) || 5,
        variants: Array.isArray(body.variants) ? body.variants : [],
        tier_pricing: Array.isArray(body.tier_pricing) ? body.tier_pricing : [],
        badge_text: body.badge_text?.trim() || null,
        description: body.description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[products] insert error:', error);
      return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
    }

    // Log initial stock
    if (data && data.stock_quantity > 0) {
      await supabase.from('product_stock_logs').insert({
        account_id: accountId,
        product_id: data.id,
        change_qty: data.stock_quantity,
        previous_stock: 0,
        new_stock: data.stock_quantity,
        reason: 'bulk_restock',
      });
    }

    return NextResponse.json({ success: true, product: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PATCH /api/products
 * Update product fields (e.g. stock, price, status, specs, variants).
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.sku !== undefined) updates.sku = body.sku?.trim() || null;
    if (body.barcode !== undefined) updates.barcode = body.barcode?.trim() || null;
    if (body.slug !== undefined) updates.slug = body.slug?.trim();
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.regular_price !== undefined) updates.regular_price = body.regular_price ? Number(body.regular_price) : null;
    if (body.cost_price !== undefined) updates.cost_price = body.cost_price !== '' ? Number(body.cost_price) : 0;
    if (body.unit !== undefined) updates.unit = body.unit?.trim() || 'pcs';
    if (body.stock_quantity !== undefined) updates.stock_quantity = Math.max(0, Number(body.stock_quantity));
    if (body.low_stock_threshold !== undefined) updates.low_stock_threshold = Number(body.low_stock_threshold);
    if (body.variants !== undefined && Array.isArray(body.variants)) updates.variants = body.variants;
    if (body.custom_attributes !== undefined && Array.isArray(body.custom_attributes)) updates.custom_attributes = body.custom_attributes;
    if (body.tier_pricing !== undefined && Array.isArray(body.tier_pricing)) updates.tier_pricing = body.tier_pricing;
    if (body.badge_text !== undefined) updates.badge_text = body.badge_text?.trim() || null;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.category !== undefined) updates.category = body.category;
    if (body.image_url !== undefined) updates.image_url = body.image_url?.trim() || null;
    if (body.images !== undefined && Array.isArray(body.images)) updates.images = body.images;
    if (body.video_url !== undefined) updates.video_url = body.video_url?.trim() || null;
    if (body.dial_size !== undefined) updates.dial_size = body.dial_size;
    if (body.water_resistance !== undefined) updates.water_resistance = body.water_resistance;
    if (body.movement !== undefined) updates.movement = body.movement;
    if (body.strap_type !== undefined) updates.strap_type = body.strap_type;
    if (body.colors !== undefined) updates.colors = Array.isArray(body.colors) ? body.colors : [];
    if (body.warranty_months !== undefined) updates.warranty_months = Number(body.warranty_months);
    if (body.description !== undefined) updates.description = body.description?.trim() || null;

    // Track stock change for audit log
    let previousStock: number | null = null;
    let newStock: number | null = null;
    let changeQty: number | null = null;

    const { data: currentProd } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', body.id)
      .eq('account_id', accountId)
      .single();

    if (currentProd) {
      previousStock = currentProd.stock_quantity || 0;
    }

    if (body.stock_delta !== undefined && previousStock !== null) {
      const delta = Number(body.stock_delta) || 0;
      newStock = Math.max(0, previousStock + delta);
      updates.stock_quantity = newStock;
      changeQty = delta;
    } else if (body.stock_quantity !== undefined && previousStock !== null) {
      newStock = Math.max(0, Number(body.stock_quantity));
      changeQty = newStock - previousStock;
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', body.id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[products] update error:', error);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    // Insert stock audit log if stock changed
    if (previousStock !== null && newStock !== null && changeQty !== null && changeQty !== 0) {
      await supabase.from('product_stock_logs').insert({
        account_id: accountId,
        product_id: body.id,
        change_qty: changeQty,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: changeQty > 0 ? 'bulk_restock' : 'manual_adjustment',
      });
    }

    return NextResponse.json({ success: true, product: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/products?id=<productId>
 * Delete a product.
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[products] delete error:', error);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    return toErrorResponse(err);
  }
}
