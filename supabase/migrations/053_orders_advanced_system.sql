-- ============================================================
-- 053_orders_advanced_system.sql
--
-- Advanced Order & Inventory System:
-- 1. Atomic increment product stock RPC (for order cancellation & returns)
-- 2. Advance payment tracking (method, status) & Invoice numbers on orders
-- 3. Automatic invoice number generation trigger
-- ============================================================

-- 1. Concurrency-safe atomic stock increment RPC
CREATE OR REPLACE FUNCTION increment_product_stock(
  p_product_id UUID,
  p_quantity INT,
  p_variant_id TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'order_cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id UUID;
  v_current_stock INT;
  v_new_stock INT;
  v_variants JSONB;
  v_new_variants JSONB;
  v_elem JSONB;
  v_found_variant BOOLEAN := false;
BEGIN
  -- Select for update to lock the row
  SELECT account_id, stock_quantity, COALESCE(variants, '[]'::JSONB)
  INTO v_account_id, v_current_stock, v_variants
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  v_new_stock := v_current_stock + p_quantity;

  -- Handle variant stock restore if variant_id provided
  IF p_variant_id IS NOT NULL AND jsonb_array_length(v_variants) > 0 THEN
    v_new_variants := '[]'::JSONB;
    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_variants)
    LOOP
      IF (v_elem->>'id') = p_variant_id THEN
        v_found_variant := true;
        v_elem := jsonb_set(
          v_elem,
          '{stock}',
          to_jsonb(COALESCE((v_elem->>'stock')::INT, 0) + p_quantity)
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
      total_sold = GREATEST(0, COALESCE(total_sold, 0) - p_quantity),
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Record audit stock log
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
    p_quantity,
    v_current_stock,
    v_new_stock,
    p_reason,
    p_order_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'new_stock', v_new_stock
  );
END;
$$;

-- 2. Add advance payment & invoice columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS advance_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS advance_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS invoice_no TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no);

-- Populate existing orders invoice_no
UPDATE orders
SET invoice_no = 'INV-' || TO_CHAR(created_at, 'YYMM') || '-' || UPPER(SUBSTRING(id::text, 1, 6))
WHERE invoice_no IS NULL;

-- 3. Trigger to auto-generate invoice_no if not present
CREATE OR REPLACE FUNCTION generate_order_invoice_no()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := 'INV-' || TO_CHAR(NOW(), 'YYMM') || '-' || UPPER(SUBSTRING(NEW.id::text, 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_order_invoice_no ON orders;
CREATE TRIGGER trigger_set_order_invoice_no
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_invoice_no();
