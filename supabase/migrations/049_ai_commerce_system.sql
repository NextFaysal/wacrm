-- ============================================================
-- 049_ai_commerce_system.sql
--
-- Adds support for:
-- 1. Conversation State Machine & Memory (ai_state, ai_memory, referral_data)
-- 2. Commerce Orders Management (orders table)
-- 3. AI Tool / Action Audit Logging (ai_audit_log table)
-- 4. Follow-up Automation Queue (ai_followups table)
-- 5. AI Commerce Configuration settings on ai_configs
-- ============================================================

-- 1. Extend conversations with State Machine, Memory, and Ad Referral data
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_state TEXT DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS ai_memory JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS referral_data JSONB,
  ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_ai_state ON conversations(ai_state);

-- 2. Create Commerce Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  delivery_charge NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  thana TEXT,
  district TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW',
    'CONFIRMED',
    'PROCESSING',
    'COURIER_BOOKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
    'FAILED_DELIVERY'
  )),
  risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  risk_score NUMERIC DEFAULT 0,
  risk_notes TEXT,
  courier_provider TEXT,
  courier_tracking_code TEXT,
  courier_consignment_id TEXT,
  courier_status TEXT,
  advance_paid NUMERIC DEFAULT 0,
  advance_trx_id TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_contact ON orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view orders" ON orders;
CREATE POLICY "Members can view orders" ON orders
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage orders" ON orders;
CREATE POLICY "Agents can manage orders" ON orders
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 3. AI Tool / Action Audit Logging Table
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  input JSONB,
  output JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'requires_approval')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_account ON ai_audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_conversation ON ai_audit_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_tool ON ai_audit_log(tool_name);

ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view ai audit log" ON ai_audit_log;
CREATE POLICY "Members can view ai audit log" ON ai_audit_log
  FOR SELECT USING (is_account_member(account_id));

-- 4. Follow-up Automation Queue
CREATE TABLE IF NOT EXISTS ai_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  message_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_followups_pending ON ai_followups(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ai_followups_conv ON ai_followups(conversation_id);

ALTER TABLE ai_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view ai followups" ON ai_followups;
CREATE POLICY "Members can view ai followups" ON ai_followups
  FOR SELECT USING (is_account_member(account_id));

-- 5. Extend ai_configs with Commerce Business Rules
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS delivery_charge_inside_dhaka NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS delivery_charge_outside_dhaka NUMERIC DEFAULT 150,
  ADD COLUMN IF NOT EXISTS free_delivery_min_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS default_gift TEXT DEFAULT 'Free Extra Battery',
  ADD COLUMN IF NOT EXISTS risk_max_cancellation_rate INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS risk_min_steadfast_ratio INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_courier_booking BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS followup_delay_minutes INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_tagging_enabled BOOLEAN DEFAULT true;
