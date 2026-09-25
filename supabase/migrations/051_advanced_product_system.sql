-- ============================================================
-- 051_advanced_product_system.sql
--
-- Advanced E-Commerce Product Features:
-- 1. Storage bucket 'product-media' for direct image uploads
-- 2. Variants JSONB (color/strap, price, stock per variant)
-- 3. Analytics columns: view_count, total_sold, badge_text
-- 4. Product stock audit logs (product_stock_logs)
-- 5. Enhanced atomic stock decrement RPC with variant support
-- 6. Page view increment RPC
-- ============================================================

-- 1. Storage bucket for product uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  TRUE,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public can view product media" ON storage.objects;
CREATE POLICY "Public can view product media" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Authenticated users can upload product media" ON storage.objects;
CREATE POLICY "Authenticated users can upload product media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update product media" ON storage.objects;
CREATE POLICY "Authenticated users can update product media" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete product media" ON storage.objects;
CREATE POLICY "Authenticated users can delete product media" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-media' AND auth.role() = 'authenticated');

-- 2. Add variants, views, sold count, badge text to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sold INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_text TEXT DEFAULT NULL;

-- 3. Product stock audit logs
CREATE TABLE IF NOT EXISTS product_stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT,
  change_qty INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reason TEXT NOT NULL, -- 'manual_adjustment', 'order_placed', 'bulk_restock', 'return'
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON product_stock_logs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_logs_account ON product_stock_logs(account_id);

ALTER TABLE product_stock_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Account members can view stock logs" ON product_stock_logs;
CREATE POLICY "Account members can view stock logs" ON product_stock_logs
  FOR ALL USING (is_account_member(account_id));

-- 4. Page views increment RPC
CREATE OR REPLACE FUNCTION increment_product_views(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_product_id;
END;
$$;

-- 5. Concurrency-safe atomic stock decrement RPC with variant support
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_quantity INT,
  p_variant_id TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id UUID;
  v_current_stock INT;
  v_new_stock INT;
  v_product_name TEXT;
  v_variants JSONB;
  v_new_variants JSONB;
  v_elem JSONB;
  v_found_variant BOOLEAN := false;
BEGIN
  -- Lock the row for atomic safe mutation
  SELECT account_id, stock_quantity, name, COALESCE(variants, '[]'::JSONB)
  INTO v_account_id, v_current_stock, v_product_name, v_variants
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

  -- Handle variant stock decrement if variant_id provided
  IF p_variant_id IS NOT NULL AND jsonb_array_length(v_variants) > 0 THEN
    v_new_variants := '[]'::JSONB;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_variants)
    LOOP
      IF (v_elem->>'id') = p_variant_id THEN
        v_found_variant := true;
        v_elem := jsonb_set(
          v_elem,
          '{stock}',
          to_jsonb(GREATEST(0, COALESCE((v_elem->>'stock')::INT, 0) - p_quantity))
        );
      END IF;
      v_new_variants := v_new_variants || jsonb_build_array(v_elem);
    END LOOP;
    IF v_found_variant THEN
      v_variants := v_new_variants;
    END IF;
  END IF;

  UPDATE products
  SET stock_quantity = v_new_stock,
      variants = v_variants,
      total_sold = COALESCE(total_sold, 0) + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Record stock audit log
  INSERT INTO product_stock_logs (
    account_id,
    product_id,
    variant_id,
    change_qty,
    previous_stock,
    new_stock,
    reason,
    order_id
  ) VALUES (
    v_account_id,
    p_product_id,
    p_variant_id,
    -p_quantity,
    v_current_stock,
    v_new_stock,
    'order_placed',
    p_order_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'product_name', v_product_name,
    'previous_stock', v_current_stock,
    'remaining_stock', v_new_stock
  );
END;
$$;
