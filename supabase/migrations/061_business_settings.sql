-- ============================================================
-- 061_business_settings.sql
--
-- Dynamic Storefront & CMS Business Configuration:
-- Allows any business type (Watches, Fashion, Electronics, Food, Cosmetics, General)
-- to customize branding, storefront homepage, spec labels, announcements, and contacts.
-- ============================================================

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
  
  -- Dynamic product spec field labels for any business
  spec_label_1 TEXT DEFAULT 'স্পেসিফিকেশন ১',
  spec_label_2 TEXT DEFAULT 'স্পেসিফিকেশন ২',
  spec_label_3 TEXT DEFAULT 'স্পেসিফিকেশন ৩',
  spec_label_4 TEXT DEFAULT 'স্পেসিফিকেশন ৪',

  -- Trust & Value proposition highlights
  feature_1_title TEXT DEFAULT 'ক্যাশ অন ডেলিভারি',
  feature_1_subtitle TEXT DEFAULT 'পার্সেল দেখে মূল্য পরিশোধের সুযোগ',
  feature_2_title TEXT DEFAULT 'সুপারফাস্ট ডেলিভারি',
  feature_2_subtitle TEXT DEFAULT 'সারাদেশে দ্রুত হোম ডেলিভারি',
  feature_3_title TEXT DEFAULT '১০০% অরিজিনাল',
  feature_3_subtitle TEXT DEFAULT 'নিখুঁত কোয়ালিটি গ্যারান্টি',

  -- Notice / Urgency top bar
  announcement_text TEXT DEFAULT '🔥 সীমিত সময়ের স্পেশাল অফার! দ্রুত অর্ডার কনফার্ম করুন!',
  announcement_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_business_settings_slug ON business_settings(store_slug);

-- Enable RLS
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view business settings" ON business_settings;
CREATE POLICY "Account members can view business settings" ON business_settings
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage business settings" ON business_settings;
CREATE POLICY "Agents can manage business settings" ON business_settings
  FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "Public can view business settings" ON business_settings;
CREATE POLICY "Public can view business settings" ON business_settings
  FOR SELECT USING (true);

-- Seed default business settings for any existing accounts
INSERT INTO business_settings (
  account_id,
  store_name,
  business_type,
  store_slug,
  tagline,
  spec_label_1,
  spec_label_2,
  spec_label_3,
  spec_label_4
)
SELECT 
  a.id,
  COALESCE(a.name, 'My Store'),
  'general',
  LOWER(REGEXP_REPLACE(COALESCE(a.name, 'store') || '-' || SUBSTRING(a.id::text, 1, 6), '[^a-zA-Z0-9]+', '-', 'g')),
  'সেরা কোয়ালিটি ও দ্রুত ডেলিভারির নিশ্চয়তা',
  'মডেল / কোড',
  'ম্যাটেরিয়াল / উপাদান',
  'সাইজ / পরিমাপ',
  'ওয়ারেন্টি / গ্যারান্টি'
FROM accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM business_settings bs WHERE bs.account_id = a.id
);
