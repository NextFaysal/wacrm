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
