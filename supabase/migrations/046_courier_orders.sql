-- ============================================================
-- 046_courier_orders.sql
--
-- Adds courier integration configuration and courier orders tracking
-- for Steadfast, Pathao, RedX, and Paperfly.
-- ============================================================

CREATE TABLE IF NOT EXISTS courier_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('steadfast', 'pathao', 'redx', 'paperfly', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT NOT NULL,
  secret_key TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, provider)
);

CREATE TABLE IF NOT EXISTS courier_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  consignment_id TEXT,
  tracking_code TEXT NOT NULL,
  tracking_url TEXT,
  invoice_id TEXT,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  cod_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_charge NUMERIC DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'in_review',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_orders_account ON courier_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_courier_orders_contact ON courier_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_courier_orders_tracking ON courier_orders(tracking_code);

ALTER TABLE courier_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view courier configs" ON courier_configs;
CREATE POLICY "Members can view courier configs" ON courier_configs
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Admins can manage courier configs" ON courier_configs;
CREATE POLICY "Admins can manage courier configs" ON courier_configs
  FOR ALL USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "Members can view courier orders" ON courier_orders;
CREATE POLICY "Members can view courier orders" ON courier_orders
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage courier orders" ON courier_orders;
CREATE POLICY "Agents can manage courier orders" ON courier_orders
  FOR ALL USING (is_account_member(account_id, 'agent'));
