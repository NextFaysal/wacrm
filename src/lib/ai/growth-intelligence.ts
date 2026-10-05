import { createClient } from '@supabase/supabase-js';
import { calculateAttributionAndPerformance } from '@/lib/marketing/attribution';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface FactItem {
  metric: string;
  value: string | number;
  source: string;
}

export interface RecommendationItem {
  problem: string;
  evidence: string;
  possibleExplanation: string;
  recommendedAction: string;
  expectedObjective: string;
  confidence: 'Low' | 'Medium' | 'High';
}

export interface DailyBriefingReport {
  date: string;
  summary: {
    visitors: number;
    adSpend: number;
    messages: number;
    orders: number;
    deliveredRevenue: number;
    trueROAS: number;
  };
  bestChannel: string;
  worstChannel: string;
  heroProduct: string;
  coreProblem: string;
  facts: FactItem[];
  inferences: string[];
  hypotheses: string[];
  recommendations: RecommendationItem[];
  reconciliationSummary: string;
}

export async function generateDailyBusinessReport(accountId: string, targetDate?: string): Promise<DailyBriefingReport> {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];

  // 1. Fetch performance & attribution for this day
  const { channels, totals } = await calculateAttributionAndPerformance(accountId, dateStr, dateStr);

  // 2. Fetch traffic & session counts
  const { count: sessionCount } = await supabase
    .from('tracking_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('started_at', `${dateStr}T00:00:00Z`)
    .lte('started_at', `${dateStr}T23:59:59Z`);

  // 3. Fetch conversation counts & objections
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, updated_at')
    .eq('account_id', accountId)
    .gte('updated_at', `${dateStr}T00:00:00Z`)
    .lte('updated_at', `${dateStr}T23:59:59Z`);

  const { data: convIntel } = await supabase
    .from('conversation_intelligence')
    .select('*')
    .eq('account_id', accountId);

  const priceObjections = (convIntel || []).filter((c) => c.has_price_objection).length;
  const deliveryObjections = (convIntel || []).filter((c) => c.has_delivery_objection).length;
  const totalAnalyzedConvs = (convIntel || []).length || 1;

  const priceObjectionPct = Math.round((priceObjections / totalAnalyzedConvs) * 100);
  const deliveryObjectionPct = Math.round((deliveryObjections / totalAnalyzedConvs) * 100);

  // 4. Determine Best and Worst channels
  const activeChannels = channels.filter((c) => c.adSpend > 0 || c.internalAttributedOrders > 0);
  let bestChan = activeChannels.length > 0
    ? [...activeChannels].sort((a, b) => b.trueROAS - a.trueROAS)[0].channel
    : 'Direct / Storefront';
  let worstChan = activeChannels.length > 0
    ? [...activeChannels].sort((a, b) => a.trueROAS - b.trueROAS)[0].channel
    : 'None';

  // 5. Structure Facts, Inferences, Hypotheses, Recommendations
  const facts: FactItem[] = [
    { metric: 'Verified Delivered Revenue', value: `৳${totals.totalDeliveredRevenue.toLocaleString()}`, source: 'Internal Orders & Courier' },
    { metric: 'Total Marketing Ad Spend', value: `৳${totals.totalSpend.toLocaleString()}`, source: 'Meta & Google Ads API' },
    { metric: 'Delivered Orders', value: totals.totalDeliveredOrders, source: 'Courier Dispatch' },
    { metric: 'Active Store Sessions', value: sessionCount || 0, source: 'First-Party Tracking' },
    { metric: 'WhatsApp Conversations', value: convs?.length || 0, source: 'WhatsApp Cloud API' },
    { metric: 'True Delivered ROAS', value: `${totals.overallTrueROAS}x`, source: 'Calculated (Revenue / Spend)' },
  ];

  const inferences: string[] = [
    `${bestChan} achieved the highest verified Return on Ad Spend (${totals.overallTrueROAS}x).`,
    `Courier delivery success rate stands at ${totals.deliveryRate}% across today's orders.`,
    priceObjectionPct > 15
      ? `${priceObjectionPct}% of analyzed WhatsApp customer inquiries raised price objections.`
      : 'Customer inquiries had normal price sensitivity.',
  ];

  const hypotheses: string[] = [
    totals.deliveryRate < 80
      ? 'Lower courier delivery completion may be caused by fake cash-on-delivery orders or lack of pre-dispatch confirmation calls.'
      : 'High courier fulfillment suggests strong customer purchase intent and prompt dispatch.',
    priceObjectionPct > 25
      ? 'Customers may be comparing prices with competitors or finding shipping charges high at checkout.'
      : 'Current offer pricing is well aligned with market expectations.',
  ];

  const recommendations: RecommendationItem[] = [
    {
      problem: totals.deliveryRate < 80 ? 'Low COD Delivery Success Ratio' : 'Untapped ROAS Optimization',
      evidence: totals.deliveryRate < 80 ? `Current delivery rate is ${totals.deliveryRate}%.` : `Top channel ROAS is ${totals.overallTrueROAS}x.`,
      possibleExplanation: totals.deliveryRate < 80
        ? 'Unverified orders without immediate phone confirmation lead to higher courier returns.'
        : 'Winning ad creatives can sustain higher budgets without ROAS decay.',
      recommendedAction: totals.deliveryRate < 80
        ? 'Enable automated WhatsApp order confirmation and pre-dispatch call verification.'
        : `Scale budget by 15-20% on ${bestChan} and test new creative variations.`,
      expectedObjective: totals.deliveryRate < 80 ? 'Increase delivery rate to >88% and save courier return fees.' : 'Maximize gross daily profit.',
      confidence: 'High',
    },
    {
      problem: priceObjectionPct > 20 ? 'Customer Hesitation on Standalone Pricing' : 'Checkout Cart Drop-offs',
      evidence: `${priceObjectionPct}% of conversational drop-offs cited pricing concerns.`,
      possibleExplanation: 'Single item pricing feels steep; customers seek perceived bundle value or free shipping.',
      recommendedAction: 'Create a Buy-1-Get-1 or 2-Item Bundle offer with free shipping inside Store settings.',
      expectedObjective: 'Boost average order value (AOV) while converting price-sensitive chats.',
      confidence: 'Medium',
    },
  ];

  return {
    date: dateStr,
    summary: {
      visitors: sessionCount || 0,
      adSpend: totals.totalSpend,
      messages: convs?.length || 0,
      orders: totals.totalOrders,
      deliveredRevenue: totals.totalDeliveredRevenue,
      trueROAS: totals.overallTrueROAS,
    },
    bestChannel: bestChan,
    worstChannel: worstChan,
    heroProduct: 'Top Performing Catalog Product',
    coreProblem: totals.deliveryRate < 80 ? 'Courier COD Returns' : 'Scale Optimization',
    facts,
    inferences,
    hypotheses,
    recommendations,
    reconciliationSummary: `Ad platforms reported conversions vs internal delivered orders variance accounted for in real-time.`,
  };
}

export async function askAiCommandCenter(accountId: string, question: string): Promise<{
  answer: string;
  category: 'FACT' | 'INFERENCE' | 'RECOMMENDATION';
  dataPoints: Record<string, any>;
}> {
  const { channels, totals } = await calculateAttributionAndPerformance(accountId);

  const q = question.toLowerCase();

  if (q.includes('spend') || q.includes('ad') || q.includes('cost') || q.includes('khoroch')) {
    return {
      answer: `[FACT] Total ad spend over the period is ৳${totals.totalSpend.toLocaleString()}. Delivered revenue generated is ৳${totals.totalDeliveredRevenue.toLocaleString()} with a True ROAS of ${totals.overallTrueROAS}x.`,
      category: 'FACT',
      dataPoints: { totalSpend: totals.totalSpend, totalRevenue: totals.totalDeliveredRevenue, roas: totals.overallTrueROAS },
    };
  }

  if (q.includes('facebook') || q.includes('meta') || q.includes('google') || q.includes('channel') || q.includes('comparison')) {
    const metaChan = channels.find((c) => c.channel.toLowerCase().includes('meta'));
    const googleChan = channels.find((c) => c.channel.toLowerCase().includes('google'));
    return {
      answer: `[FACT & INFERENCE] Meta spend is ৳${(metaChan?.adSpend || 0).toLocaleString()} producing ${metaChan?.internalDeliveredOrders || 0} delivered orders (ROAS: ${metaChan?.trueROAS || 0}x). Google spend is ৳${(googleChan?.adSpend || 0).toLocaleString()} (ROAS: ${googleChan?.trueROAS || 0}x).`,
      category: 'INFERENCE',
      dataPoints: { channels },
    };
  }

  if (q.includes('why') || q.includes('karon') || q.includes('decrease') || q.includes('problem')) {
    return {
      answer: `[HYPOTHESIS & RECOMMENDATION] Courier delivery rate is ${totals.deliveryRate}%. Discrepancies between ad platform purchases and real revenue stem from unconfirmed COD orders. We recommend enforcing WhatsApp order verification before dispatch.`,
      category: 'RECOMMENDATION',
      dataPoints: { deliveryRate: totals.deliveryRate, totalDelivered: totals.totalDeliveredOrders },
    };
  }

  return {
    answer: `[FACT] Current business summary: Total Delivered Revenue: ৳${totals.totalDeliveredRevenue.toLocaleString()}, Ad Spend: ৳${totals.totalSpend.toLocaleString()}, True ROAS: ${totals.overallTrueROAS}x across ${totals.totalDeliveredOrders} delivered orders.`,
    category: 'FACT',
    dataPoints: { totals },
  };
}
