import { SupabaseClient } from '@supabase/supabase-js';

export type PlanTier = 'starter' | 'growth' | 'business' | 'enterprise';

export interface PlanLimits {
  name: string;
  priceBdt: number;
  maxMonthlyOrders: number; // -1 for unlimited
  maxMonthlySessions: number; // -1 for unlimited
  maxAdAccounts: number;
  whatsappBriefingEnabled: boolean;
  adAutoPilotEnabled: boolean;
  customReportsEnabled: boolean;
  retentionDays: number;
}

export const PLAN_TIERS: Record<PlanTier, PlanLimits> = {
  starter: {
    name: 'Starter',
    priceBdt: 1999,
    maxMonthlyOrders: 300,
    maxMonthlySessions: 10000,
    maxAdAccounts: 1,
    whatsappBriefingEnabled: false,
    adAutoPilotEnabled: false,
    customReportsEnabled: false,
    retentionDays: 30,
  },
  growth: {
    name: 'Growth',
    priceBdt: 4999,
    maxMonthlyOrders: 2000,
    maxMonthlySessions: 100000,
    maxAdAccounts: 5,
    whatsappBriefingEnabled: true,
    adAutoPilotEnabled: true,
    customReportsEnabled: true,
    retentionDays: 90,
  },
  business: {
    name: 'Business',
    priceBdt: 9999,
    maxMonthlyOrders: 10000,
    maxMonthlySessions: 500000,
    maxAdAccounts: 15,
    whatsappBriefingEnabled: true,
    adAutoPilotEnabled: true,
    customReportsEnabled: true,
    retentionDays: 365,
  },
  enterprise: {
    name: 'Enterprise',
    priceBdt: 19999,
    maxMonthlyOrders: -1, // Unlimited
    maxMonthlySessions: -1, // Unlimited
    maxAdAccounts: -1, // Unlimited
    whatsappBriefingEnabled: true,
    adAutoPilotEnabled: true,
    customReportsEnabled: true,
    retentionDays: 730,
  },
};

export async function getAccountPlan(supabase: SupabaseClient, accountId: string) {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !account) {
    // Default to growth plan fallback
    return {
      tier: 'growth' as PlanTier,
      limits: PLAN_TIERS.growth,
      status: 'active',
      usage: {
        month: new Date().toISOString().slice(0, 7),
        orders: 0,
        sessions: 0,
        adAccounts: 0,
      },
      isOverQuota: false,
      isOverOrders: false,
      isOverSessions: false,
    };
  }

  const tier = (account.plan_tier as PlanTier) || 'growth';
  const baseLimits = PLAN_TIERS[tier] || PLAN_TIERS.growth;

  const effectiveLimits: PlanLimits = {
    ...baseLimits,
    maxMonthlyOrders: account.custom_monthly_orders_limit ?? baseLimits.maxMonthlyOrders,
    maxMonthlySessions: account.custom_monthly_sessions_limit ?? baseLimits.maxMonthlySessions,
    maxAdAccounts: account.custom_ad_accounts_limit ?? baseLimits.maxAdAccounts,
    whatsappBriefingEnabled: account.plan_whatsapp_briefing_enabled ?? baseLimits.whatsappBriefingEnabled,
  };

  const currentMonth = new Date().toISOString().slice(0, 7); // e.g., '2026-10'
  const { data: usage } = await supabase
    .from('plan_usage_snapshots')
    .select('*')
    .eq('account_id', accountId)
    .eq('billing_month', currentMonth)
    .maybeSingle();

  const ordersCount = usage?.total_orders_tracked || 0;
  const sessionsCount = usage?.total_sessions_tracked || 0;
  const adAccountsCount = usage?.ad_accounts_connected || 0;

  const isOverOrders = effectiveLimits.maxMonthlyOrders !== -1 && ordersCount >= effectiveLimits.maxMonthlyOrders;
  const isOverSessions = effectiveLimits.maxMonthlySessions !== -1 && sessionsCount >= effectiveLimits.maxMonthlySessions;

  return {
    tier,
    status: account.subscription_status || 'active',
    limits: effectiveLimits,
    usage: {
      month: currentMonth,
      orders: ordersCount,
      sessions: sessionsCount,
      adAccounts: adAccountsCount,
    },
    isOverQuota: isOverOrders || isOverSessions,
    isOverOrders,
    isOverSessions,
  };
}

export async function checkQuota(
  supabase: SupabaseClient,
  accountId: string,
  resource: 'orders' | 'sessions' | 'ad_accounts'
): Promise<{ allowed: boolean; current: number; limit: number; tier: PlanTier; reason?: string }> {
  const planInfo = await getAccountPlan(supabase, accountId);

  if (resource === 'orders') {
    const limit = planInfo.limits.maxMonthlyOrders;
    const current = planInfo.usage.orders;
    if (limit !== -1 && current >= limit) {
      return {
        allowed: false,
        current,
        limit,
        tier: planInfo.tier,
        reason: `Monthly order tracking limit reached (${current}/${limit}) for ${planInfo.tier.toUpperCase()} plan. Upgrade to unlock unlimited orders.`,
      };
    }
    return { allowed: true, current, limit, tier: planInfo.tier };
  }

  if (resource === 'sessions') {
    const limit = planInfo.limits.maxMonthlySessions;
    const current = planInfo.usage.sessions;
    if (limit !== -1 && current >= limit) {
      return {
        allowed: false,
        current,
        limit,
        tier: planInfo.tier,
        reason: `Monthly visitor session limit reached (${current}/${limit}) for ${planInfo.tier.toUpperCase()} plan. Upgrade to track more traffic.`,
      };
    }
    return { allowed: true, current, limit, tier: planInfo.tier };
  }

  if (resource === 'ad_accounts') {
    const limit = planInfo.limits.maxAdAccounts;
    const current = planInfo.usage.adAccounts;
    if (limit !== -1 && current >= limit) {
      return {
        allowed: false,
        current,
        limit,
        tier: planInfo.tier,
        reason: `Ad account limit reached (${current}/${limit}) for ${planInfo.tier.toUpperCase()} plan.`,
      };
    }
    return { allowed: true, current, limit, tier: planInfo.tier };
  }

  return { allowed: true, current: 0, limit: -1, tier: planInfo.tier };
}

export async function incrementPlanUsage(
  supabase: SupabaseClient,
  accountId: string,
  metric: 'orders' | 'sessions' | 'briefings',
  amount = 1
) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Try to upsert row
  const { data: existing } = await supabase
    .from('plan_usage_snapshots')
    .select('id, total_orders_tracked, total_sessions_tracked, briefings_dispatched')
    .eq('account_id', accountId)
    .eq('billing_month', currentMonth)
    .maybeSingle();

  if (existing) {
    const updates: any = { updated_at: new Date().toISOString() };
    if (metric === 'orders') updates.total_orders_tracked = (existing.total_orders_tracked || 0) + amount;
    if (metric === 'sessions') updates.total_sessions_tracked = (existing.total_sessions_tracked || 0) + amount;
    if (metric === 'briefings') updates.briefings_dispatched = (existing.briefings_dispatched || 0) + amount;

    await supabase
      .from('plan_usage_snapshots')
      .update(updates)
      .eq('id', existing.id);
  } else {
    await supabase.from('plan_usage_snapshots').insert({
      account_id: accountId,
      billing_month: currentMonth,
      total_orders_tracked: metric === 'orders' ? amount : 0,
      total_sessions_tracked: metric === 'sessions' ? amount : 0,
      briefings_dispatched: metric === 'briefings' ? amount : 0,
    });
  }
}
