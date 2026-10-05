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
