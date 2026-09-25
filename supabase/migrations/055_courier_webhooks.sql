-- ============================================================
-- 055_courier_webhooks.sql
--
-- Adds:
-- 1. webhook_secret column to courier_configs
-- 2. courier_webhook_logs table for audit & event debugging
-- ============================================================

ALTER TABLE courier_configs
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

CREATE TABLE IF NOT EXISTS courier_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                         -- 'steadfast' or 'pathao'
  event_type TEXT NOT NULL,                       -- e.g. 'delivery_status', 'order.delivered'
  consignment_id TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',       -- 'processed', 'ignored', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_account ON courier_webhook_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_consignment ON courier_webhook_logs(consignment_id);
CREATE INDEX IF NOT EXISTS idx_courier_webhook_logs_provider ON courier_webhook_logs(provider);

ALTER TABLE courier_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view courier webhook logs" ON courier_webhook_logs;
CREATE POLICY "Members can view courier webhook logs" ON courier_webhook_logs
  FOR SELECT USING (is_account_member(account_id));
