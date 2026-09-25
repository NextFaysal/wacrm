-- ============================================================
-- 048_watch_features.sql
--
-- Adds support for:
-- 1. Watch Products & Inventory Catalog (specs, images, video links, variants)
-- 2. Digital Warranty System (card generator, serial numbers, expiration tracking)
-- 3. Courier order advance payment and variant tracking fields
-- ============================================================

-- 1. Watch Products & Inventory Catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  regular_price NUMERIC,
  image_url TEXT,
  video_url TEXT,
  category TEXT DEFAULT 'quartz',
  dial_size TEXT DEFAULT '42mm',
  water_resistance TEXT DEFAULT '3ATM / 30M',
  movement TEXT DEFAULT 'Japanese Quartz',
  strap_type TEXT DEFAULT 'Genuine Leather',
  colors TEXT[] DEFAULT ARRAY['Black', 'Silver'],
  warranty_months INT DEFAULT 12,
  stock_quantity INT DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Digital Warranty System
CREATE TABLE IF NOT EXISTS warranties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  warranty_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  serial_number TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  duration_months INT NOT NULL DEFAULT 12,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  coverage_details TEXT DEFAULT '1 Year Machine Movement Warranty & 6 Months Battery Replacement',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'claimed', 'void')),
  claim_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Extend courier_orders with advance charge & watch variant fields
ALTER TABLE courier_orders ADD COLUMN IF NOT EXISTS advance_paid NUMERIC DEFAULT 0;
ALTER TABLE courier_orders ADD COLUMN IF NOT EXISTS advance_trx_id TEXT;
ALTER TABLE courier_orders ADD COLUMN IF NOT EXISTS color_variant TEXT;
ALTER TABLE courier_orders ADD COLUMN IF NOT EXISTS strap_variant TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_account ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_warranties_account ON warranties(account_id);
CREATE INDEX IF NOT EXISTS idx_warranties_contact ON warranties(contact_id);
CREATE INDEX IF NOT EXISTS idx_warranties_code ON warranties(warranty_code);

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view products" ON products;
CREATE POLICY "Members can view products" ON products
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage products" ON products;
CREATE POLICY "Agents can manage products" ON products
  FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "Members can view warranties" ON warranties;
CREATE POLICY "Members can view warranties" ON warranties
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage warranties" ON warranties;
CREATE POLICY "Agents can manage warranties" ON warranties
  FOR ALL USING (is_account_member(account_id, 'agent'));
