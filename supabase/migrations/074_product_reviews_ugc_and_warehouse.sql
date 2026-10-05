-- ============================================================
-- 074_product_reviews_ugc_and_warehouse.sql
--
-- 1. Extend product_reviews with order_id and photo_urls
-- 2. Add review tokens and warehouse scanning timestamps to orders
-- 3. Public insert policy on product_reviews
-- ============================================================

-- 1. Extend product_reviews table
ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

DROP POLICY IF EXISTS "Public can submit product reviews" ON product_reviews;
CREATE POLICY "Public can submit product reviews" ON product_reviews
  FOR INSERT WITH CHECK (true);

-- 2. Extend orders with warehouse scan & review tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS review_token TEXT,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warehouse_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warehouse_scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_review_token ON orders(review_token);
