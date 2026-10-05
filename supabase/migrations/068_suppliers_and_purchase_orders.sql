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
