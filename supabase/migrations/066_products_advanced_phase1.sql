-- ============================================================
-- 066_products_advanced_phase1.sql
--
-- Advanced Products Enhancements:
-- 1. Ensure cost_price, barcode, unit, custom_attributes on products table
-- 2. Create product_categories table for dynamic category management
-- 3. Indexes and RLS policies
-- ============================================================

-- 1. Add fields to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 2. Dynamic Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT 'Package',
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_account ON product_categories(account_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage categories" ON product_categories;
CREATE POLICY "Account members can manage categories" ON product_categories
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active categories" ON product_categories;
CREATE POLICY "Public can view active categories" ON product_categories
  FOR SELECT USING (is_active = true);
