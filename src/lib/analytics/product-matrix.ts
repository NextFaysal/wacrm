import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type ProductQuadrant = 'CASH_COW' | 'HIDDEN_GEM' | 'TRAFFIC_WASTER' | 'UNDERPERFORMER';

export interface ProductMatrixItem {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  grossMarginPct: number;
  views: number;
  addToCarts: number;
  purchases: number;
  deliveredRevenue: number;
  conversionRate: number; // percentage
  quadrant: ProductQuadrant;
  aiInsight: string;
}

export interface ProductMatrixReport {
  products: ProductMatrixItem[];
  trafficWasters: ProductMatrixItem[];
  hiddenGems: ProductMatrixItem[];
  cashCows: ProductMatrixItem[];
}

export async function getProductIntelligenceMatrix(accountId: string): Promise<ProductMatrixReport> {
  // 1. Fetch products
  const { data: prods } = await supabase
    .from('products')
    .select('id, name, price, cost_price')
    .eq('account_id', accountId)
    .eq('is_active', true);

  if (!prods || prods.length === 0) {
    return { products: [], trafficWasters: [], hiddenGems: [], cashCows: [] };
  }

  // 2. Fetch event counts per product
  const { data: events } = await supabase
    .from('tracking_events')
    .select('product_id, event_name')
    .eq('account_id', accountId)
    .not('product_id', 'is', null);

  // 3. Fetch order items
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_id, quantity, unit_price, orders(status, delivery_status)')
    .not('product_id', 'is', null);

  // Group events
  const viewCounts: Record<string, number> = {};
  const cartCounts: Record<string, number> = {};
  (events || []).forEach((e) => {
    if (!e.product_id) return;
    if (e.event_name === 'ProductView') viewCounts[e.product_id] = (viewCounts[e.product_id] || 0) + 1;
    if (e.event_name === 'AddToCart') cartCounts[e.product_id] = (cartCounts[e.product_id] || 0) + 1;
  });

  // Group orders
  const purchaseCounts: Record<string, number> = {};
  const revenueCounts: Record<string, number> = {};
  (orderItems || []).forEach((item: any) => {
    if (!item.product_id) return;
    purchaseCounts[item.product_id] = (purchaseCounts[item.product_id] || 0) + Number(item.quantity || 1);
    if (item.orders?.delivery_status === 'delivered') {
      revenueCounts[item.product_id] = (revenueCounts[item.product_id] || 0) + Number(item.unit_price || 0) * Number(item.quantity || 1);
    }
  });

  // Calculate median views & conversion rate for quadrant partitioning
  const items: ProductMatrixItem[] = prods.map((p) => {
    const views = viewCounts[p.id] || 0;
    const purchases = purchaseCounts[p.id] || 0;
    const revenue = revenueCounts[p.id] || 0;
    const price = Number(p.price || 0);
    const cost = Number(p.cost_price || 0);
    const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
    const convRate = views > 0 ? Number(((purchases / views) * 100).toFixed(1)) : purchases > 0 ? 10.0 : 0;

    let quadrant: ProductQuadrant = 'UNDERPERFORMER';
    let aiInsight = 'Balanced performance.';

    if (views >= 10 && convRate >= 4.0) {
      quadrant = 'CASH_COW';
      aiInsight = 'Top performer with high customer purchase intent. Sustain marketing budget.';
    } else if (views < 10 && convRate >= 5.0) {
      quadrant = 'HIDDEN_GEM';
      aiInsight = 'High conversion efficiency with low ad exposure. Allocate dedicated ad spend to scale.';
    } else if (views >= 15 && convRate < 2.0) {
      quadrant = 'TRAFFIC_WASTER';
      aiInsight = 'Receiving high traffic but failing to convert. Review price point, bundling, or delivery charge.';
    } else {
      quadrant = 'UNDERPERFORMER';
      aiInsight = 'Low engagement and low sales volume.';
    }

    return {
      id: p.id,
      name: p.name,
      price,
      costPrice: cost,
      grossMarginPct: margin,
      views,
      addToCarts: cartCounts[p.id] || 0,
      purchases,
      deliveredRevenue: revenue,
      conversionRate: convRate,
      quadrant,
      aiInsight,
    };
  });

  items.sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);

  return {
    products: items,
    trafficWasters: items.filter((p) => p.quadrant === 'TRAFFIC_WASTER'),
    hiddenGems: items.filter((p) => p.quadrant === 'HIDDEN_GEM'),
    cashCows: items.filter((p) => p.quadrant === 'CASH_COW'),
  };
}
