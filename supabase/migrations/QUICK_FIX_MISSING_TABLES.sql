-- ============================================================
-- QUICK FIX: ALL MISSING TABLES, COLUMNS & SCHEMA RELOAD
-- Fixes:
-- 1. accounts metadata (store_logo_url, brand_color)
-- 2. business_settings table
-- 3. products columns (barcode, cost_price, tier_pricing, unit)
-- 4. product_bundles table
-- 5. abandoned_checkouts table
-- 6. suppliers table
-- 7. purchase_orders table
-- 8. orders payout columns
-- 9. NOTIFY pgrst reload schema (refreshes PostgREST schema cache)
-- ============================================================

-- 1. accounts metadata (Multi-store branding)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS store_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#10b981';

-- 2. business_settings table
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'My Store',
  business_type TEXT NOT NULL DEFAULT 'general',
  tagline TEXT DEFAULT 'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
  hero_title TEXT DEFAULT 'আমাদের এক্সক্লুসিভ কালেকশন',
  hero_subtitle TEXT DEFAULT 'পছন্দের পণ্যটি অর্ডার করুন ক্যাশ অন ডেলিভারিতে',
  logo_url TEXT,
  banner_url TEXT,
  store_slug TEXT UNIQUE,
  support_phone TEXT,
  support_email TEXT,
  whatsapp_number TEXT,
  address TEXT,
  currency_symbol TEXT DEFAULT '৳',
  primary_color TEXT DEFAULT '#f59e0b',
  spec_label_1 TEXT DEFAULT 'মডেল / কোড',
  spec_label_2 TEXT DEFAULT 'ম্যাটেরিয়াল / উপাদান',
  spec_label_3 TEXT DEFAULT 'সাইজ / পরিমাপ',
  spec_label_4 TEXT DEFAULT 'ওয়ারেন্টি / গ্যারান্টি',
  feature_1_title TEXT DEFAULT 'ক্যাশ অন ডেলিভারি',
  feature_1_subtitle TEXT DEFAULT 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ',
  feature_2_title TEXT DEFAULT 'সুপারফাস্ট ডেলিভারি',
  feature_2_subtitle TEXT DEFAULT 'সারাদেশে দ্রুত হোম ডেলিভারি',
  feature_3_title TEXT DEFAULT '১০০% অরিজিনাল',
  feature_3_subtitle TEXT DEFAULT 'নিখুঁত কোয়ালিটি গ্যারান্টি',
  announcement_text TEXT DEFAULT '🔥 সীমিত সময়ের স্পেশাল অফার! দ্রুত অর্ডার কনফার্ম করুন!',
  announcement_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_settings_slug ON business_settings(store_slug);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view business settings" ON business_settings;
CREATE POLICY "Public can view business settings" ON business_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Account members can manage business settings" ON business_settings;
CREATE POLICY "Account members can manage business settings" ON business_settings
  FOR ALL USING (is_account_member(account_id));

-- 3. products barcode, cost_price, tier_pricing
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tier_pricing JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 4. product_bundles table
CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  regular_price NUMERIC,
  image_url TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_text TEXT DEFAULT 'COMBO DEAL',
  total_sold INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_bundles_account ON product_bundles(account_id);
CREATE INDEX IF NOT EXISTS idx_product_bundles_slug ON product_bundles(slug);

ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active bundles" ON product_bundles;
CREATE POLICY "Public can view active bundles" ON product_bundles
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Account members can manage bundles" ON product_bundles;
CREATE POLICY "Account members can manage bundles" ON product_bundles
  FOR ALL USING (is_account_member(account_id));

-- 5. abandoned_checkouts table
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

-- 6. suppliers table
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

-- 7. purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) DEFAULT 0,
  shipping_cost NUMERIC(12, 2) DEFAULT 0,
  tax NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
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

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage purchase orders" ON purchase_orders;
CREATE POLICY "Account members can manage purchase orders" ON purchase_orders
  FOR ALL USING (is_account_member(account_id));

-- 8. orders payout columns
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

-- 9. CRITICAL: Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
