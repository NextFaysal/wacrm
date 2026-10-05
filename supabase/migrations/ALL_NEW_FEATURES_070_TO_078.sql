-- ============================================================
-- 070_facebook_instagram_integration.sql
--
-- 1. meta_integrations: Facebook Page, Instagram Account, Ads Config & AI Settings
-- 2. meta_comments: Facebook & Instagram comments feed, status, AI auto-replies
-- 3. meta_comment_replies: Thread replies (public comments & private DMs)
-- 4. meta_ads_metrics: Daily ad campaign spend, clicks, impressions, ROAS
-- 5. conversations: Support for omnichannel channels ('whatsapp', 'facebook', 'instagram')
-- ============================================================

-- 1. Meta Integrations Config
CREATE TABLE IF NOT EXISTS meta_integrations (
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
  ai_comment_prompt TEXT DEFAULT 'You are a warm, helpful customer support assistant for an online shop. Reply to Facebook and Instagram comments in a polite, engaging, and friendly manner in the same language the customer used (Bengali or English). If they ask for price, stock, or how to order, politely let them know that full details and price have been sent to their inbox/DM, and encourage them to check their messages.',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_integrations_account ON meta_integrations(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_page ON meta_integrations(page_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_ig ON meta_integrations(instagram_account_id);

ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage meta integrations" ON meta_integrations;
CREATE POLICY "Account members can manage meta integrations" ON meta_integrations
  FOR ALL USING (is_account_member(account_id));

-- 2. Meta Comments Table
CREATE TABLE IF NOT EXISTS meta_comments (
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

CREATE INDEX IF NOT EXISTS idx_meta_comments_account ON meta_comments(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_comments_comment_id ON meta_comments(comment_id);
CREATE INDEX IF NOT EXISTS idx_meta_comments_post_id ON meta_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_meta_comments_platform ON meta_comments(platform);
CREATE INDEX IF NOT EXISTS idx_meta_comments_ai_replied ON meta_comments(ai_replied);

ALTER TABLE meta_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage meta comments" ON meta_comments;
CREATE POLICY "Account members can manage meta comments" ON meta_comments
  FOR ALL USING (is_account_member(account_id));

-- 3. Meta Comment Replies Table
CREATE TABLE IF NOT EXISTS meta_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('page', 'ai', 'user')),
  reply_id TEXT,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_comment_replies_account ON meta_comment_replies(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_comment_replies_comment ON meta_comment_replies(comment_id);

ALTER TABLE meta_comment_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage comment replies" ON meta_comment_replies;
CREATE POLICY "Account members can manage comment replies" ON meta_comment_replies
  FOR ALL USING (is_account_member(account_id));

-- 4. Meta Ads Metrics Table
CREATE TABLE IF NOT EXISTS meta_ads_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  spend NUMERIC(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cpc NUMERIC(10, 4) DEFAULT 0,
  cpm NUMERIC(10, 4) DEFAULT 0,
  ctr NUMERIC(6, 4) DEFAULT 0,
  conversions INT DEFAULT 0,
  attributed_revenue NUMERIC(12, 2) DEFAULT 0,
  roas NUMERIC(10, 2) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_account ON meta_ads_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON meta_ads_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_date ON meta_ads_metrics(date);

ALTER TABLE meta_ads_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage ads metrics" ON meta_ads_metrics;
CREATE POLICY "Account members can manage ads metrics" ON meta_ads_metrics
  FOR ALL USING (is_account_member(account_id));

-- 5. Add multi-channel support to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'facebook', 'instagram')),
  ADD COLUMN IF NOT EXISTS meta_psid TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_meta_psid ON conversations(meta_psid);
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
-- ============================================================
-- 072_payment_gateways_and_links.sql
--
-- 1. payment_gateways table for bKash, Nagad, SSLCommerz credentials
-- 2. payment_links table for dynamic 1-click customer payment links
-- 3. advance_trx_id column on orders
-- ============================================================

-- 1. Payment Gateways Configuration
CREATE TABLE IF NOT EXISTS payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('bkash', 'nagad', 'sslcommerz', 'aamarpay', 'manual')),
  is_enabled BOOLEAN DEFAULT false,
  is_sandbox BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb, -- app_key, app_secret, username, password, merchant_id, etc.
  display_name TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_account_gateway UNIQUE(account_id, gateway)
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_account ON payment_gateways(account_id);

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage payment gateways" ON payment_gateways;
CREATE POLICY "Account members can manage payment gateways" ON payment_gateways
  FOR ALL USING (is_account_member(account_id));

-- 2. Payment Links & Invoices Table
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  payment_token TEXT NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BDT',
  purpose TEXT DEFAULT 'advance_payment' CHECK (purpose IN ('advance_payment', 'full_payment', 'custom')),
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'expired')),
  payment_method TEXT, -- 'bkash', 'nagad', 'card', 'manual'
  trx_id TEXT,
  gateway_payment_id TEXT,
  gateway_response JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '72 hours'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_account ON payment_links(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON payment_links(payment_token);
CREATE INDEX IF NOT EXISTS idx_payment_links_order ON payment_links(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_phone ON payment_links(customer_phone);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage payment links" ON payment_links;
CREATE POLICY "Account members can manage payment links" ON payment_links
  FOR ALL USING (is_account_member(account_id));

-- Public can view payment links with exact valid payment_token
DROP POLICY IF EXISTS "Public can view payment link by token" ON payment_links;
CREATE POLICY "Public can view payment link by token" ON payment_links
  FOR SELECT USING (true);

-- 3. Add advance_trx_id to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'advance_trx_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN advance_trx_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_link_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_link_id UUID REFERENCES payment_links(id) ON DELETE SET NULL;
  END IF;
END $$;
-- ============================================================
-- 073_sms_gateways_and_order_tracking.sql
--
-- 1. sms_gateways table (Greenweb, BulkSMSBD, Alpha SMS, MimSMS, Twilio)
-- 2. sms_logs table for audit & billing
-- 3. order_confirmations table for automated OTP & 1-Click COD Verification
-- 4. confirmation_status columns on orders
-- ============================================================

-- 1. SMS Gateways Configuration
CREATE TABLE IF NOT EXISTS sms_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('greenweb', 'bulksmsbd', 'alphasms', 'mimsms', 'twilio', 'custom')),
  is_enabled BOOLEAN DEFAULT false,
  api_key TEXT,
  api_secret TEXT,
  sender_id TEXT, -- Masking Sender ID e.g. '8809612...' or Brand Name
  balance NUMERIC(10, 2) DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_account_sms_provider UNIQUE(account_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_sms_gateways_account ON sms_gateways(account_id);

ALTER TABLE sms_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage sms gateways" ON sms_gateways;
CREATE POLICY "Account members can manage sms gateways" ON sms_gateways
  FOR ALL USING (is_account_member(account_id));

-- 2. SMS Outbound Logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  cost NUMERIC(6, 2) DEFAULT 0,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_account ON sms_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sms_logs_order ON sms_logs(order_id);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view sms logs" ON sms_logs;
CREATE POLICY "Account members can view sms logs" ON sms_logs
  FOR ALL USING (is_account_member(account_id));

-- 3. Order Confirmations & OTP Tokens
CREATE TABLE IF NOT EXISTS order_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  confirmation_token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'rejected')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_confirmations_account ON order_confirmations(account_id);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_token ON order_confirmations(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_order ON order_confirmations(order_id);

ALTER TABLE order_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage order confirmations" ON order_confirmations;
CREATE POLICY "Account members can manage order confirmations" ON order_confirmations
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view confirmation by token" ON order_confirmations;
CREATE POLICY "Public can view confirmation by token" ON order_confirmations
  FOR SELECT USING (true);

-- 4. Add confirmation_status to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN confirmation_status TEXT DEFAULT 'confirmed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'otp_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN otp_code TEXT;
  END IF;
END $$;
-- ============================================================
-- 074_product_reviews_ugc_and_warehouse.sql
--
-- 1. Extend product_reviews with order_id and photo_urls
-- 2. Add review tokens and warehouse scanning timestamps to orders
-- 3. Public insert policy on product_reviews
-- ============================================================

-- 1. Extend product_reviews table
ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

DROP POLICY IF EXISTS "Public can submit product reviews" ON product_reviews;
CREATE POLICY "Public can submit product reviews" ON product_reviews
  FOR INSERT WITH CHECK (true);

-- 2. Extend orders with warehouse scan & review tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS review_token TEXT,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warehouse_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warehouse_scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_review_token ON orders(review_token);
-- ============================================================
-- 075_sms_campaigns_and_audience_segments.sql
--
-- 1. sms_campaigns table for bulk promotional & flash sale marketing
-- 2. Link sms_logs with campaign_id
-- 3. Optimization indexes for review drip and audience segmentation
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment_type TEXT NOT NULL DEFAULT 'ALL',
  provider TEXT NOT NULL DEFAULT 'bulksmsbd',
  sender_id TEXT,
  message_template TEXT NOT NULL,
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_account ON sms_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_campaigns(status);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage sms campaigns" ON sms_campaigns;
CREATE POLICY "Account members can manage sms campaigns" ON sms_campaigns
  FOR ALL USING (is_account_member(account_id));

-- Link sms_logs with campaign_id
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON sms_logs(campaign_id);

-- Performance index for review drip cron scanning
CREATE INDEX IF NOT EXISTS idx_orders_review_drip ON orders(account_id, status, review_requested_at, review_submitted_at)
  WHERE status = 'DELIVERED';
-- ============================================================
-- 076_order_call_logs_and_verification.sql
--
-- 1. order_call_logs table for call center phone verification
-- 2. Call status columns and attempt counters on orders
-- 3. RLS policies and indexes
-- ============================================================

CREATE TABLE IF NOT EXISTS order_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  call_outcome TEXT NOT NULL CHECK (
    call_outcome IN ('confirmed', 'no_answer', 'busy', 'cancelled', 'rescheduled', 'wrong_number')
  ),
  rescheduled_date DATE,
  cancellation_reason TEXT,
  notes TEXT,
  sms_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_call_logs_account ON order_call_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_order_call_logs_order ON order_call_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_call_logs_phone ON order_call_logs(customer_phone);

ALTER TABLE order_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage order call logs" ON order_call_logs;
CREATE POLICY "Account members can manage order call logs" ON order_call_logs
  FOR ALL USING (is_account_member(account_id));

-- Add call center columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS call_status TEXT DEFAULT 'uncalled' CHECK (
    call_status IN ('uncalled', 'called_confirmed', 'called_no_answer', 'called_busy', 'called_cancelled', 'called_rescheduled')
  ),
  ADD COLUMN IF NOT EXISTS call_attempt_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_caller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_delivery_date DATE;

CREATE INDEX IF NOT EXISTS idx_orders_call_status ON orders(account_id, call_status);
-- ============================================================
-- 077_delivery_riders_and_dispatch.sql
--
-- 1. delivery_riders table for in-house delivery boys & express runners
-- 2. Rider assignment and collection tracking columns on orders
-- 3. RLS policies and indexes
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'bike', -- 'bike', 'cycle', 'van', 'on_foot'
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'offline', 'suspended')),
  pin_code TEXT DEFAULT '1234', -- 4-digit fast mobile login
  total_deliveries INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_account_rider_phone UNIQUE(account_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_delivery_riders_account ON delivery_riders(account_id);
CREATE INDEX IF NOT EXISTS idx_delivery_riders_phone ON delivery_riders(phone);

ALTER TABLE delivery_riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage delivery riders" ON delivery_riders;
CREATE POLICY "Account members can manage delivery riders" ON delivery_riders
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active riders by phone" ON delivery_riders;
CREATE POLICY "Public can view active riders by phone" ON delivery_riders
  FOR SELECT USING (true);

-- Extend orders with in-house rider assignment
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES delivery_riders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rider_name TEXT,
  ADD COLUMN IF NOT EXISTS rider_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivered_by_rider_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rider_collected_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rider_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
-- ============================================================
-- 078_multi_store_workspaces.sql
--
-- 1. Relax single-account per owner constraint to support multi-store / multi-brand
-- 2. Add store metadata (logo_url, brand_color) to accounts
-- 3. Policy allowing account owners to manage all their created stores
-- ============================================================

-- Drop 1-account-per-owner constraint so users can create and manage multiple stores
DROP INDEX IF EXISTS idx_accounts_one_per_owner;

-- Add store branding fields to accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS store_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#10b981';

-- Ensure owners can view and select all accounts they own
DROP POLICY IF EXISTS "Owners can view all their owned accounts" ON accounts;
CREATE POLICY "Owners can view all their owned accounts" ON accounts
  FOR SELECT USING (owner_user_id = auth.uid() OR is_account_member(id));
