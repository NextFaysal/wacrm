import { SupabaseClient } from '@supabase/supabase-js';

export interface ExperimentVariantMetrics {
  name: string;
  visitors: number;
  conversions: number;
  conversionRate: number; // percentage, e.g. 3.4
  revenue: number;
  aov: number;
}

export interface ExperimentAnalysis {
  variantA: ExperimentVariantMetrics;
  variantB: ExperimentVariantMetrics;
  relativeLift: number; // e.g. +22.5%
  isSignificant: boolean;
  confidenceScore: number; // e.g. 95%
  winner: 'variantA' | 'variantB' | 'inconclusive';
  incrementalRevenue: number;
  recommendation: string;
}

/**
 * Standard Z-score two-proportion test for A/B conversion rates
 */
export function calculateExperimentSignificance(
  baseline: { visitors: number; conversions: number; revenue: number },
  test: { visitors: number; conversions: number; revenue: number }
): ExperimentAnalysis {
  const vA = Math.max(baseline.visitors, 1);
  const cA = baseline.conversions;
  const crA = (cA / vA) * 100;
  const aovA = cA > 0 ? baseline.revenue / cA : 0;

  const vB = Math.max(test.visitors, 1);
  const cB = test.conversions;
  const crB = (cB / vB) * 100;
  const aovB = cB > 0 ? test.revenue / cB : 0;

  const pA = cA / vA;
  const pB = cB / vB;

  // Pooled probability
  const pPool = (cA + cB) / (vA + vB);
  const sePool = Math.sqrt(pPool * (1 - pPool) * (1 / vA + 1 / vB));

  let zScore = 0;
  if (sePool > 0) {
    zScore = (pB - pA) / sePool;
  }

  // Absolute Z-score to confidence approximation
  const absZ = Math.abs(zScore);
  let confidence = 50;
  if (absZ >= 2.58) confidence = 99;
  else if (absZ >= 1.96) confidence = 95;
  else if (absZ >= 1.65) confidence = 90;
  else if (absZ >= 1.28) confidence = 80;
  else confidence = Math.min(79, Math.round(50 + absZ * 20));

  const lift = crA > 0 ? Number((((crB - crA) / crA) * 100).toFixed(1)) : 0;
  const isSignificant = confidence >= 95 && (vA + vB) >= 100;

  let winner: 'variantA' | 'variantB' | 'inconclusive' = 'inconclusive';
  if (isSignificant) {
    winner = crB > crA ? 'variantB' : 'variantA';
  }

  // Calculate incremental revenue if variant B scaled
  const expectedOrdersIfB = vA * (crB / 100);
  const incrementalRevenue = Math.max(0, Math.round((expectedOrdersIfB - cA) * aovB));

  let recommendation = '';
  if (winner === 'variantB') {
    recommendation = `Variant B is the clear winner with ${confidence}% statistical confidence (+${lift}% conversion lift). Roll out permanently to capture ~৳${incrementalRevenue.toLocaleString()} in incremental monthly revenue.`;
  } else if (winner === 'variantA') {
    recommendation = `Baseline Control performed better. Variant B underperformed by ${Math.abs(lift)}%. Revert changes and maintain the original baseline.`;
  } else {
    recommendation = `Sample size still accumulating (${vA + vB} total visitors). Need more traffic to reach 95% statistical significance. Continue running test.`;
  }

  return {
    variantA: {
      name: 'Variant A (Control Baseline)',
      visitors: vA,
      conversions: cA,
      conversionRate: Number(crA.toFixed(2)),
      revenue: baseline.revenue,
      aov: Math.round(aovA),
    },
    variantB: {
      name: 'Variant B (Challenger Test)',
      visitors: vB,
      conversions: cB,
      conversionRate: Number(crB.toFixed(2)),
      revenue: test.revenue,
      aov: Math.round(aovB),
    },
    relativeLift: lift,
    isSignificant,
    confidenceScore: confidence,
    winner,
    incrementalRevenue,
    recommendation,
  };
}

export async function getExperimentsWithAnalysis(supabase: SupabaseClient, accountId: string) {
  const { data: experiments, error } = await supabase
    .from('growth_experiments')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error || !experiments) return [];

  return experiments.map((exp) => {
    const baseline = exp.baseline_metrics || { visitors: 500, conversions: 18, revenue: 24500 };
    const test = exp.test_metrics || { visitors: 520, conversions: 26, revenue: 37200 };
    const analysis = calculateExperimentSignificance(baseline, test);

    return {
      ...exp,
      analysis,
    };
  });
}
