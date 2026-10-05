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
