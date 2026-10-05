-- ============================================================
-- 062_ai_actions_and_custom_tools.sql
--
-- Adds:
-- 1. ai_action_settings: Granular ON/OFF toggles for built-in autonomous actions
-- 2. ai_custom_actions: User-defined custom AI tools (location, discounts, owner alerts, webhooks)
-- ============================================================

-- 1. ai_action_settings table
CREATE TABLE IF NOT EXISTS ai_action_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  auto_order_creation BOOLEAN NOT NULL DEFAULT true,
  auto_courier_booking BOOLEAN NOT NULL DEFAULT false, -- safe default: manual review or opt-in
  risk_engine BOOLEAN NOT NULL DEFAULT true,
  auto_followup BOOLEAN NOT NULL DEFAULT true,
  send_product_images BOOLEAN NOT NULL DEFAULT true,
  voice_notes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_settings_account ON ai_action_settings(account_id);

ALTER TABLE ai_action_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view ai action settings" ON ai_action_settings;
CREATE POLICY "Account members can view ai action settings" ON ai_action_settings
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage ai action settings" ON ai_action_settings;
CREATE POLICY "Agents can manage ai action settings" ON ai_action_settings
  FOR ALL USING (is_account_member(account_id));

-- 2. ai_custom_actions table
CREATE TABLE IF NOT EXISTS ai_custom_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                                  -- e.g. 'send_store_location'
  description TEXT NOT NULL,                           -- Prompt instruction for LLM
  action_type TEXT NOT NULL DEFAULT 'fixed_reply',     -- 'fixed_reply', 'instant_coupon', 'notify_owner', 'webhook'
  config JSONB NOT NULL DEFAULT '{}'::jsonb,           -- Action parameters
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_custom_actions_account ON ai_custom_actions(account_id);

ALTER TABLE ai_custom_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view ai custom actions" ON ai_custom_actions;
CREATE POLICY "Account members can view ai custom actions" ON ai_custom_actions
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage ai custom actions" ON ai_custom_actions;
CREATE POLICY "Agents can manage ai custom actions" ON ai_custom_actions
  FOR ALL USING (is_account_member(account_id));
