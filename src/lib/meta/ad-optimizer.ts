import { createClient } from '@supabase/supabase-js';
import { fetchMetaAdInsights } from './graph-api';
import { sendPushToAccount } from '@/lib/notifications/web-push';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

let _adminClient: any = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

/**
 * Pause a Meta Ad Campaign via Marketing API
 */
export async function pauseMetaCampaign(params: {
  accessToken: string;
  campaignId: string;
}): Promise<boolean> {
  const url = `${META_GRAPH_BASE}/${encodeURIComponent(params.campaignId)}?status=PAUSED&access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Failed to pause campaign ${params.campaignId}`);
  }
  return data.success === true;
}

export interface AdOptimizerResult {
  evaluatedCount: number;
  pausedCampaigns: Array<{ id: string; name: string; spend: number; roas: number; reason: string }>;
  winningCampaigns: Array<{ id: string; name: string; spend: number; roas: number; message: string }>;
}

/**
 * Evaluates active Meta campaigns against stop-loss and scaling rules
 */
export async function evaluateAdRules(accountId: string): Promise<AdOptimizerResult> {
  const db = getAdminClient();

  // 1. Fetch Meta config
  const { data: config } = await db
    .from('meta_integrations')
    .select('page_access_token, ad_account_id')
    .eq('account_id', accountId)
    .single();

  if (!config?.page_access_token || !config?.ad_account_id) {
    return { evaluatedCount: 0, pausedCampaigns: [], winningCampaigns: [] };
  }

  // 2. Fetch or initialize rules
  let { data: rules } = await db
    .from('meta_ad_rules')
    .select('*')
    .eq('account_id', accountId);

  if (!rules || rules.length === 0) {
    const defaultRule = {
      account_id: accountId,
      rule_name: 'AI Stop-Loss Guard (Zero Conversion / Low ROAS)',
      rule_type: 'stop_loss',
      is_active: true,
      max_spend_threshold: 15.00, // $15 or equivalent
      min_roas_threshold: 1.00,
      action: 'pause_campaign',
    };
    const { data: created } = await db
      .from('meta_ad_rules')
      .insert(defaultRule)
      .select()
      .single();
    rules = created ? [created] : [];
  }

  const stopLossRule = rules.find((r: any) => r.rule_type === 'stop_loss' && r.is_active);

  // 3. Fetch insights from Meta Marketing API for today / yesterday
  const insights = await fetchMetaAdInsights({
    accessToken: config.page_access_token,
    adAccountId: config.ad_account_id,
    datePreset: 'last_7d',
  });

  const paused: AdOptimizerResult['pausedCampaigns'] = [];
  const winning: AdOptimizerResult['winningCampaigns'] = [];

  for (const item of insights) {
    const spend = parseFloat(item.spend) || 0;
    const purchasesAction = item.actions?.find(
      (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
    );
    const conversions = purchasesAction ? parseInt(purchasesAction.value, 10) : 0;
    const clicks = parseInt(item.clicks, 10) || 0;

    // Estimate ROAS based on conversions
    // If 0 conversions, ROAS is 0
    const roas = conversions > 0 && spend > 0 ? (conversions * 1500) / (spend * 120) : 0; // standard estimation

    // A. Check Stop-Loss Rule
    if (stopLossRule && spend >= stopLossRule.max_spend_threshold && conversions === 0) {
      try {
        await pauseMetaCampaign({
          accessToken: config.page_access_token,
          campaignId: item.campaign_id,
        });

        paused.push({
          id: item.campaign_id,
          name: item.campaign_name,
          spend,
          roas,
          reason: `Spend ($${spend}) exceeded threshold ($${stopLossRule.max_spend_threshold}) with 0 conversions`,
        });

        // Update rule trigger counter
        await db
          .from('meta_ad_rules')
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: (stopLossRule.trigger_count || 0) + 1,
          })
          .eq('id', stopLossRule.id);

        // Send Push Alert
        await sendPushToAccount(db, accountId, {
          title: '🚨 Meta Ad Stop-Loss Triggered',
          body: `Auto-paused "${item.campaign_name}" to save budget ($${spend} spent with 0 sales).`,
          icon: '/icon-192.png',
          data: { url: '/meta' },
        });
      } catch (pauseErr) {
        console.error('[ad-optimizer] Failed to pause campaign:', pauseErr);
      }
    }

    // B. Check Winner Rule
    if (conversions >= 3 && roas >= 3.5) {
      winning.push({
        id: item.campaign_id,
        name: item.campaign_name,
        spend,
        roas,
        message: `High ROAS (${roas.toFixed(1)}x) with ${conversions} purchases. Consider scaling budget by +20%!`,
      });
    }
  }

  // Update last_evaluated_at
  if (stopLossRule) {
    await db
      .from('meta_ad_rules')
      .update({ last_evaluated_at: new Date().toISOString() })
      .eq('id', stopLossRule.id);
  }

  return {
    evaluatedCount: insights.length,
    pausedCampaigns: paused,
    winningCampaigns: winning,
  };
}
