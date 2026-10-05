-- ============================================================
-- MASTER_GROWTH_AND_BILLING_MIGRATION.sql
-- Complete Multi-Tenant Growth & Marketing Intelligence + Billing Suite
-- Safe, idempotent execution for Supabase SQL Editor
-- ============================================================

-- 1. Extend accounts table with SaaS Subscription & Quotas
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

-- 3. Core Growth Tables (ai_growth_recommendations, ai_business_reports, ai_anomalies_and_alerts, growth_experiments)
CREATE TABLE IF NOT EXISTS public.ai_growth_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  evidence TEXT NOT NULL,
  possible_explanation TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  expected_objective TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'Medium' CHECK (confidence IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'applied', 'dismissed')),
  impact_measured JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recs_acc_status ON public.ai_growth_recommendations(account_id, status);
ALTER TABLE public.ai_growth_recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_growth_recommendations' 
    AND policyname = 'Account members can manage recommendations'
  ) THEN
    CREATE POLICY "Account members can manage recommendations" ON public.ai_growth_recommendations
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.account_members
          WHERE account_members.account_id = ai_growth_recommendations.account_id
            AND account_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  best_channel TEXT,
  worst_channel TEXT,
  hero_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  core_problem TEXT,
  executive_summary TEXT NOT NULL,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  inferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  hypotheses JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, report_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_acc_type ON public.ai_business_reports(account_id, report_type, period_start DESC);
ALTER TABLE public.ai_business_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_business_reports' 
    AND policyname = 'Account members can manage business reports'
  ) THEN
    CREATE POLICY "Account members can manage business reports" ON public.ai_business_reports
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.account_members
          WHERE account_members.account_id = ai_business_reports.account_id
            AND account_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_anomalies_and_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('acquisition', 'product', 'conversation', 'revenue', 'anomaly')),
  headline TEXT NOT NULL,
  details TEXT NOT NULL,
  metrics_diff JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_acc ON public.ai_anomalies_and_alerts(account_id, is_read, severity);
ALTER TABLE public.ai_anomalies_and_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_anomalies_and_alerts' 
    AND policyname = 'Account members can manage alerts'
  ) THEN
    CREATE POLICY "Account members can manage alerts" ON public.ai_anomalies_and_alerts
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.account_members
          WHERE account_members.account_id = ai_anomalies_and_alerts.account_id
            AND account_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.growth_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('price', 'bundle_offer', 'landing_page', 'creative', 'cta', 'script')),
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('draft', 'running', 'concluded')),
  started_at TIMESTAMPTZ DEFAULT now(),
  concluded_at TIMESTAMPTZ,
  baseline_metrics JSONB DEFAULT '{"visitors": 450, "conversions": 16, "revenue": 21800}'::jsonb,
  test_metrics JSONB DEFAULT '{"visitors": 480, "conversions": 25, "revenue": 34900}'::jsonb,
  ai_evaluation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_exp_acc ON public.growth_experiments(account_id, status);
ALTER TABLE public.growth_experiments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'growth_experiments' 
    AND policyname = 'Account members can manage growth experiments'
  ) THEN
    CREATE POLICY "Account members can manage growth experiments" ON public.growth_experiments
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.account_members
          WHERE account_members.account_id = growth_experiments.account_id
            AND account_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 4. Initial Seed for Sample Growth Experiment if none exist
DO $$
DECLARE
  v_acc_id UUID;
BEGIN
  SELECT id INTO v_acc_id FROM public.accounts LIMIT 1;
  IF v_acc_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.growth_experiments WHERE account_id = v_acc_id) THEN
      INSERT INTO public.growth_experiments (account_id, name, hypothesis, test_type, status, baseline_metrics, test_metrics)
      VALUES (
        v_acc_id,
        'Free Delivery Threshold ৳1,000 vs Flat ৳100 Discount',
        'Offering Free Delivery for orders above ৳1,000 will reduce checkout abandonment and boost AOV by 20%+',
        'bundle_offer',
        'running',
        '{"visitors": 450, "conversions": 16, "revenue": 21800}'::jsonb,
        '{"visitors": 480, "conversions": 25, "revenue": 34900}'::jsonb
      );
    END IF;
  END IF;
END $$;
