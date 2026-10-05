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
