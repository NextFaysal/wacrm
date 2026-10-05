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
