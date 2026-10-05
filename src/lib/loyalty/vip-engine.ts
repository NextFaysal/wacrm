export type LoyaltyTier = 'NEW' | 'BRONZE' | 'SILVER' | 'GOLD' | 'VIP';

export interface CustomerLoyaltyProfile {
  tier: LoyaltyTier;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  discountPercent: number;
  isVip: boolean;
  perks: string[];
  loyaltyBadgeBangla: string;
}

export interface ReplenishmentAlert {
  productId: string;
  productName: string;
  lastPurchasedAt: string;
  daysSinceLastPurchase: number;
  estimatedCycleDays: number;
  isDueForReorder: boolean;
  suggestedDiscountCode?: string;
  suggestedMessageBangla: string;
}

/**
 * Calculates Customer Loyalty Tier and benefits based on order history
 */
export function calculateCustomerLoyaltyTier(
  orders: Array<{ total_amount?: number | null; status?: string | null; created_at?: string | null }>
): CustomerLoyaltyProfile {
  // Only count confirmed, delivered, or completed orders
  const validOrders = orders.filter((o) => {
    const st = String(o.status || '').toUpperCase();
    return !['CANCELLED', 'RETURNED', 'FAILED'].includes(st);
  });

  const totalOrders = validOrders.length;
  const totalSpend = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const averageOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;

  if (totalOrders >= 5 || totalSpend >= 10000) {
    return {
      tier: 'VIP',
      totalOrders,
      totalSpend,
      averageOrderValue,
      discountPercent: 12,
      isVip: true,
      perks: ['১২% লাইফটাইম ডিসকাউন্ট', 'ফ্রি ক্যাশ অন ডেলিভারি', 'প্রায়োরিটি কাস্টমার সাপোর্ট'],
      loyaltyBadgeBangla: '🌟 প্লাটিনাম ভিআইপি (VIP)',
    };
  }

  if (totalOrders >= 3 || totalSpend >= 5000) {
    return {
      tier: 'GOLD',
      totalOrders,
      totalSpend,
      averageOrderValue,
      discountPercent: 8,
      isVip: true,
      perks: ['৮% স্পেশাল মেম্বার ডিসকাউন্ট', 'ফ্রি ডেলিভারি ভাউচার'],
      loyaltyBadgeBangla: '👑 গোল্ড মেম্বার',
    };
  }

  if (totalOrders >= 2 || totalSpend >= 2500) {
    return {
      tier: 'SILVER',
      totalOrders,
      totalSpend,
      averageOrderValue,
      discountPercent: 5,
      isVip: false,
      perks: ['৫% লয়্যালটি ডিসকাউন্ট'],
      loyaltyBadgeBangla: '🥈 সিলভার মেম্বার',
    };
  }

  if (totalOrders === 1) {
    return {
      tier: 'BRONZE',
      totalOrders,
      totalSpend,
      averageOrderValue,
      discountPercent: 0,
      isVip: false,
      perks: ['পরবর্তী অর্ডারে গিফট কুপন'],
      loyaltyBadgeBangla: '🥉 ব্রোঞ্জ মেম্বার',
    };
  }

  return {
    tier: 'NEW',
    totalOrders: 0,
    totalSpend: 0,
    averageOrderValue: 0,
    discountPercent: 0,
    isVip: false,
    perks: ['প্রথম অর্ডারে ফ্রি গিফট'],
    loyaltyBadgeBangla: 'নতুন কাস্টমার',
  };
}

/**
 * Identifies products due for replenishment (e.g. 30-45 days after last order)
 */
export function getReplenishmentAlerts(
  customerName: string,
  orders: Array<{
    id: string;
    product_id?: string | null;
    product_name?: string | null;
    quantity?: number | null;
    created_at: string;
    status?: string | null;
  }>,
  defaultCycleDays = 30
): ReplenishmentAlert[] {
  const alerts: ReplenishmentAlert[] = [];
  const now = Date.now();

  // Filter completed/delivered/confirmed orders
  const eligibleOrders = orders.filter((o) => {
    const st = String(o.status || '').toUpperCase();
    return !['CANCELLED', 'RETURNED', 'FAILED'].includes(st);
  });

  // Group by product
  const latestByProduct = new Map<string, (typeof eligibleOrders)[0]>();
  for (const order of eligibleOrders) {
    const pId = order.product_id || order.product_name;
    if (!pId) continue;
    const existing = latestByProduct.get(pId);
    if (!existing || new Date(order.created_at).getTime() > new Date(existing.created_at).getTime()) {
      latestByProduct.set(pId, order);
    }
  }

  for (const [pId, order] of latestByProduct.entries()) {
    const purchasedTime = new Date(order.created_at).getTime();
    const daysSince = Math.floor((now - purchasedTime) / (1000 * 60 * 60 * 24));
    const qty = order.quantity || 1;
    // Scale estimated cycle by quantity (e.g. 2 bottles = ~50 days)
    const estimatedCycle = Math.round(defaultCycleDays * (1 + (qty - 1) * 0.7));

    // Due for reorder if between 75% and 150% of the cycle
    const isDue = daysSince >= Math.round(estimatedCycle * 0.75) && daysSince <= Math.round(estimatedCycle * 1.5);

    if (isDue) {
      const pName = order.product_name || 'পণ্যটি';
      alerts.push({
        productId: pId,
        productName: pName,
        lastPurchasedAt: order.created_at,
        daysSinceLastPurchase: daysSince,
        estimatedCycleDays: estimatedCycle,
        isDueForReorder: true,
        suggestedDiscountCode: 'REORDER5',
        suggestedMessageBangla: `আসসালামু আলাইকুম ${customerName ? customerName + ' ভাই' : 'ভাইয়া'}! আশা করি আমাদের ${pName} ব্যবহার করে দারুণ ফলাফল পাচ্ছেন। আপনার প্রডাক্টটি কি শেষের দিকে? নিয়মিত ব্যবহারে সেরা ফলাফলের জন্য এখনই রিস্টক করুন। আপনার জন্য থাকছে স্পেশাল ৫% লয়্যালটি ছাড় (কুপন: REORDER5)। অর্ডার করতে রিপ্লাই দিন! 😊`,
      });
    }
  }

  return alerts;
}
