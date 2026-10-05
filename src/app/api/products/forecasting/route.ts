import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export interface ProductForecastItem {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  sales_last_7d: number;
  sales_last_30d: number;
  daily_velocity: number; // units/day
  days_remaining: number | null;
  urgency: 'CRITICAL' | 'WARNING' | 'ATTENTION' | 'HEALTHY' | 'SLOW_MOVING' | 'IDLE';
  suggested_reorder_qty: number;
  estimated_monthly_revenue: number;
  price: number;
  cost_price?: number | null;
}

/**
 * GET /api/products/forecasting
 * Computes AI-driven sales velocity, stock run-out forecast, and reorder advice.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    // 1. Fetch active products (with graceful fallback if barcode column is not yet migrated)
    let products: any[] = [];
    const { data: prodsWithBarcode, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sku, barcode, image_url, price, cost_price, stock_quantity, low_stock_threshold, is_active')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });

    if (prodErr) {
      const { data: fallbackProds, error: fbErr } = await supabase
        .from('products')
        .select('id, name, sku, image_url, price, cost_price, stock_quantity, low_stock_threshold, is_active')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('stock_quantity', { ascending: true });

      if (fbErr) {
        console.error('[forecasting] products query error:', fbErr);
        return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
      }
      products = fallbackProds || [];
    } else {
      products = prodsWithBarcode || [];
    }

    // 2. Fetch completed orders from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysIso = thirtyDaysAgo.toISOString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysIso = sevenDaysAgo.toISOString();

    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('product_id, quantity, created_at, status')
      .eq('account_id', accountId)
      .gte('created_at', thirtyDaysIso)
      .not('status', 'in', '("CANCELLED","RETURNED")');

    if (orderErr) {
      console.warn('[forecasting] orders query warning:', orderErr);
    }

    // 3. Aggregate sales by product_id
    const sales7dMap = new Map<string, number>();
    const sales30dMap = new Map<string, number>();

    (orders || []).forEach((order) => {
      if (!order.product_id) return;
      const qty = Number(order.quantity) || 1;
      const isLast7d = order.created_at >= sevenDaysIso;

      sales30dMap.set(order.product_id, (sales30dMap.get(order.product_id) || 0) + qty);
      if (isLast7d) {
        sales7dMap.set(order.product_id, (sales7dMap.get(order.product_id) || 0) + qty);
      }
    });

    // 4. Calculate forecasting metrics for each product
    const forecasts: ProductForecastItem[] = (products || []).map((p) => {
      const stock = Number(p.stock_quantity) || 0;
      const threshold = Number(p.low_stock_threshold) || 5;
      const sales7d = sales7dMap.get(p.id) || 0;
      const sales30d = sales30dMap.get(p.id) || 0;

      // Weighted daily sales velocity (70% weight on recent 7d trend, 30% weight on 30d baseline)
      const v7 = sales7d / 7;
      const v30 = sales30d / 30;
      const velocity = Math.round(((v7 * 0.7) + (v30 * 0.3)) * 10) / 10;

      let daysRemaining: number | null = null;
      let urgency: ProductForecastItem['urgency'] = 'HEALTHY';
      let suggestedReorder = 0;

      if (velocity > 0) {
        daysRemaining = Math.max(0, Math.round(stock / velocity));
        if (daysRemaining <= 3 || stock === 0) {
          urgency = 'CRITICAL';
        } else if (daysRemaining <= 7) {
          urgency = 'WARNING';
        } else if (daysRemaining <= 14) {
          urgency = 'ATTENTION';
        } else {
          urgency = 'HEALTHY';
        }
        // Recommended 30-day stock buffer + extra safety margin if velocity is fast
        suggestedReorder = Math.max(0, Math.ceil(velocity * 30) - stock);
      } else {
        if (stock === 0) {
          urgency = 'CRITICAL';
          suggestedReorder = threshold * 2;
        } else if (stock > 50) {
          urgency = 'SLOW_MOVING';
        } else {
          urgency = 'IDLE';
        }
      }

      const estimatedMonthlyRevenue = Math.round(velocity * 30 * Number(p.price || 0));

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        image_url: p.image_url,
        stock_quantity: stock,
        low_stock_threshold: threshold,
        sales_last_7d: sales7d,
        sales_last_30d: sales30d,
        daily_velocity: velocity,
        days_remaining: daysRemaining,
        urgency,
        suggested_reorder_qty: suggestedReorder,
        estimated_monthly_revenue: estimatedMonthlyRevenue,
        price: Number(p.price || 0),
        cost_price: p.cost_price ? Number(p.cost_price) : null,
      };
    });

    // Sort by most urgent first
    const urgencyWeight: Record<ProductForecastItem['urgency'], number> = {
      CRITICAL: 1,
      WARNING: 2,
      ATTENTION: 3,
      HEALTHY: 4,
      SLOW_MOVING: 5,
      IDLE: 6,
    };

    forecasts.sort((a, b) => {
      const weightDiff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
      if (weightDiff !== 0) return weightDiff;
      if (a.days_remaining !== null && b.days_remaining !== null) {
        return a.days_remaining - b.days_remaining;
      }
      return b.daily_velocity - a.daily_velocity;
    });

    const summary = {
      criticalCount: forecasts.filter((f) => f.urgency === 'CRITICAL').length,
      warningCount: forecasts.filter((f) => f.urgency === 'WARNING').length,
      attentionCount: forecasts.filter((f) => f.urgency === 'ATTENTION').length,
      healthyCount: forecasts.filter((f) => f.urgency === 'HEALTHY').length,
      slowMovingCount: forecasts.filter((f) => f.urgency === 'SLOW_MOVING').length,
      totalProjectedMonthlyRevenue: forecasts.reduce((acc, f) => acc + f.estimated_monthly_revenue, 0),
    };

    return NextResponse.json({
      success: true,
      summary,
      forecasts,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
