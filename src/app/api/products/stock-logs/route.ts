import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/products/stock-logs?productId=<id>
 * Fetches recent stock movement / audit trail for a product.
 */
export async function GET(request: Request) {
  try {
    const { accountId, supabase } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('product_stock_logs')
      .select('*')
      .eq('account_id', accountId)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[stock-logs] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch stock logs' }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs: logs || [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/products/stock-logs
 * Perform quick manual restock or inventory adjustment.
 * Body: { productId, changeQty, reason, note }
 */
export async function POST(request: Request) {
  try {
    const { accountId, supabase, userId } = await requireRole('agent');
    const body = await request.json().catch(() => null);

    if (!body?.productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const changeQty = parseInt(body.changeQty, 10);
    if (isNaN(changeQty) || changeQty === 0) {
      return NextResponse.json({ error: 'Valid non-zero change quantity is required' }, { status: 400 });
    }

    const reason = body.reason || (changeQty > 0 ? 'bulk_restock' : 'manual_adjustment');

    // 1. Fetch current product
    const { data: product, error: fetchErr } = await supabase
      .from('products')
      .select('id, stock_quantity, name')
      .eq('account_id', accountId)
      .eq('id', body.productId)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const previousStock = Number(product.stock_quantity) || 0;
    const newStock = Math.max(0, previousStock + changeQty);

    // 2. Update product stock
    const { error: updateErr } = await supabase
      .from('products')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)
      .eq('id', body.productId);

    if (updateErr) {
      console.error('[stock-logs] update product error:', updateErr);
      return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
    }

    // 3. Insert audit log
    const { data: newLog, error: logErr } = await supabase
      .from('product_stock_logs')
      .insert({
        account_id: accountId,
        product_id: body.productId,
        change_qty: changeQty,
        previous_stock: previousStock,
        new_stock: newStock,
        reason,
        created_by: userId || 'Admin',
      })
      .select()
      .single();

    if (logErr) {
      console.warn('[stock-logs] insert log warning:', logErr);
    }

    return NextResponse.json({
      success: true,
      newStock,
      log: newLog,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
