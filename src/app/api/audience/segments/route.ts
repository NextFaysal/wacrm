import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export type AudienceSegmentKey =
  | 'ALL'
  | 'VIP_SPENDERS'
  | 'REPEAT_BUYERS'
  | 'HIGH_DELIVERY_RATE'
  | 'ABANDONED_LEADS'
  | 'INACTIVE_30D'
  | 'DHAKA_METRO'
  | 'OUTSIDE_DHAKA';

export interface AudienceMember {
  phone: string;
  name: string;
  totalOrders: number;
  totalSpend: number;
  city: string;
  lastOrderAt: string | null;
}

export interface SegmentSummary {
  key: AudienceSegmentKey;
  title: string;
  description: string;
  count: number;
  badge: string;
  color: string;
}

/**
 * GET /api/audience/segments
 * Fetches dynamic audience segments with real-time customer counts, metrics, and member sample.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const selectedSegment = (searchParams.get('segment') || 'ALL') as AudienceSegmentKey;
    const includeMembers = searchParams.get('includeMembers') === 'true';

    // 1. Fetch all customer orders for this account
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, customer_phone, customer_name, customer_city, total_amount, status, created_at')
      .eq('account_id', accountId)
      .not('customer_phone', 'is', null);

    if (ordersErr) throw ordersErr;

    // 2. Fetch abandoned checkouts
    const { data: abandonedRows } = await supabase
      .from('abandoned_checkouts')
      .select('id, customer_phone, customer_name, total_amount, created_at')
      .eq('account_id', accountId)
      .eq('status', 'open')
      .not('customer_phone', 'is', null);

    // 3. Aggregate customer statistics
    const customerMap = new Map<string, AudienceMember & { deliveredCount: number; cancelledCount: number }>();

    for (const ord of orders || []) {
      const rawPhone = String(ord.customer_phone || '').trim();
      if (!rawPhone || rawPhone.length < 10) continue;

      const existing = customerMap.get(rawPhone);
      const amount = Number(ord.total_amount) || 0;
      const isDelivered = ord.status === 'DELIVERED';
      const isCancelled = ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(ord.status);

      if (!existing) {
        customerMap.set(rawPhone, {
          phone: rawPhone,
          name: ord.customer_name || 'Customer',
          totalOrders: 1,
          totalSpend: isDelivered ? amount : 0,
          city: ord.customer_city || '',
          lastOrderAt: ord.created_at,
          deliveredCount: isDelivered ? 1 : 0,
          cancelledCount: isCancelled ? 1 : 0,
        });
      } else {
        existing.totalOrders += 1;
        if (isDelivered) existing.totalSpend += amount;
        if (isDelivered) existing.deliveredCount += 1;
        if (isCancelled) existing.cancelledCount += 1;
        if (ord.customer_city && !existing.city) existing.city = ord.customer_city;
        if (ord.created_at && (!existing.lastOrderAt || new Date(ord.created_at) > new Date(existing.lastOrderAt))) {
          existing.lastOrderAt = ord.created_at;
        }
      }
    }

    const allCustomers = Array.from(customerMap.values());
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter into segments
    const segmentMap: Record<AudienceSegmentKey, (AudienceMember)[]> = {
      ALL: allCustomers,
      VIP_SPENDERS: allCustomers.filter((c) => c.totalSpend >= 3000),
      REPEAT_BUYERS: allCustomers.filter((c) => c.totalOrders >= 2),
      HIGH_DELIVERY_RATE: allCustomers.filter((c) => {
        const totalChecked = c.deliveredCount + c.cancelledCount;
        if (totalChecked === 0) return true;
        return c.deliveredCount / totalChecked >= 0.8;
      }),
      ABANDONED_LEADS: (abandonedRows || []).map((row) => ({
        phone: row.customer_phone,
        name: row.customer_name || 'Visitor',
        totalOrders: 0,
        totalSpend: Number(row.total_amount) || 0,
        city: 'Dhaka',
        lastOrderAt: row.created_at,
      })),
      INACTIVE_30D: allCustomers.filter((c) => {
        if (!c.lastOrderAt) return false;
        return new Date(c.lastOrderAt) < thirtyDaysAgo;
      }),
      DHAKA_METRO: allCustomers.filter((c) => {
        const city = (c.city || '').toLowerCase();
        return city.includes('dhaka') || city.includes('ঢাকা');
      }),
      OUTSIDE_DHAKA: allCustomers.filter((c) => {
        const city = (c.city || '').toLowerCase();
        return city.length > 0 && !city.includes('dhaka') && !city.includes('ঢাকা');
      }),
    };

    const summaries: SegmentSummary[] = [
      {
        key: 'ALL',
        title: 'সকল নিবন্ধিত ক্রেতা (All Customers)',
        description: 'যেসকল গ্রাহক পূর্বে সফলভাবে অর্ডার সম্পন্ন করেছেন',
        count: segmentMap.ALL.length,
        badge: 'General',
        color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200',
      },
      {
        key: 'VIP_SPENDERS',
        title: '💎 ভিআইপি ক্রেতা (VIP ৳৩,০০০+)',
        description: 'সর্বোচ্চ কেনাকাটা করা হাই-ভ্যালু গ্রাহক',
        count: segmentMap.VIP_SPENDERS.length,
        badge: 'High Value',
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200',
      },
      {
        key: 'REPEAT_BUYERS',
        title: '🔄 রিপিট বায়ার (২+ অর্ডার)',
        description: 'একাধিকবার সফলভাবে পণ্য ক্রয়কারী অনুগত ক্রেতা',
        count: segmentMap.REPEAT_BUYERS.length,
        badge: 'Loyal',
        color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200',
      },
      {
        key: 'HIGH_DELIVERY_RATE',
        title: '🛡️ গোল্ডেন ডেলিভারি রেট (>৮০%)',
        description: 'খুবই কম পার্সেল রিটার্ন করেন এমন বিশ্বস্ত ক্রেতা',
        count: segmentMap.HIGH_DELIVERY_RATE.length,
        badge: 'Safe COD',
        color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200',
      },
      {
        key: 'ABANDONED_LEADS',
        title: '⚡ অ্যাবান্ডনড লিডস (অসমাপ্ত চেকআউট)',
        description: 'চেকআউটে তথ্য পূরণ করেও অর্ডার কনফার্ম করেননি',
        count: segmentMap.ABANDONED_LEADS.length,
        badge: 'Recovery',
        color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200',
      },
      {
        key: 'INACTIVE_30D',
        title: '💤 নিষ্ক্রিয় ক্রেতা (৩০+ দিন)',
        description: 'বিগত ৩০ দিনে কোনো নতুন অর্ডার করেননি (Win-back)',
        count: segmentMap.INACTIVE_30D.length,
        badge: 'Re-engage',
        color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200',
      },
      {
        key: 'DHAKA_METRO',
        title: '🏙️ ঢাকা মেট্রো (Same-Day / Express)',
        description: 'ঢাকা সিটির ভেতরের গ্রাহক (২৪ ঘণ্টার এক্সপ্রেস অফার)',
        count: segmentMap.DHAKA_METRO.length,
        badge: 'Dhaka',
        color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200',
      },
      {
        key: 'OUTSIDE_DHAKA',
        title: '🚚 ঢাকার বাহিরে (Nationwide Courier)',
        description: 'ঢাকার বাইরের জেলা ও উপজেলার গ্রাহক (ফ্রি ডেলিভারি অফার)',
        count: segmentMap.OUTSIDE_DHAKA.length,
        badge: 'Nationwide',
        color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200',
      },
    ];

    const currentMembers = segmentMap[selectedSegment] || [];

    return NextResponse.json({
      success: true,
      summaries,
      selectedSegment,
      totalCount: currentMembers.length,
      members: includeMembers ? currentMembers.slice(0, 100) : [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
