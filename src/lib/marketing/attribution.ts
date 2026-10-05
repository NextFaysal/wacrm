import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ChannelPerformance {
  channel: string;
  adSpend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  platformReportedConversions: number;
  platformReportedRevenue: number;
  internalAttributedOrders: number;
  internalConfirmedOrders: number;
  internalDeliveredOrders: number;
  internalDeliveredRevenue: number;
  trueROAS: number;
  trueCAC: number;
  deliverySuccessRate: number;
  discrepancy: number;
}

export async function calculateAttributionAndPerformance(
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  channels: ChannelPerformance[];
  totals: {
    totalSpend: number;
    totalDeliveredRevenue: number;
    totalOrders: number;
    totalDeliveredOrders: number;
    overallTrueROAS: number;
    overallTrueCAC: number;
    deliveryRate: number;
  };
}> {
  const now = new Date();
  const start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || now.toISOString().split('T')[0];

  // 1. Fetch Ad Spend & Platform metrics by channel
  const { data: adMetrics } = await supabase
    .from('marketing_daily_metrics')
    .select('*')
    .eq('account_id', accountId)
    .gte('date', start)
    .lte('date', end);

  // 2. Fetch Attributed Orders & Deliveries
  const { data: attributions } = await supabase
    .from('order_attributions')
    .select('*, orders(id, order_number, status, total, delivery_status, created_at)')
    .eq('account_id', accountId)
    .gte('created_at', `${start}T00:00:00Z`)
    .lte('created_at', `${end}T23:59:59Z`);

  // Channel mapping
  const channelMap: Record<string, ChannelPerformance> = {
    meta: {
      channel: 'Facebook & Instagram (Meta)',
      adSpend: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      platformReportedConversions: 0,
      platformReportedRevenue: 0,
      internalAttributedOrders: 0,
      internalConfirmedOrders: 0,
      internalDeliveredOrders: 0,
      internalDeliveredRevenue: 0,
      trueROAS: 0,
      trueCAC: 0,
      deliverySuccessRate: 0,
      discrepancy: 0,
    },
    google: {
      channel: 'Google Ads',
      adSpend: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      platformReportedConversions: 0,
      platformReportedRevenue: 0,
      internalAttributedOrders: 0,
      internalConfirmedOrders: 0,
      internalDeliveredOrders: 0,
      internalDeliveredRevenue: 0,
      trueROAS: 0,
      trueCAC: 0,
      deliverySuccessRate: 0,
      discrepancy: 0,
    },
    tiktok: {
      channel: 'TikTok Ads',
      adSpend: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      platformReportedConversions: 0,
      platformReportedRevenue: 0,
      internalAttributedOrders: 0,
      internalConfirmedOrders: 0,
      internalDeliveredOrders: 0,
      internalDeliveredRevenue: 0,
      trueROAS: 0,
      trueCAC: 0,
      deliverySuccessRate: 0,
      discrepancy: 0,
    },
    whatsapp: {
      channel: 'WhatsApp Direct',
      adSpend: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      platformReportedConversions: 0,
      platformReportedRevenue: 0,
      internalAttributedOrders: 0,
      internalConfirmedOrders: 0,
      internalDeliveredOrders: 0,
      internalDeliveredRevenue: 0,
      trueROAS: 0,
      trueCAC: 0,
      deliverySuccessRate: 0,
      discrepancy: 0,
    },
    organic: {
      channel: 'Organic & Direct',
      adSpend: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      platformReportedConversions: 0,
      platformReportedRevenue: 0,
      internalAttributedOrders: 0,
      internalConfirmedOrders: 0,
      internalDeliveredOrders: 0,
      internalDeliveredRevenue: 0,
      trueROAS: 0,
      trueCAC: 0,
      deliverySuccessRate: 0,
      discrepancy: 0,
    },
  };

  // Aggregate marketing daily metrics
  (adMetrics || []).forEach((m) => {
    const key = m.platform in channelMap ? m.platform : 'meta';
    channelMap[key].adSpend += Number(m.spend || 0);
    channelMap[key].impressions += Number(m.impressions || 0);
    channelMap[key].clicks += Number(m.clicks || 0);
    channelMap[key].platformReportedConversions += Number(m.platform_conversions || 0);
    channelMap[key].platformReportedRevenue += Number(m.platform_conversion_value || 0);
  });

  // Aggregate internal orders attribution
  (attributions || []).forEach((attr) => {
    let chanKey = 'organic';
    const rawChan = (attr.last_touch_channel || '').toLowerCase();
    if (rawChan.includes('meta') || rawChan.includes('facebook') || rawChan.includes('instagram')) chanKey = 'meta';
    else if (rawChan.includes('google')) chanKey = 'google';
    else if (rawChan.includes('tiktok')) chanKey = 'tiktok';
    else if (rawChan.includes('whatsapp')) chanKey = 'whatsapp';

    const order = attr.orders;
    const isDelivered = attr.is_delivered || order?.status === 'delivered' || order?.delivery_status === 'delivered';
    const isConfirmed = order?.status === 'confirmed' || order?.status === 'processing' || isDelivered;
    const rev = Number(attr.order_total_revenue || order?.total || 0);

    channelMap[chanKey].internalAttributedOrders += 1;
    if (isConfirmed) channelMap[chanKey].internalConfirmedOrders += 1;
    if (isDelivered) {
      channelMap[chanKey].internalDeliveredOrders += 1;
      channelMap[chanKey].internalDeliveredRevenue += rev;
    }
  });

  // Calculate derived ratios
  let totalSpend = 0;
  let totalDeliveredRevenue = 0;
  let totalOrders = 0;
  let totalDeliveredOrders = 0;

  const channels = Object.values(channelMap).map((c) => {
    c.cpc = c.clicks > 0 ? Number((c.adSpend / c.clicks).toFixed(2)) : 0;
    c.cpm = c.impressions > 0 ? Number(((c.adSpend / c.impressions) * 1000).toFixed(2)) : 0;
    c.ctr = c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0;

    c.trueROAS = c.adSpend > 0 ? Number((c.internalDeliveredRevenue / c.adSpend).toFixed(2)) : 0;
    c.trueCAC = c.internalDeliveredOrders > 0 ? Number((c.adSpend / c.internalDeliveredOrders).toFixed(2)) : 0;
    c.deliverySuccessRate =
      c.internalAttributedOrders > 0
        ? Number(((c.internalDeliveredOrders / c.internalAttributedOrders) * 100).toFixed(1))
        : 0;
    c.discrepancy = c.platformReportedConversions - c.internalDeliveredOrders;

    totalSpend += c.adSpend;
    totalDeliveredRevenue += c.internalDeliveredRevenue;
    totalOrders += c.internalAttributedOrders;
    totalDeliveredOrders += c.internalDeliveredOrders;

    return c;
  });

  return {
    channels,
    totals: {
      totalSpend: Number(totalSpend.toFixed(2)),
      totalDeliveredRevenue: Number(totalDeliveredRevenue.toFixed(2)),
      totalOrders,
      totalDeliveredOrders,
      overallTrueROAS: totalSpend > 0 ? Number((totalDeliveredRevenue / totalSpend).toFixed(2)) : 0,
      overallTrueCAC: totalDeliveredOrders > 0 ? Number((totalSpend / totalDeliveredOrders).toFixed(2)) : 0,
      deliveryRate: totalOrders > 0 ? Number(((totalDeliveredOrders / totalOrders) * 100).toFixed(1)) : 0,
    },
  };
}
