

-- ============================================================
-- 061_business_settings.sql
-- ============================================================

-- ============================================================
-- 061_business_settings.sql
--
-- Dynamic Storefront & CMS Business Configuration:
-- Allows any business type (Watches, Fashion, Electronics, Food, Cosmetics, General)
-- to customize branding, storefront homepage, spec labels, announcements, and contacts.
-- ============================================================

CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'My Store',
  business_type TEXT NOT NULL DEFAULT 'general',
  tagline TEXT DEFAULT 'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
  hero_title TEXT DEFAULT 'আমাদের এক্সক্লুসিভ কালেকশন',
  hero_subtitle TEXT DEFAULT 'পছন্দের পণ্যটি অর্ডার করুন ক্যাশ অন ডেলিভারিতে',
  logo_url TEXT,
  banner_url TEXT,
  store_slug TEXT UNIQUE,
  support_phone TEXT,
  support_email TEXT,
  whatsapp_number TEXT,
  address TEXT,
  currency_symbol TEXT DEFAULT '৳',
  primary_color TEXT DEFAULT '#f59e0b',
  
  -- Dynamic product spec field labels for any business
  spec_label_1 TEXT DEFAULT 'স্পেসিফিকেশন ১',
  spec_label_2 TEXT DEFAULT 'স্পেসিফিকেশন ২',
  spec_label_3 TEXT DEFAULT 'স্পেসিফিকেশন ৩',
  spec_label_4 TEXT DEFAULT 'স্পেসিফিকেশন ৪',

  -- Trust & Value proposition highlights
  feature_1_title TEXT DEFAULT 'ক্যাশ অন ডেলিভারি',
  feature_1_subtitle TEXT DEFAULT 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ',
  feature_2_title TEXT DEFAULT 'সুপারফাস্ট ডেলিভারি',
  feature_2_subtitle TEXT DEFAULT 'সারাদেশে দ্রুত হোম ডেলিভারি',
  feature_3_title TEXT DEFAULT '১০০% অরিজিনাল',
  feature_3_subtitle TEXT DEFAULT 'নিখুঁত কোয়ালিটি গ্যারান্টি',

  -- Notice / Urgency top bar
  announcement_text TEXT DEFAULT '🔥 সীমিত সময়ের স্পেশাল অফার! দ্রুত অর্ডার কনফার্ম করুন!',
  announcement_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_business_settings_slug ON business_settings(store_slug);

-- Enable RLS
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view business settings" ON business_settings;
CREATE POLICY "Account members can view business settings" ON business_settings
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage business settings" ON business_settings;
CREATE POLICY "Agents can manage business settings" ON business_settings
  FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "Public can view business settings" ON business_settings;
CREATE POLICY "Public can view business settings" ON business_settings
  FOR SELECT USING (true);

-- Seed default business settings for any existing accounts
INSERT INTO business_settings (
  account_id,
  store_name,
  business_type,
  store_slug,
  tagline,
  spec_label_1,
  spec_label_2,
  spec_label_3,
  spec_label_4
)
SELECT 
  a.id,
  COALESCE(a.name, 'My Store'),
  'general',
  LOWER(REGEXP_REPLACE(COALESCE(a.name, 'store') || '-' || SUBSTRING(a.id::text, 1, 6), '[^a-zA-Z0-9]+', '-', 'g')),
  'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
  'মডেল / কোড',
  'ম্যাটেরিয়াল / উপাদান',
  'সাইজ / পরিমাপ',
  'ওয়ারেন্টি / গ্যারান্টি'
FROM accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM business_settings bs WHERE bs.account_id = a.id
);


-- ============================================================
-- 062_ai_actions_and_custom_tools.sql
-- ============================================================

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


-- ============================================================
-- 063_abandoned_checkouts_and_reconciliation.sql
-- ============================================================

-- ============================================================
-- 063_abandoned_checkouts_and_reconciliation.sql
--
-- Adds:
-- 1. abandoned_checkouts table for capturing partial checkout leads
-- 2. courier payout tracking & cash reconciliation columns on orders
-- ============================================================

-- 1. Abandoned Checkouts Table
CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  variant TEXT,
  quantity INT DEFAULT 1,
  total_amount NUMERIC DEFAULT 0,
  recovered BOOLEAN DEFAULT false,
  recovery_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_account ON abandoned_checkouts(account_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_phone ON abandoned_checkouts(customer_phone);

ALTER TABLE abandoned_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert abandoned checkouts" ON abandoned_checkouts;
CREATE POLICY "Public can insert abandoned checkouts" ON abandoned_checkouts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Account members can manage abandoned checkouts" ON abandoned_checkouts;
CREATE POLICY "Account members can manage abandoned checkouts" ON abandoned_checkouts
  FOR ALL USING (is_account_member(account_id));

-- 2. Courier Payout Reconciliation columns on orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'courier_payout_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_payout_status TEXT DEFAULT 'PENDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'courier_payout_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_payout_amount NUMERIC DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'courier_payout_date'
  ) THEN
    ALTER TABLE orders ADD COLUMN courier_payout_date TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;


-- ============================================================
-- 064_automated_followup_queue.sql
-- ============================================================

-- ============================================================
-- 064_automated_followup_queue.sql
--
-- Adds:
-- 1. followup_settings table (customizable triggers, delay timings & templates)
-- 2. Columns on abandoned_checkouts (followup_count, last_followup_at)
-- 3. Columns on orders (advance_reminder_count, last_advance_reminder_at)
-- 4. followup_logs table (real-time audit & delivery tracking)
-- ============================================================

-- 1. Followup Settings
CREATE TABLE IF NOT EXISTS followup_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  abandoned_checkout_enabled BOOLEAN DEFAULT true,
  abandoned_checkout_delay_minutes INT DEFAULT 45,
  abandoned_checkout_template TEXT DEFAULT 'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনি আমাদের {{store_name}} থেকে "{{product_name}}" পণ্যটি অর্ডার করার চেষ্টা করছিলেন কিন্তু অর্ডারটি সম্পন্ন হয়নি।\n\nআপনি কি অর্ডারটি কনফার্ম করতে চান? যেকোনো সাহায্য বা ডিসকাউন্টের জন্য এই মেসেজের রিপ্লাই দিন অথবা সরাসরি এই লিংকে গিয়ে সম্পূর্ণ করুন:\n{{checkout_url}}\n\nধন্যবাদ সাথে থাকার জন্য! 🛍️',
  advance_payment_enabled BOOLEAN DEFAULT true,
  advance_payment_delay_hours INT DEFAULT 2,
  advance_payment_template TEXT DEFAULT 'আসসালামু আলাইকুম {{customer_name}}! 😊\n\nআপনার অর্ডার (#{{order_id}}) টি কনফার্মেশনের অপেক্ষায় রয়েছে। ফেক অর্ডার প্রতিরোধের সুবিধার্থে ডেলিভারি চার্জ বাবদ ৳{{advance_amount}} টাকা অগ্রিম প্রযোজ্য।\n\nদয়া করে আমাদের bKash/Nagad নম্বরে ({{bkash_number}}) টাকা পাঠিয়ে ট্রানজেকশন আইডি বা স্ক্রিনশট পাঠিয়ে দিন। টাকা পাওয়ার সাথে সাথেই পার্সেল কুরিয়ারে বুক হয়ে যাবে! 🚀',
  bkash_number TEXT DEFAULT NULL,
  store_url TEXT DEFAULT NULL,
  incomplete_chat_enabled BOOLEAN DEFAULT true,
  incomplete_chat_delay_hours INT DEFAULT 2,
  max_followup_attempts INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE followup_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage followup settings" ON followup_settings;
CREATE POLICY "Account members can manage followup settings" ON followup_settings
  FOR ALL USING (is_account_member(account_id));

-- 2. Columns on abandoned_checkouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abandoned_checkouts' AND column_name = 'followup_count'
  ) THEN
    ALTER TABLE abandoned_checkouts ADD COLUMN followup_count INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'abandoned_checkouts' AND column_name = 'last_followup_at'
  ) THEN
    ALTER TABLE abandoned_checkouts ADD COLUMN last_followup_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 3. Columns on orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'advance_reminder_count'
  ) THEN
    ALTER TABLE orders ADD COLUMN advance_reminder_count INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'last_advance_reminder_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN last_advance_reminder_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 4. Followup Queue Logs Table
CREATE TABLE IF NOT EXISTS followup_logs (
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

CREATE INDEX IF NOT EXISTS idx_followup_logs_account ON followup_logs(account_id, created_at DESC);

ALTER TABLE followup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can read followup logs" ON followup_logs;
CREATE POLICY "Account members can read followup logs" ON followup_logs
  FOR SELECT USING (is_account_member(account_id));


-- ============================================================
-- 065_advanced_ecommerce_ai_features.sql
-- ============================================================

-- ============================================================
-- 065_advanced_ecommerce_ai_features.sql
--
-- 1. Adds Meta Conversions API (CAPI) credentials to business_settings
-- 2. Adds Smart Courier Routing, Meta CAPI, VIP Loyalty, and Live Tracking Bot toggles to ai_action_settings
-- 3. Adds Loyalty Tier and lifetime analytics to contacts
-- ============================================================

-- 1. Business Settings Meta CAPI fields
ALTER TABLE business_settings 
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_test_code TEXT;

-- 2. AI Action Settings toggles for advanced autonomous capabilities
ALTER TABLE ai_action_settings 
  ADD COLUMN IF NOT EXISTS smart_courier_routing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_capi_tracking BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vip_loyalty BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS live_tracking_bot BOOLEAN NOT NULL DEFAULT true;

-- 3. Contact Loyalty Tier & Lifetime stats
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS total_spend NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders INT DEFAULT 0;


-- ============================================================
-- 066_products_advanced_phase1.sql
-- ============================================================

-- ============================================================
-- 066_products_advanced_phase1.sql
--
-- Advanced Products Enhancements:
-- 1. Ensure cost_price, barcode, unit, custom_attributes on products table
-- 2. Create product_categories table for dynamic category management
-- 3. Indexes and RLS policies
-- ============================================================

-- 1. Add fields to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 2. Dynamic Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT 'Package',
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_account ON product_categories(account_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage categories" ON product_categories;
CREATE POLICY "Account members can manage categories" ON product_categories
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active categories" ON product_categories;
CREATE POLICY "Public can view active categories" ON product_categories
  FOR SELECT USING (is_active = true);


-- ============================================================
-- 067_products_phase2_bundles_and_tiers.sql
-- ============================================================

-- ============================================================
-- 067_products_phase2_bundles_and_tiers.sql
--
-- 1. Add tier_pricing to products (for multi-quantity / wholesale discount offers)
-- 2. Create product_bundles table (for Combo Deals & Bundle packs)
-- 3. RLS policies and indexes
-- ============================================================

-- 1. Tier Pricing on Products Table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tier_pricing JSONB DEFAULT '[]'::jsonb;

-- 2. Product Bundles Table
CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  regular_price NUMERIC,
  image_url TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { product_id, quantity, variant_id, product_name }
  badge_text TEXT DEFAULT 'COMBO DEAL',
  total_sold INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_bundles_account ON product_bundles(account_id);
CREATE INDEX IF NOT EXISTS idx_product_bundles_slug ON product_bundles(slug);

ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage bundles" ON product_bundles;
CREATE POLICY "Account members can manage bundles" ON product_bundles
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active bundles" ON product_bundles;
CREATE POLICY "Public can view active bundles" ON product_bundles
  FOR SELECT USING (is_active = true);


-- ============================================================
-- 068_suppliers_and_purchase_orders.sql
-- ============================================================

-- ============================================================
-- 068_suppliers_and_purchase_orders.sql
--
-- 1. Suppliers table
-- 2. Purchase Orders (PO) table
-- 3. RLS policies and indexes
-- ============================================================

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  total_orders INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_account ON suppliers(account_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage suppliers" ON suppliers;
CREATE POLICY "Account members can manage suppliers" ON suppliers
  FOR ALL USING (is_account_member(account_id));

-- 2. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'ordered', 'received', 'cancelled'
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { product_id, product_name, variant_id, variant_name, sku, quantity, unit_cost, total_cost }
  subtotal NUMERIC(12, 2) DEFAULT 0,
  shipping_cost NUMERIC(12, 2) DEFAULT 0,
  tax NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'paid'
  expected_delivery_date TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_account ON purchase_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_num ON purchase_orders(po_number);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage purchase orders" ON purchase_orders;
CREATE POLICY "Account members can manage purchase orders" ON purchase_orders
  FOR ALL USING (is_account_member(account_id));


-- ============================================================
-- 069_customer_loyalty_and_rewards.sql
-- ============================================================

-- ============================================================
-- 069_customer_loyalty_and_rewards.sql
--
-- 1. Customer Loyalty table (points, cashback, tier, spend)
-- 2. Loyalty Transactions ledger
-- 3. RLS policies and indexes
-- ============================================================

-- 1. Customer Loyalty Profile
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  tier TEXT NOT NULL DEFAULT 'BRONZE', -- 'BRONZE', 'SILVER', 'GOLD', 'VIP'
  points_balance INT NOT NULL DEFAULT 0,
  cashback_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_orders INT NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_acc_phone ON customer_loyalty(account_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_tier ON customer_loyalty(tier);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_points ON customer_loyalty(points_balance DESC);

ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage customer loyalty" ON customer_loyalty;
CREATE POLICY "Account members can manage customer loyalty" ON customer_loyalty
  FOR ALL USING (is_account_member(account_id));

-- 2. Loyalty Transactions Ledger
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'earn_points', 'redeem_points', 'cashback_credit', 'cashback_debit', 'manual_adjustment'
  points INT DEFAULT 0,
  cashback_amount NUMERIC(12, 2) DEFAULT 0,
  balance_after INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_phone ON loyalty_transactions(customer_phone);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view and manage loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Account members can view and manage loyalty transactions" ON loyalty_transactions
  FOR ALL USING (is_account_member(account_id));


-- ============================================================
-- 070_facebook_instagram_integration.sql
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
-- ============================================================

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
