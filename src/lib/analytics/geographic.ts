import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface GeoLocationMetric {
  location: string;
  division: string;
  traffic: number;
  orders: number;
  deliveredOrders: number;
  deliveredRevenue: number;
  conversionRate: number; // percentage
  aov: number; // average order value
  deliveryRate: number; // courier completion %
  opportunityTag?: 'HIGH_CONVERTING' | 'VOLUME_LEADER' | 'HIGH_RETURN_RISK';
}

export interface GeoAnalyticsReport {
  locations: GeoLocationMetric[];
  topOpportunity: string;
  regionalInsights: string[];
}

export async function getGeographicAnalytics(
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<GeoAnalyticsReport> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  // 1. Fetch visitors with city / division
  const { data: visitors } = await supabase
    .from('tracking_visitors')
    .select('id, city, division, total_sessions, total_orders, total_revenue')
    .eq('account_id', accountId)
    .gte('first_seen_at', start);

  // 2. Fetch orders with shipping address / city / district
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, status, delivery_status, shipping_address, district, city, division')
    .eq('account_id', accountId)
    .gte('created_at', start)
    .lte('created_at', end);

  // Default Bangladesh divisions map
  const divisionMap: Record<string, GeoLocationMetric> = {
    Dhaka: {
      location: 'Dhaka',
      division: 'Dhaka',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Chittagong: {
      location: 'Chittagong',
      division: 'Chittagong',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Khulna: {
      location: 'Khulna',
      division: 'Khulna',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Rajshahi: {
      location: 'Rajshahi',
      division: 'Rajshahi',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Sylhet: {
      location: 'Sylhet',
      division: 'Sylhet',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Barishal: {
      location: 'Barishal',
      division: 'Barishal',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Rangpur: {
      location: 'Rangpur',
      division: 'Rangpur',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
    Mymensingh: {
      location: 'Mymensingh',
      division: 'Mymensingh',
      traffic: 0,
      orders: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
      conversionRate: 0,
      aov: 0,
      deliveryRate: 0,
    },
  };

  // Aggregate visitor traffic
  (visitors || []).forEach((v) => {
    let div = v.division || v.city || 'Dhaka';
    div = Object.keys(divisionMap).find((k) => div.toLowerCase().includes(k.toLowerCase())) || 'Dhaka';
    divisionMap[div].traffic += Math.max(1, v.total_sessions || 1);
  });

  // Aggregate orders
  (orders || []).forEach((o) => {
    const raw = `${o.division || ''} ${o.city || ''} ${o.district || ''} ${o.shipping_address || ''}`;
    const div = Object.keys(divisionMap).find((k) => raw.toLowerCase().includes(k.toLowerCase())) || 'Dhaka';

    const isDelivered = o.delivery_status === 'delivered' || o.status === 'delivered';
    const total = Number(o.total || 0);

    divisionMap[div].orders += 1;
    if (isDelivered) {
      divisionMap[div].deliveredOrders += 1;
      divisionMap[div].deliveredRevenue += total;
    }
  });

  // Calculate derived conversion rate, AOV, delivery completion
  const locations = Object.values(divisionMap).map((m) => {
    m.conversionRate = m.traffic > 0 ? Number(((m.orders / m.traffic) * 100).toFixed(1)) : 0;
    m.aov = m.deliveredOrders > 0 ? Math.round(m.deliveredRevenue / m.deliveredOrders) : 0;
    m.deliveryRate = m.orders > 0 ? Math.round((m.deliveredOrders / m.orders) * 100) : 0;

    if (m.conversionRate >= 5.0 && m.orders >= 3) {
      m.opportunityTag = 'HIGH_CONVERTING';
    } else if (m.orders >= 20) {
      m.opportunityTag = 'VOLUME_LEADER';
    } else if (m.deliveryRate < 60 && m.orders >= 5) {
      m.opportunityTag = 'HIGH_RETURN_RISK';
    }

    return m;
  });

  // Sort by delivered revenue descending
  locations.sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);

  // Generate AI Opportunity Insight
  const highConv = locations.find((l) => l.opportunityTag === 'HIGH_CONVERTING');
  const topOpportunity = highConv
    ? `${highConv.location} has a notable ${highConv.conversionRate}% purchase conversion rate despite receiving moderate traffic. Consider running targeted Meta/TikTok ad sets focused on this region.`
    : `Dhaka remains the primary volume driver (${locations[0]?.orders || 0} orders).`;

  const regionalInsights = [
    topOpportunity,
    `Top Delivered Revenue Region: ${locations[0]?.location} (৳${locations[0]?.deliveredRevenue.toLocaleString()}).`,
  ];

  return {
    locations,
    topOpportunity,
    regionalInsights,
  };
}
