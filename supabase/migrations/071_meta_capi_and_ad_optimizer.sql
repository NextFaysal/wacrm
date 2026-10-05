-- ============================================================
-- 071_meta_capi_and_ad_optimizer.sql
--
-- 1. Meta Conversions API (CAPI) columns on meta_integrations
-- 2. meta_capi_events table for tracking server-side events
-- 3. meta_ad_rules table for automated stop-loss and budget optimizer
-- ============================================================

-- 1. Extend meta_integrations with CAPI & Pixel credentials
ALTER TABLE meta_integrations
  ADD COLUMN IF NOT EXISTS pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS capi_access_token TEXT,
  ADD COLUMN IF NOT EXISTS capi_test_event_code TEXT,
  ADD COLUMN IF NOT EXISTS capi_enabled BOOLEAN DEFAULT true;

-- 2. Server-Side CAPI Events Log
CREATE TABLE IF NOT EXISTS meta_capi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL, -- 'Purchase', 'InitiateCheckout', 'AddToCart', 'Lead'
  event_id TEXT NOT NULL,
  event_time BIGINT NOT NULL,
  event_source_url TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_phone TEXT,
  customer_email TEXT,
  currency TEXT DEFAULT 'BDT',
  value NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  meta_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_capi_account ON meta_capi_events(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_order ON meta_capi_events(order_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_event_name ON meta_capi_events(event_name);
CREATE INDEX IF NOT EXISTS idx_meta_capi_created ON meta_capi_events(created_at DESC);

ALTER TABLE meta_capi_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage meta capi events" ON meta_capi_events;
CREATE POLICY "Account members can manage meta capi events" ON meta_capi_events
  FOR ALL USING (is_account_member(account_id));

-- 3. Meta Ad Automation & Stop-Loss Rules
CREATE TABLE IF NOT EXISTS meta_ad_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('stop_loss', 'scale_winner', 'budget_rebalance')),
  is_active BOOLEAN DEFAULT true,
  max_spend_threshold NUMERIC(12, 2) DEFAULT 15.00, -- e.g. $15 or equivalent
  min_roas_threshold NUMERIC(6, 2) DEFAULT 1.00,
  action TEXT NOT NULL CHECK (action IN ('pause_campaign', 'notify_only', 'increase_budget')),
  budget_increase_percent NUMERIC(5, 2) DEFAULT 20.00,
  last_evaluated_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_rules_account ON meta_ad_rules(account_id);

ALTER TABLE meta_ad_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage ad rules" ON meta_ad_rules;
CREATE POLICY "Account members can manage ad rules" ON meta_ad_rules
  FOR ALL USING (is_account_member(account_id));
