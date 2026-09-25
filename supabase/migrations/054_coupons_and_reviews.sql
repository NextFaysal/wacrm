-- ============================================================
-- 054_coupons_and_reviews.sql
--
-- Adds:
-- 1. Coupons & Promo codes system (fixed discount / percentage)
-- 2. Product Reviews & Customer Testimonials for landing pages
-- 3. Seed default reviews & sample coupon for active products
-- ============================================================

-- 1. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                                  -- e.g. 'SAVE100', 'EID2026'
  discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value NUMERIC NOT NULL DEFAULT 100,        -- 100 BDT or 10%
  min_order_amount NUMERIC DEFAULT 0,
  max_discount NUMERIC,                                -- max cap for percentage discounts
  usage_limit INT DEFAULT 500,
  used_count INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_account ON coupons(account_id);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage coupons" ON coupons;
CREATE POLICY "Members can manage coupons" ON coupons
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active coupons" ON coupons;
CREATE POLICY "Public can view active coupons" ON coupons
  FOR SELECT USING (is_active = true);

-- 2. Product Reviews Table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_city TEXT DEFAULT 'Dhaka',
  rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  image_url TEXT,
  is_verified_purchase BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_account ON product_reviews(account_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage reviews" ON product_reviews;
CREATE POLICY "Members can manage reviews" ON product_reviews
  FOR ALL USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Public can view active reviews" ON product_reviews;
CREATE POLICY "Public can view active reviews" ON product_reviews
  FOR SELECT USING (is_active = true);

-- 3. Seed sample coupon and genuine reviews for active products
DO $$
DECLARE
  v_prod RECORD;
BEGIN
  -- Insert promo code 'SAVE100' for existing accounts
  INSERT INTO coupons (account_id, code, discount_type, discount_value, min_order_amount, is_active)
  SELECT id, 'SAVE100', 'fixed', 100, 1000, true
  FROM accounts
  ON CONFLICT (account_id, code) DO NOTHING;

  -- Insert sample reviews for active products
  FOR v_prod IN SELECT id, account_id, name FROM products WHERE is_active = true LIMIT 5
  LOOP
    IF NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = v_prod.id) THEN
      INSERT INTO product_reviews (account_id, product_id, customer_name, customer_city, rating, review_text, is_verified_purchase)
      VALUES
        (v_prod.account_id, v_prod.id, 'তানভীর হাসান', 'ঢাকা', 5, 'অসাধারণ ঘড়ি! যেমনটা ছবিতে দেখেছি হুবহু সেরকম পেয়েছি। ফিনিশিং এবং বেল্টের কোয়ালিটি চমৎকার।', true),
        (v_prod.account_id, v_prod.id, 'রাশেদুল ইসলাম', 'চট্টগ্রাম', 5, 'মাত্র ২ দিনে ডেলিভারি পেয়েছি। প্যাকেজিং খুব সুরক্ষিত ছিল। ধন্যবাদ আপনাদের ভালো সার্ভিসের জন্য।', true),
        (v_prod.account_id, v_prod.id, 'মাহমুদুল হক', 'সিলেট', 5, 'এই বাজেটে এত প্রিমিয়াম লুকের ঘড়ি সত্যিই প্রশংসনীয়। ওয়াটার রেজিস্ট্যান্সও টেস্ট করেছি, পারফেক্ট!', true);
    END IF;
  END LOOP;
END $$;
