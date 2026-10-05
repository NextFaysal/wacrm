-- ============================================================
-- FIX_ALL_MISSING_TABLES_NOW.sql
-- Direct fix for all missing tables, columns, and PostgREST schema cache
-- Safe & idempotent: can be run multiple times without data loss
-- ============================================================

-- 1. Missing columns on business_settings
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_test_code TEXT;

-- 2. AI Actions Settings & Custom Tools (Migration 062)
CREATE TABLE IF NOT EXISTS public.ai_action_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  auto_order_creation BOOLEAN NOT NULL DEFAULT true,
  auto_courier_booking BOOLEAN NOT NULL DEFAULT false,
  risk_engine BOOLEAN NOT NULL DEFAULT true,
  auto_followup BOOLEAN NOT NULL DEFAULT true,
  send_product_images BOOLEAN NOT NULL DEFAULT true,
  voice_notes BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_settings_account ON public.ai_action_settings(account_id);
ALTER TABLE public.ai_action_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view ai action settings" ON public.ai_action_settings;
CREATE POLICY "Account members can view ai action settings" ON public.ai_action_settings
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS "Agents can manage ai action settings" ON public.ai_action_settings;
CREATE POLICY "Agents can manage ai action settings" ON public.ai_action_settings
  FOR ALL USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.ai_custom_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'fixed_reply',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_custom_actions_account ON public.ai_custom_actions(account_id);
ALTER TABLE public.ai_custom_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view ai custom actions" ON public.ai_custom_actions;
CREATE POLICY "Account members can view ai custom actions" ON public.ai_custom_actions
  FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS "Agents can manage ai custom actions" ON public.ai_custom_actions;
CREATE POLICY "Agents can manage ai custom actions" ON public.ai_custom_actions
  FOR ALL USING (is_account_member(account_id));

-- 3. Customer Loyalty & Rewards (Migration 069)
CREATE TABLE IF NOT EXISTS public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  tier TEXT NOT NULL DEFAULT 'BRONZE',
  points_balance INT NOT NULL DEFAULT 0,
  cashback_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_acc_phone ON public.customer_loyalty(account_id, customer_phone);
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage customer loyalty" ON public.customer_loyalty;
CREATE POLICY "Account members can manage customer loyalty" ON public.customer_loyalty
  FOR ALL USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  points INT DEFAULT 0,
  cashback_amount NUMERIC(12, 2) DEFAULT 0,
  balance_after INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON public.loyalty_transactions(account_id);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view and manage loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Account members can view and manage loyalty transactions" ON public.loyalty_transactions
  FOR ALL USING (is_account_member(account_id));

-- 4. Followup Settings & Queue Logs (Migration 064)
CREATE TABLE IF NOT EXISTS public.followup_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  abandoned_checkout_enabled BOOLEAN DEFAULT true,
  abandoned_checkout_delay_minutes INT DEFAULT 45,
  abandoned_checkout_template TEXT DEFAULT 'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনি আমাদের {{store_name}} থেকে "{{product_name}}" পণ্যটি অর্ডার করার চেষ্টা করছিলেন কিন্তু অর্ডারটি সম্পন্ন হয়নি।',
  advance_payment_enabled BOOLEAN DEFAULT true,
  advance_payment_delay_hours INT DEFAULT 2,
  advance_payment_template TEXT DEFAULT 'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনার অর্ডার (#{{order_id}}) টি কনফার্মেশনের অপেক্ষায় রয়েছে।',
  bkash_number TEXT DEFAULT NULL,
  store_url TEXT DEFAULT NULL,
  incomplete_chat_enabled BOOLEAN DEFAULT true,
  incomplete_chat_delay_hours INT DEFAULT 2,
  max_followup_attempts INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage followup settings" ON public.followup_settings;
CREATE POLICY "Account members can manage followup settings" ON public.followup_settings
  FOR ALL USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.followup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ABANDONED_CHECKOUT', 'ADVANCE_PAYMENT', 'INCOMPLETE_CHAT')),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  reference_id TEXT,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'SKIPPED', 'FAILED')),
  error_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_logs_account ON public.followup_logs(account_id, created_at DESC);
ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can read followup logs" ON public.followup_logs;
CREATE POLICY "Account members can read followup logs" ON public.followup_logs
  FOR SELECT USING (is_account_member(account_id));

-- 5. Meta Integrations & Comments (Migration 070)
CREATE TABLE IF NOT EXISTS public.meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  page_id TEXT,
  page_name TEXT,
  page_access_token TEXT,
  instagram_account_id TEXT,
  instagram_username TEXT,
  ad_account_id TEXT,
  app_id TEXT,
  app_secret TEXT,
  verify_token TEXT DEFAULT 'wacrm_meta_verify_token',
  ai_comment_reply_enabled BOOLEAN DEFAULT true,
  ai_comment_private_dm_enabled BOOLEAN DEFAULT true,
  ai_comment_prompt TEXT DEFAULT 'You are a helpful customer support assistant.',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_integrations_account ON public.meta_integrations(account_id);
ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage meta integrations" ON public.meta_integrations;
CREATE POLICY "Account members can manage meta integrations" ON public.meta_integrations
  FOR ALL USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.meta_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  post_id TEXT,
  post_url TEXT,
  post_caption TEXT,
  comment_id TEXT NOT NULL,
  parent_comment_id TEXT,
  sender_id TEXT,
  sender_name TEXT,
  sender_username TEXT,
  message TEXT NOT NULL,
  sentiment TEXT DEFAULT 'neutral',
  is_hidden BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  ai_replied BOOLEAN DEFAULT false,
  ai_reply_text TEXT,
  ai_private_dm_sent BOOLEAN DEFAULT false,
  comment_created_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_comments_account ON public.meta_comments(account_id);
ALTER TABLE public.meta_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage meta comments" ON public.meta_comments;
CREATE POLICY "Account members can manage meta comments" ON public.meta_comments
  FOR ALL USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.meta_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('page', 'ai', 'user')),
  reply_id TEXT,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meta_comment_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage comment replies" ON public.meta_comment_replies;
CREATE POLICY "Account members can manage comment replies" ON public.meta_comment_replies
  FOR ALL USING (is_account_member(account_id));

-- 6. AI Persona Config (Migration 079)
CREATE TABLE IF NOT EXISTS public.ai_persona_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'friendly',
  response_language TEXT NOT NULL DEFAULT 'mixed',
  custom_greeting TEXT,
  custom_sign_off TEXT,
  max_discount_percent INTEGER NOT NULL DEFAULT 10,
  negotiation_style TEXT NOT NULL DEFAULT 'flexible',
  require_advance_above NUMERIC,
  min_order_amount NUMERIC,
  blocked_phrases TEXT[] NOT NULL DEFAULT '{}',
  custom_rules TEXT,
  auto_learn_from_products BOOLEAN NOT NULL DEFAULT true,
  auto_learn_from_orders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id)
);

ALTER TABLE public.ai_persona_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_persona_select" ON public.ai_persona_config;
CREATE POLICY "ai_persona_select" ON public.ai_persona_config FOR SELECT USING (
  is_account_member(account_id)
);
DROP POLICY IF EXISTS "ai_persona_all" ON public.ai_persona_config;
CREATE POLICY "ai_persona_all" ON public.ai_persona_config FOR ALL USING (
  is_account_member(account_id, 'admin')
);

-- 7. Payment Gateways & Dynamic Payment Links (Migration 072)
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz', 'aamarpay', 'manual', 'rocket', 'upay')),
  is_enabled BOOLEAN DEFAULT false,
  is_sandbox BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  display_name TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_account_gateway UNIQUE(account_id, gateway)
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_account ON public.payment_gateways(account_id);
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage payment gateways" ON public.payment_gateways;
CREATE POLICY "Account members can manage payment gateways" ON public.payment_gateways
  FOR ALL USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  payment_token TEXT NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BDT',
  purpose TEXT DEFAULT 'advance_payment' CHECK (purpose IN ('advance_payment', 'full_payment', 'custom')),
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired')),
  payment_method TEXT,
  trx_id TEXT,
  gateway_payment_id TEXT,
  gateway_response JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '72 hours'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_account ON public.payment_links(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON public.payment_links(payment_token);
CREATE INDEX IF NOT EXISTS idx_payment_links_order ON public.payment_links(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_phone ON public.payment_links(customer_phone);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage payment links" ON public.payment_links;
CREATE POLICY "Account members can manage payment links" ON public.payment_links
  FOR ALL USING (is_account_member(account_id));
DROP POLICY IF EXISTS "Public can view payment link by token" ON public.payment_links;
CREATE POLICY "Public can view payment link by token" ON public.payment_links
  FOR SELECT USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'advance_trx_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN advance_trx_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_link_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 8. SMS Gateways & Logs (Migration 073)
CREATE TABLE IF NOT EXISTS public.sms_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('greenweb', 'bulksmsbd', 'alphasms', 'mimsms', 'twilio', 'custom')),
  is_enabled BOOLEAN DEFAULT false,
  api_key TEXT,
  api_secret TEXT,
  sender_id TEXT,
  balance NUMERIC(10, 2) DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_account_sms_provider UNIQUE(account_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_sms_gateways_account ON public.sms_gateways(account_id);
ALTER TABLE public.sms_gateways ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can manage sms gateways" ON public.sms_gateways;
CREATE POLICY "Account members can manage sms gateways" ON public.sms_gateways
  FOR ALL USING (is_account_member(account_id));

-- 9. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
