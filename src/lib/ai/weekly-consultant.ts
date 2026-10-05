import { createClient } from '@supabase/supabase-js';
import { calculateAttributionAndPerformance } from '@/lib/marketing/attribution';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface WeeklyComparisonMetrics {
  currentWeekDeliveredRevenue: number;
  previousWeekDeliveredRevenue: number;
  revenueChangePct: number;
  currentWeekSpend: number;
  previousWeekSpend: number;
  spendChangePct: number;
  currentTrueROAS: number;
  previousTrueROAS: number;
  roasChange: number;
  currentDeliveryRate: number;
  previousDeliveryRate: number;
}

export interface WeeklyConsultantBriefing {
  period: { thisWeek: string; previousWeek: string };
  metrics: WeeklyComparisonMetrics;
  executiveSummary: string;
  whatImproved: string[];
  whatDeclined: string[];
  whyItHappened: string[];
  growthOpportunities: string[];
  whatToTestNextWeek: string[];
  whatNotToChangeYet: string;
}

export async function generateWeeklyConsultantReport(accountId: string): Promise<WeeklyConsultantBriefing> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeekStart = d7.toISOString().split('T')[0];
  const thisWeekEnd = now.toISOString().split('T')[0];
  const prevWeekStart = d14.toISOString().split('T')[0];
  const prevWeekEnd = d7.toISOString().split('T')[0];

  // 1. Fetch current week and previous week data
  const [curr, prev] = await Promise.all([
    calculateAttributionAndPerformance(accountId, thisWeekStart, thisWeekEnd),
    calculateAttributionAndPerformance(accountId, prevWeekStart, prevWeekEnd),
  ]);

  const currRev = curr.totals.totalDeliveredRevenue;
  const prevRev = prev.totals.totalDeliveredRevenue;
  const revChangePct = prevRev > 0 ? Number((((currRev - prevRev) / prevRev) * 100).toFixed(1)) : 0;

  const currSpend = curr.totals.totalSpend;
  const prevSpend = prev.totals.totalSpend;
  const spendChangePct = prevSpend > 0 ? Number((((currSpend - prevSpend) / prevSpend) * 100).toFixed(1)) : 0;

  const currROAS = curr.totals.overallTrueROAS;
  const prevROAS = prev.totals.overallTrueROAS;
  const roasChange = Number((currROAS - prevROAS).toFixed(2));

  const currDelivery = curr.totals.deliveryRate;
  const prevDelivery = prev.totals.deliveryRate;

  const metrics: WeeklyComparisonMetrics = {
    currentWeekDeliveredRevenue: currRev,
    previousWeekDeliveredRevenue: prevRev,
    revenueChangePct: revChangePct,
    currentWeekSpend: currSpend,
    previousWeekSpend: prevSpend,
    spendChangePct: spendChangePct,
    currentTrueROAS: currROAS,
    previousTrueROAS: prevROAS,
    roasChange,
    currentDeliveryRate: currDelivery,
    previousDeliveryRate: prevDelivery,
  };

  // Structured intelligence extraction
  const whatImproved: string[] = [];
  const whatDeclined: string[] = [];
  const whyItHappened: string[] = [];
  const growthOpportunities: string[] = [];
  const whatToTestNextWeek: string[] = [];

  if (currRev >= prevRev) {
    whatImproved.push(`Delivered Revenue grew by ${revChangePct >= 0 ? '+' : ''}${revChangePct}% (৳${currRev.toLocaleString()} vs ৳${prevRev.toLocaleString()}).`);
  } else {
    whatDeclined.push(`Delivered Revenue decreased by ${Math.abs(revChangePct)}% compared to the prior 7 days.`);
  }

  if (currROAS >= prevROAS) {
    whatImproved.push(`True Delivered ROAS improved by +${roasChange}x to ${currROAS}x.`);
  } else {
    whatDeclined.push(`True ROAS softened by ${Math.abs(roasChange)}x to ${currROAS}x.`);
  }

  if (currDelivery >= prevDelivery) {
    whatImproved.push(`Courier delivery success rate remained solid at ${currDelivery}%.`);
  } else {
    whatDeclined.push(`Courier delivery completion dropped by ${prevDelivery - currDelivery}% down to ${currDelivery}%.`);
    whyItHappened.push(`Unverified COD orders placed during peak ad hours resulted in delayed or cancelled courier dispatches.`);
  }

  if (whatImproved.length === 0) {
    whatImproved.push('Stable operational baseline across product catalog.');
  }

  if (whyItHappened.length === 0) {
    whyItHappened.push('Ad creative relevance and checkout conversion remained aligned with previous baseline.');
  }

  growthOpportunities.push('Introduce bundle pricing with complimentary delivery on high-margin products.');
  growthOpportunities.push('Capitalize on high-converting geographic zones (e.g., Khulna/Rajshahi) with localized ad sets.');

  whatToTestNextWeek.push('A/B test a 2-item bundle offer on top catalog products to drive Average Order Value.');
  whatToTestNextWeek.push('Mandate automated WhatsApp pre-dispatch order verification to lift delivery completion above 88%.');

  const whatNotToChangeYet = 'Do not overhaul primary ad creative hooks or increase budget on new untested channels until at least 50 verified conversions are logged.';

  const executiveSummary = `During this 7-day period, the business realized ৳${currRev.toLocaleString()} in verified delivered revenue against ৳${currSpend.toLocaleString()} in advertising spend, achieving a True Delivered ROAS of ${currROAS}x. Courier fulfillment completion stands at ${currDelivery}%.`;

  return {
    period: { thisWeek: `${thisWeekStart} to ${thisWeekEnd}`, previousWeek: `${prevWeekStart} to ${prevWeekEnd}` },
    metrics,
    executiveSummary,
    whatImproved,
    whatDeclined,
    whyItHappened,
    growthOpportunities,
    whatToTestNextWeek,
    whatNotToChangeYet,
  };
}
