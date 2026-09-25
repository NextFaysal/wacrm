-- ============================================================
-- 056_products_cost_price.sql
--
-- Adds cost_price to products for profit margin calculation.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- Set a reasonable default cost_price (e.g. 50% of price) for existing products if 0 or null
UPDATE products
SET cost_price = ROUND(price * 0.55, 0)
WHERE cost_price IS NULL OR cost_price = 0;
