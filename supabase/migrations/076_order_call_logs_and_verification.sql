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
