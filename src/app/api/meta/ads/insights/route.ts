import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/meta/ads/insights - Get aggregated ad spend, impressions, clicks, CPC, ROAS and campaign list
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    let query = supabase
      .from('meta_ads_metrics')
      .select('*')
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: metrics, error } = await query;
    if (error) {
      console.warn('[meta-ads-insights] fetch error:', error);
      return NextResponse.json({
        summary: {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          avgCpc: 0,
          avgCpm: 0,
          totalConversions: 0,
          totalAttributedRevenue: 0,
          overallRoas: 0,
        },
        campaigns: [],
      });
    }

    // Aggregate summary
    const list = metrics || [];
    const totalSpend = list.reduce((sum, m) => sum + (parseFloat(m.spend) || 0), 0);
    const totalImpressions = list.reduce((sum, m) => sum + (parseInt(m.impressions, 10) || 0), 0);
    const totalClicks = list.reduce((sum, m) => sum + (parseInt(m.clicks, 10) || 0), 0);
    const totalConversions = list.reduce((sum, m) => sum + (parseInt(m.conversions, 10) || 0), 0);
    const totalAttributedRevenue = list.reduce((sum, m) => sum + (parseFloat(m.attributed_revenue) || 0), 0);

    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const overallRoas = totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0;

    // Group by campaign
    const campaignMap: Record<string, any> = {};
    for (const m of list) {
      if (!campaignMap[m.campaign_id]) {
        campaignMap[m.campaign_id] = {
          campaign_id: m.campaign_id,
          campaign_name: m.campaign_name,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          attributed_revenue: 0,
          currency: m.currency || 'USD',
          latestDate: m.date,
        };
      }
      campaignMap[m.campaign_id].spend += parseFloat(m.spend) || 0;
      campaignMap[m.campaign_id].impressions += parseInt(m.impressions, 10) || 0;
      campaignMap[m.campaign_id].clicks += parseInt(m.clicks, 10) || 0;
      campaignMap[m.campaign_id].conversions += parseInt(m.conversions, 10) || 0;
      campaignMap[m.campaign_id].attributed_revenue += parseFloat(m.attributed_revenue) || 0;
    }

    const campaigns = Object.values(campaignMap).map((c: any) => ({
      ...c,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      roas: c.spend > 0 ? c.attributed_revenue / c.spend : 0,
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalImpressions,
        totalClicks,
        avgCpc: Math.round(avgCpc * 100) / 100,
        avgCpm: Math.round(avgCpm * 100) / 100,
        totalConversions,
        totalAttributedRevenue: Math.round(totalAttributedRevenue * 100) / 100,
        overallRoas: Math.round(overallRoas * 100) / 100,
      },
      campaigns,
      dailyMetrics: list,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
