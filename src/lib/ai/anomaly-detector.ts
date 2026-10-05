import { createClient } from '@supabase/supabase-js';
import { calculateAttributionAndPerformance } from '@/lib/marketing/attribution';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface DetectedAnomaly {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'acquisition' | 'product' | 'conversation' | 'revenue' | 'anomaly';
  headline: string;
  details: string;
  metricsDiff?: any;
  createdAt: string;
}

export async function scanAndDetectBusinessAnomalies(accountId: string): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  // 1. Scan Marketing Performance
  const { channels, totals } = await calculateAttributionAndPerformance(accountId);

  // Check ROAS or High Spend without deliveries
  for (const ch of channels) {
    if (ch.adSpend > 1000 && ch.internalDeliveredOrders === 0) {
      const alert = {
        account_id: accountId,
        severity: 'critical' as const,
        category: 'acquisition' as const,
        headline: `CPA Spike: ${ch.channel} Spent ৳${ch.adSpend.toLocaleString()} with Zero Deliveries`,
        details: `Ad spend has reached ৳${ch.adSpend} without resulting in confirmed courier fulfillment. Consider pausing immediately.`,
        metrics_diff: { spend: ch.adSpend, delivered: ch.internalDeliveredOrders },
      };

      const { data: inserted } = await supabase
        .from('ai_anomalies_and_alerts')
        .insert(alert)
        .select()
        .single();

      if (inserted) anomalies.push({ ...inserted, createdAt: inserted.created_at, metricsDiff: inserted.metrics_diff });
    }
  }

  // Check Courier Delivery Rate
  if (totals.totalOrders >= 5 && totals.deliveryRate < 70) {
    const alert = {
      account_id: accountId,
      severity: 'warning' as const,
      category: 'revenue' as const,
      headline: `Courier Return Anomaly: Delivery Rate Dropped to ${totals.deliveryRate}%`,
      details: `30%+ of dispatched orders are failing or returning. Enforce phone call verification before shipping.`,
      metrics_diff: { deliveryRate: totals.deliveryRate, totalOrders: totals.totalOrders },
    };

    const { data: inserted } = await supabase
      .from('ai_anomalies_and_alerts')
      .insert(alert)
      .select()
      .single();

    if (inserted) anomalies.push({ ...inserted, createdAt: inserted.created_at, metricsDiff: inserted.metrics_diff });
  }

  // 2. Fetch all active unread anomalies
  const { data: allActive } = await supabase
    .from('ai_anomalies_and_alerts')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(10);

  return (allActive || []).map((a) => ({
    id: a.id,
    severity: a.severity,
    category: a.category,
    headline: a.headline,
    details: a.details,
    metricsDiff: a.metrics_diff,
    createdAt: a.created_at,
  }));
}
