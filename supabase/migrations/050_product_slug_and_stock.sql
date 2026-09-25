-- ============================================================
-- 050_product_slug_and_stock.sql
--
-- Adds support for:
-- 1. Product Slugs & Gallery Images (slug, images, low_stock_threshold)
-- 2. Public read policy for single product landing pages
-- 3. Atomic stock adjustment & decrement RPC
-- ============================================================

-- 1. Add slug, images array, and low stock threshold to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5;

-- Generate slug for any existing products that don't have one
UPDATE products
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(id::text, 1, 6)
WHERE slug IS NULL;

-- Add UNIQUE constraint on slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_unique'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_slug_unique UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- 2. Allow public to view active products (for /p/[slug] single product page)
DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (is_active = true);

-- 3. Concurrency-safe atomic stock decrement RPC
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_quantity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INT;
  v_new_stock INT;
  v_product_name TEXT;
BEGIN
  -- Select for update to lock the row during decrement
  SELECT stock_quantity, name INTO v_current_stock, v_product_name
  FROM products
  WHERE id = p_product_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found or inactive');
  END IF;

  IF v_current_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'available', v_current_stock,
      'requested', p_quantity
    );
  END IF;

  v_new_stock := v_current_stock - p_quantity;

  UPDATE products
  SET stock_quantity = v_new_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'product_name', v_product_name,
    'previous_stock', v_current_stock,
    'remaining_stock', v_new_stock
  );
END;
$$;
