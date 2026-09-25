import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { subDays, format, startOfDay } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30'; // '7', '30', '90', 'all'

    let startDate: Date | null = null;
    if (range === '7') startDate = subDays(new Date(), 7);
    else if (range === '30') startDate = subDays(new Date(), 30);
    else if (range === '90') startDate = subDays(new Date(), 90);

    // Fetch orders for this account
    let ordersQuery = supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });

    if (startDate) {
      ordersQuery = ordersQuery.gte('created_at', startDate.toISOString());
    }

    // Also fetch active products to get cost_price and image_url
    const [{ data: orders, error: ordErr }, { data: products }] = await Promise.all([
      ordersQuery,
      supabase.from('products').select('id, name, price, cost_price, image_url, stock_quantity, category').eq('account_id', accountId),
    ]);

    if (ordErr) {
      console.error('[analytics/sales] fetch error:', ordErr);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    const productMap = new Map<string, { costPrice: number; imageUrl: string; currentStock: number }>();
    for (const p of products || []) {
      const selling = Number(p.price) || 0;
      const cost = Number(p.cost_price) || Math.round(selling * 0.55);
      productMap.set(p.id, {
        costPrice: cost,
        imageUrl: p.image_url || '',
        currentStock: p.stock_quantity ?? 0,
      });
    }

    const orderList = orders || [];
    let totalRevenue = 0;
    let deliveredRevenue = 0;
    let totalCost = 0;
    let deliveredCost = 0;

    let deliveredCount = 0;
    let returnedCount = 0;
    let cancelledCount = 0;
    let inTransitCount = 0;
    let pendingCount = 0;

    const productSalesMap = new Map<
      string,
      {
        id: string;
        name: string;
        unitsSold: number;
        revenue: number;
        cost: number;
        imageUrl: string;
        stock: number;
      }
    >();

    const courierStats = {
      steadfast: { total: 0, delivered: 0, returned: 0, cancelled: 0 },
      pathao: { total: 0, delivered: 0, returned: 0, cancelled: 0 },
    };

    const dailyMap = new Map<string, { date: string; revenue: number; profit: number; orders: number }>();

    // Process each order
    for (const ord of orderList) {
      const isDelivered = ord.status === 'DELIVERED';
      const isReturned = ord.status === 'RETURNED';
      const isCancelled = ord.status === 'CANCELLED';
      const isInTransit = ['COURIER_BOOKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(ord.status);
      const isCountableSale = !isCancelled && !isReturned;

      const orderTotal = Number(ord.total_amount) || 0;
      const qty = Number(ord.quantity) || 1;
      const unitPrice = Number(ord.unit_price) || 0;

      const prodMeta = ord.product_id ? productMap.get(ord.product_id) : null;
      const unitCost = prodMeta?.costPrice ?? Math.round(unitPrice * 0.55);
      const orderCost = unitCost * qty;

      if (isCountableSale) {
        totalRevenue += orderTotal;
        totalCost += orderCost;
      }

      if (isDelivered) {
        deliveredCount++;
        deliveredRevenue += orderTotal;
        deliveredCost += orderCost;
      } else if (isReturned) {
        returnedCount++;
      } else if (isCancelled) {
        cancelledCount++;
      } else if (isInTransit) {
        inTransitCount++;
      } else {
        pendingCount++;
      }

      // Courier performance
      const provider = (ord.courier_provider || '').toLowerCase();
      if (provider.includes('steadfast')) {
        courierStats.steadfast.total++;
        if (isDelivered) courierStats.steadfast.delivered++;
        if (isReturned) courierStats.steadfast.returned++;
        if (isCancelled) courierStats.steadfast.cancelled++;
      } else if (provider.includes('pathao')) {
        courierStats.pathao.total++;
        if (isDelivered) courierStats.pathao.delivered++;
        if (isReturned) courierStats.pathao.returned++;
        if (isCancelled) courierStats.pathao.cancelled++;
      }

      // Top selling products accumulation
      const prodKey = ord.product_name || 'Watch';
      if (isCountableSale) {
        const existing = productSalesMap.get(prodKey) || {
          id: ord.product_id || '',
          name: ord.product_name,
          unitsSold: 0,
          revenue: 0,
          cost: 0,
          imageUrl: prodMeta?.imageUrl || '',
          stock: prodMeta?.currentStock ?? 0,
        };

        existing.unitsSold += qty;
        existing.revenue += unitPrice * qty;
        existing.cost += orderCost;
        if (!existing.imageUrl && prodMeta?.imageUrl) existing.imageUrl = prodMeta.imageUrl;

        productSalesMap.set(prodKey, existing);
      }

      // Daily trend
      const dayKey = format(new Date(ord.created_at), 'yyyy-MM-dd');
      const dayEntry = dailyMap.get(dayKey) || { date: dayKey, revenue: 0, profit: 0, orders: 0 };
      if (isCountableSale) {
        dayEntry.revenue += orderTotal;
        dayEntry.profit += Math.max(0, orderTotal - orderCost);
      }
      dayEntry.orders += 1;
      dailyMap.set(dayKey, dayEntry);
    }

    const totalProfit = Math.max(0, totalRevenue - totalCost);
    const deliveredProfit = Math.max(0, deliveredRevenue - deliveredCost);
    const profitMarginPct = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const averageOrderValue = orderList.length > 0 ? Math.round(totalRevenue / Math.max(1, orderList.length - cancelledCount - returnedCount)) : 0;

    const completedShipments = deliveredCount + returnedCount;
    const deliverySuccessRatio = completedShipments > 0 ? Math.round((deliveredCount / completedShipments) * 100) : (deliveredCount > 0 ? 100 : 0);
    const returnRatePct = completedShipments > 0 ? Math.round((returnedCount / completedShipments) * 100) : 0;

    // Sort top selling products
    const topProducts = Array.from(productSalesMap.values())
      .map((p) => ({
        ...p,
        profit: Math.max(0, p.revenue - p.cost),
        profitMarginPct: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    // Format daily trend
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Status breakdown donut
    const statusDonut = [
      { name: 'Delivered (সফল)', count: deliveredCount, color: '#10B981' },
      { name: 'In Transit (চলমান)', count: inTransitCount, color: '#3B82F6' },
      { name: 'Confirmed/New (প্রক্রিয়াধীন)', count: pendingCount, color: '#F59E0B' },
      { name: 'Returned (রিটার্ন)', count: returnedCount, color: '#EF4444' },
      { name: 'Cancelled (বাতিল)', count: cancelledCount, color: '#6B7280' },
    ];

    return NextResponse.json({
      summary: {
        totalOrders: orderList.length,
        totalRevenue,
        deliveredRevenue,
        totalCost,
        totalProfit,
        deliveredProfit,
        profitMarginPct,
        averageOrderValue,
        deliveredCount,
        returnedCount,
        cancelledCount,
        inTransitCount,
        pendingCount,
        deliverySuccessRatio,
        returnRatePct,
      },
      topProducts,
      dailyTrend,
      courierStats: {
        steadfast: {
          ...courierStats.steadfast,
          successRatio:
            courierStats.steadfast.delivered + courierStats.steadfast.returned > 0
              ? Math.round(
                  (courierStats.steadfast.delivered /
                    (courierStats.steadfast.delivered + courierStats.steadfast.returned)) *
                    100
                )
              : 0,
        },
        pathao: {
          ...courierStats.pathao,
          successRatio:
            courierStats.pathao.delivered + courierStats.pathao.returned > 0
              ? Math.round(
                  (courierStats.pathao.delivered /
                    (courierStats.pathao.delivered + courierStats.pathao.returned)) *
                    100
                )
              : 0,
        },
      },
      statusDonut,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
