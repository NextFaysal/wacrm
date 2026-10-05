import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { fetchMetaAdInsights } from '@/lib/meta/graph-api';

/**
 * POST /api/meta/ads/sync - Fetch latest Meta Ad spend, clicks, impressions and correlate with CRM sales
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const { searchParams } = new URL(request.url);
    const datePreset = searchParams.get('preset') || 'last_30d';

    // 1. Fetch Meta config
    const { data: config } = await supabase
      .from('meta_integrations')
      .select('page_access_token, ad_account_id')
      .eq('account_id', accountId)
      .single();

    if (!config?.page_access_token || !config?.ad_account_id) {
      return NextResponse.json(
        { error: 'Meta Page Access Token or Ad Account ID is missing' },
        { status: 400 }
      );
    }

    // 2. Fetch insights from Meta Marketing API
    let insights;
    try {
      insights = await fetchMetaAdInsights({
        accessToken: config.page_access_token,
        adAccountId: config.ad_account_id,
        datePreset,
      });
    } catch (apiErr: any) {
      return NextResponse.json({ error: apiErr.message }, { status: 502 });
    }

    if (!insights || insights.length === 0) {
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        message: 'No ad insights returned for the selected time window',
      });
    }

    // 3. Compute CRM attributed revenue from orders
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, status, created_at')
      .eq('account_id', accountId)
      .not('status', 'eq', 'cancelled');

    const totalCrmRevenue = (orders || []).reduce(
      (sum, o) => sum + (parseFloat(o.total_amount) || 0),
      0
    );

    const totalSpendAll = insights.reduce(
      (sum, item) => sum + (parseFloat(item.spend) || 0),
      0
    );

    // 4. Upsert into meta_ads_metrics
    const syncedRecords = [];
    const today = new Date().toISOString().split('T')[0];

    for (const item of insights) {
      const spend = parseFloat(item.spend) || 0;
      const impressions = parseInt(item.impressions, 10) || 0;
      const clicks = parseInt(item.clicks, 10) || 0;
      const cpc = parseFloat(item.cpc || '0') || (clicks > 0 ? spend / clicks : 0);
      const cpm = parseFloat(item.cpm || '0') || (impressions > 0 ? (spend / impressions) * 1000 : 0);
      const ctr = parseFloat(item.ctr || '0') || (impressions > 0 ? (clicks / impressions) * 100 : 0);

      // Attribute revenue proportional to ad spend if total spend > 0
      const campaignAttributedRevenue =
        totalSpendAll > 0 ? Math.round(((spend / totalSpendAll) * totalCrmRevenue) * 100) / 100 : 0;
      const roas = spend > 0 ? Math.round((campaignAttributedRevenue / spend) * 100) / 100 : 0;

      // Extract conversions from actions if available
      const purchasesAction = item.actions?.find(
        (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      const conversions = purchasesAction ? parseInt(purchasesAction.value, 10) : 0;

      const record = {
        account_id: accountId,
        ad_account_id: config.ad_account_id,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name || 'Unnamed Campaign',
        adset_id: item.adset_id || null,
        adset_name: item.adset_name || null,
        ad_id: item.ad_id || null,
        ad_name: item.ad_name || null,
        spend,
        currency: 'USD',
        impressions,
        clicks,
        cpc,
        cpm,
        ctr,
        conversions,
        attributed_revenue: campaignAttributedRevenue,
        roas,
        date: item.date_start || today,
      };

      const { data: upserted } = await supabase
        .from('meta_ads_metrics')
        .upsert(record, { onConflict: 'account_id,campaign_id,date' })
        .select()
        .single();

      if (upserted) {
        syncedRecords.push(upserted);
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: syncedRecords.length,
      metrics: syncedRecords,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
