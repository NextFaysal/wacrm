-- ============================================================
-- ALL_MIGRATIONS_080_GROWTH_INTELLIGENCE.sql
-- Paste and Run in Supabase SQL Editor:
-- Adds First-Party Tracking, Marketing Attribution, Ad Reconciliation,
-- Conversational Intelligence, and AI Growth Reports.
-- ============================================================

-- 1. Unified Marketing Integrations (Meta, Google, TikTok)
CREATE TABLE IF NOT EXISTS public.marketing_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  account_external_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  pixel_or_tag_id TEXT,
  capi_access_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, platform, account_external_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_integrations_acc ON public.marketing_integrations(account_id, platform);
ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_integrations' AND policyname = 'Account members can manage marketing integrations') THEN
    CREATE POLICY "Account members can manage marketing integrations" ON public.marketing_integrations FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 2. Unified Campaigns, Ad Groups/Sets & Ads
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.marketing_integrations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  external_campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  objective TEXT,
  daily_budget NUMERIC(12, 2),
  lifetime_budget NUMERIC(12, 2),
  currency TEXT DEFAULT 'BDT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, platform, external_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_acc ON public.marketing_campaigns(account_id, platform);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_campaigns' AND policyname = 'Account members can view marketing campaigns') THEN
    CREATE POLICY "Account members can view marketing campaigns" ON public.marketing_campaigns FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.marketing_ad_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  external_ad_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  bid_strategy TEXT,
  targeting JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, platform, external_ad_group_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_ad_groups_acc ON public.marketing_ad_groups(account_id, campaign_id);
ALTER TABLE public.marketing_ad_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_ad_groups' AND policyname = 'Account members can view ad groups') THEN
    CREATE POLICY "Account members can view ad groups" ON public.marketing_ad_groups FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.marketing_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  ad_group_id UUID NOT NULL REFERENCES public.marketing_ad_groups(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  external_ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  creative_url TEXT,
  preview_url TEXT,
  tracking_utm_params JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, platform, external_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_ads_acc ON public.marketing_ads(account_id, ad_group_id);
ALTER TABLE public.marketing_ads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_ads' AND policyname = 'Account members can view ads') THEN
    CREATE POLICY "Account members can view ads" ON public.marketing_ads FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 3. Normalized Daily Ad Spend & Platform Metrics
CREATE TABLE IF NOT EXISTS public.marketing_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
  campaign_id UUID,
  ad_group_id UUID,
  ad_id UUID,
  date DATE NOT NULL,
  spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  cpc NUMERIC(10, 4) DEFAULT 0,
  cpm NUMERIC(10, 4) DEFAULT 0,
  ctr NUMERIC(6, 4) DEFAULT 0,
  platform_conversions INTEGER NOT NULL DEFAULT 0,
  platform_conversion_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_daily_acc_date ON public.marketing_daily_metrics(account_id, date, platform);
ALTER TABLE public.marketing_daily_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_daily_metrics' AND policyname = 'Account members can view marketing daily metrics') THEN
    CREATE POLICY "Account members can view marketing daily metrics" ON public.marketing_daily_metrics FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 4. First-Party Tracking: Visitors, Sessions & Events
CREATE TABLE IF NOT EXISTS public.tracking_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  visitor_token TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_type TEXT DEFAULT 'mobile',
  os TEXT,
  browser TEXT,
  country TEXT DEFAULT 'Bangladesh',
  city TEXT,
  division TEXT,
  ip_address TEXT,
  total_sessions INTEGER DEFAULT 1,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, visitor_token)
);

CREATE INDEX IF NOT EXISTS idx_tracking_visitors_token ON public.tracking_visitors(account_id, visitor_token);
ALTER TABLE public.tracking_visitors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_visitors' AND policyname = 'Account members can view tracking visitors') THEN
    CREATE POLICY "Account members can view tracking visitors" ON public.tracking_visitors FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  visitor_id UUID NOT NULL REFERENCES public.tracking_visitors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  landing_page TEXT NOT NULL DEFAULT '/',
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  fbclid TEXT,
  gclid TEXT,
  ttclid TEXT,
  detected_channel TEXT DEFAULT 'direct',
  campaign_id UUID,
  ad_id UUID,
  page_views_count INTEGER DEFAULT 1,
  has_cart_activity BOOLEAN DEFAULT false,
  has_checkout_activity BOOLEAN DEFAULT false,
  has_order_activity BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, session_token)
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_acc_started ON public.tracking_sessions(account_id, started_at DESC);
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_sessions' AND policyname = 'Account members can view tracking sessions') THEN
    CREATE POLICY "Account members can view tracking sessions" ON public.tracking_sessions FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES public.tracking_visitors(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.tracking_sessions(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_url TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_acc_name_time ON public.tracking_events(account_id, event_name, event_time DESC);
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_events' AND policyname = 'Account members can view tracking events') THEN
    CREATE POLICY "Account members can view tracking events" ON public.tracking_events FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 5. Sales & Order Attribution Engine
CREATE TABLE IF NOT EXISTS public.order_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES public.tracking_visitors(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.tracking_sessions(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  first_touch_channel TEXT DEFAULT 'direct',
  first_touch_campaign_id UUID,
  last_touch_channel TEXT DEFAULT 'direct',
  last_touch_campaign_id UUID,
  last_touch_ad_id UUID,
  attribution_model TEXT DEFAULT 'last_touch' CHECK (attribution_model IN ('first_touch', 'last_touch', 'linear')),
  order_total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  order_status TEXT DEFAULT 'pending',
  is_delivered BOOLEAN DEFAULT false,
  is_returned BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  delivered_revenue NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_attr_acc_chan ON public.order_attributions(account_id, last_touch_channel);
ALTER TABLE public.order_attributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_attributions' AND policyname = 'Account members can view order attributions') THEN
    CREATE POLICY "Account members can view order attributions" ON public.order_attributions FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 6. Conversational Analytics & Objection Intelligence
CREATE TABLE IF NOT EXISTS public.conversation_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  primary_intent TEXT DEFAULT 'inquiry',
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  has_price_objection BOOLEAN DEFAULT false,
  has_delivery_objection BOOLEAN DEFAULT false,
  has_trust_objection BOOLEAN DEFAULT false,
  product_interests UUID[] DEFAULT '{}',
  purchase_intent_score INTEGER DEFAULT 0,
  drop_off_reason TEXT,
  ai_summary TEXT,
  key_questions TEXT[] DEFAULT '{}',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_intel_acc_intent ON public.conversation_intelligence(account_id, primary_intent);
ALTER TABLE public.conversation_intelligence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_intelligence' AND policyname = 'Account members can view conversation intelligence') THEN
    CREATE POLICY "Account members can view conversation intelligence" ON public.conversation_intelligence FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 7. AI Business Reports
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_business_reports' AND policyname = 'Account members can view ai business reports') THEN
    CREATE POLICY "Account members can view ai business reports" ON public.ai_business_reports FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 8. AI Growth Recommendations
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_growth_recommendations' AND policyname = 'Account members can manage recommendations') THEN
    CREATE POLICY "Account members can manage recommendations" ON public.ai_growth_recommendations FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 9. AI Alerts & Anomalies
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_anomalies_and_alerts' AND policyname = 'Account members can view ai alerts') THEN
    CREATE POLICY "Account members can view ai alerts" ON public.ai_anomalies_and_alerts FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- 10. Growth Experiments
CREATE TABLE IF NOT EXISTS public.growth_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('price', 'bundle_offer', 'landing_page', 'creative', 'cta', 'script')),
  target_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'concluded')),
  started_at TIMESTAMPTZ,
  concluded_at TIMESTAMPTZ,
  baseline_metrics JSONB DEFAULT '{}'::jsonb,
  test_metrics JSONB DEFAULT '{}'::jsonb,
  ai_evaluation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_exp_acc ON public.growth_experiments(account_id, status);
ALTER TABLE public.growth_experiments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'growth_experiments' AND policyname = 'Account members can view growth experiments') THEN
    CREATE POLICY "Account members can view growth experiments" ON public.growth_experiments FOR ALL USING (is_account_member(account_id));
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
