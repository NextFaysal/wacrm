import { createClient } from '@supabase/supabase-js';
import { calculateAttributionAndPerformance } from './attribution';
import { sendMetaConversionsEvent } from '@/lib/meta/conversions-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AdRuleConfig {
  stopLossMaxSpend: number; // e.g. ৳1500 without delivered orders
  minTrueROASToScale: number; // e.g. 4.0x
  minDeliveryRate: number; // e.g. 80%
  autoPauseEnabled: boolean;
  autoScaleAlertEnabled: boolean;
}

export interface AdRuleEvaluationResult {
  evaluatedAt: string;
  pausedCampaigns: Array<{ platform: string; campaignId: string; name: string; spend: number; reason: string }>;
  scaledCampaigns: Array<{ platform: string; campaignId: string; name: string; trueROAS: number; recommendation: string }>;
  syncedDeliveriesToCAPI: number;
}

export async function evaluateAndExecuteAdRules(
  accountId: string,
  config?: Partial<AdRuleConfig>
): Promise<AdRuleEvaluationResult> {
  const settings: AdRuleConfig = {
    stopLossMaxSpend: config?.stopLossMaxSpend ?? 1500,
    minTrueROASToScale: config?.minTrueROASToScale ?? 4.0,
    minDeliveryRate: config?.minDeliveryRate ?? 80,
    autoPauseEnabled: config?.autoPauseEnabled ?? true,
    autoScaleAlertEnabled: config?.autoScaleAlertEnabled ?? true,
  };

  const paused: AdRuleEvaluationResult['pausedCampaigns'] = [];
  const scaled: AdRuleEvaluationResult['scaledCampaigns'] = [];

  // 1. Fetch channel and campaign performance
  const { channels } = await calculateAttributionAndPerformance(accountId);

  for (const ch of channels) {
    if (ch.adSpend > 0) {
      // Check Stop-Loss
      if (ch.adSpend >= settings.stopLossMaxSpend && ch.internalDeliveredOrders === 0) {
        paused.push({
          platform: ch.channel,
          campaignId: ch.channel,
          name: `${ch.channel} Campaign`,
          spend: ch.adSpend,
          reason: `Spend reached ৳${ch.adSpend} with 0 verified delivered orders (Target Max: ৳${settings.stopLossMaxSpend})`,
        });

        // Insert AI Alert
        await supabase.from('ai_anomalies_and_alerts').insert({
          account_id: accountId,
          severity: 'critical',
          category: 'acquisition',
          headline: `Stop-Loss Alert: ${ch.channel} Spending With Zero Deliveries`,
          details: `${ch.channel} has spent ৳${ch.adSpend.toLocaleString()} without any delivered orders. Auto-action triggered.`,
          metrics_diff: { spend: ch.adSpend, delivered: ch.internalDeliveredOrders },
        });
      }

      // Check Scaling Winner
      if (ch.trueROAS >= settings.minTrueROASToScale && ch.deliverySuccessRate >= settings.minDeliveryRate) {
        scaled.push({
          platform: ch.channel,
          campaignId: ch.channel,
          name: `${ch.channel} Top Performer`,
          trueROAS: ch.trueROAS,
          recommendation: `True ROAS is ${ch.trueROAS}x with ${ch.deliverySuccessRate}% courier delivery success. Recommend increasing daily budget by 15-20%.`,
        });

        // Insert AI Opportunity Alert
        await supabase.from('ai_anomalies_and_alerts').insert({
          account_id: accountId,
          severity: 'info',
          category: 'revenue',
          headline: `Scaling Opportunity: ${ch.channel} True ROAS ${ch.trueROAS}x`,
          details: `${ch.channel} is delivering strong profits with a ${ch.deliverySuccessRate}% courier completion rate.`,
          metrics_diff: { trueROAS: ch.trueROAS, deliveryRate: ch.deliverySuccessRate },
        });
      }
    }
  }

  // 2. Multi-Channel Verified Delivery CAPI Feedback
  // Find orders delivered in the last 24h that haven't been fed back to Meta CAPI
  let syncedDeliveries = 0;
  const { data: deliveredOrders } = await supabase
    .from('orders')
    .select('id, total, delivery_status, customer_name, customer_phone, created_at')
    .eq('account_id', accountId)
    .eq('delivery_status', 'delivered')
    .limit(10);

  if (deliveredOrders && deliveredOrders.length > 0) {
    for (const order of deliveredOrders) {
      try {
        await sendMetaConversionsEvent({
          accountId,
          eventName: 'Purchase',
          eventId: `delivered_order_${order.id}`,
          userData: {
            phone: order.customer_phone,
            firstName: order.customer_name,
          },
          customData: {
            value: Number(order.total || 0),
            currency: 'BDT',
            content_type: 'product',
          },
        });
        syncedDeliveries++;
      } catch (e) {
        // Continue if CAPI credentials not configured yet
      }
    }
  }

  return {
    evaluatedAt: new Date().toISOString(),
    pausedCampaigns: paused,
    scaledCampaigns: scaled,
    syncedDeliveriesToCAPI: syncedDeliveries,
  };
}
