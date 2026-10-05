-- ============================================================
-- 067_products_phase2_bundles_and_tiers.sql
--
-- 1. Add tier_pricing to products (for multi-quantity / wholesale discount offers)
-- 2. Create product_bundles table (for Combo Deals & Bundle packs)
-- 3. RLS policies and indexes
-- ============================================================

-- 1. Tier Pricing on Products Table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tier_pricing JSONB DEFAULT '[]'::jsonb;

-- 2. Product Bundles Table
CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  regular_price NUMERIC,
  image_url TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { product_id, quantity, variant_id, product_name }
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

DROP POLICY IF EXISTS "Account members can manage bundles" ON product_bundles;
CREATE POLICY "Account members can manage bundles" ON product_bundles
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active bundles" ON product_bundles;
CREATE POLICY "Public can view active bundles" ON product_bundles
  FOR SELECT USING (is_active = true);
