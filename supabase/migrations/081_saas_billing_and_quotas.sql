-- ============================================================
-- 081_saas_billing_and_quotas.sql
-- Multi-Tenant SaaS Billing, Plan Tiers & Quota Enforcement
-- ============================================================

-- 1. Extend accounts with SaaS Subscription & Quota Fields
ALTER TABLE public.accounts 
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'growth',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS billing_cycle_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS custom_monthly_orders_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_monthly_sessions_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_ad_accounts_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_whatsapp_briefing_enabled BOOLEAN DEFAULT TRUE;

-- 2. Create Plan Usage Snapshots table
CREATE TABLE IF NOT EXISTS public.plan_usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL, -- e.g. '2026-10'
  total_orders_tracked INTEGER NOT NULL DEFAULT 0,
  total_sessions_tracked INTEGER NOT NULL DEFAULT 0,
  ad_accounts_connected INTEGER NOT NULL DEFAULT 0,
  briefings_dispatched INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_account_billing_month UNIQUE (account_id, billing_month)
);

ALTER TABLE public.plan_usage_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plan_usage_snapshots' AND policyname = 'account_members_read_usage'
  ) THEN
    CREATE POLICY account_members_read_usage ON public.plan_usage_snapshots
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.account_members
          WHERE account_members.account_id = plan_usage_snapshots.account_id
            AND account_members.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plan_usage_snapshots' AND policyname = 'service_role_manage_usage'
  ) THEN
    CREATE POLICY service_role_manage_usage ON public.plan_usage_snapshots
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_usage_account_month ON public.plan_usage_snapshots(account_id, billing_month);
