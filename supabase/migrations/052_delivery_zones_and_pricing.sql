-- ============================================================
-- 052_delivery_zones_and_pricing.sql
--
-- Dynamic Delivery Zones and Shipping Pricing Rules:
-- 1. delivery_zones table (area name, fee, is_free, estimated_time, sort_order, is_active)
-- 2. delivery_settings table (global free toggle, min qty/amount for free delivery, banner)
-- 3. Seed default delivery zones for existing accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                         -- e.g. 'ঢাকার ভেতরে', 'ঢাকার বাইরে', 'ঢাকার আশপাশে'
  code TEXT,                                  -- e.g. 'inside_dhaka', 'outside_dhaka', 'dhaka_suburbs'
  charge NUMERIC NOT NULL DEFAULT 100,        -- standard charge in BDT
  is_free BOOLEAN NOT NULL DEFAULT false,     -- if true, charge is 0
  estimated_time TEXT DEFAULT '24 - 48 Hours', -- e.g. '24 - 48 Hours', '2 - 3 Days'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  free_delivery_global BOOLEAN NOT NULL DEFAULT false,    -- global 100% free delivery across all zones
  free_delivery_min_qty INT DEFAULT 2,                   -- free delivery if order quantity >= min_qty (0 to disable)
  free_delivery_min_amount NUMERIC DEFAULT 0,            -- free delivery if total amount >= min_amount (0 to disable)
  free_delivery_banner_text TEXT DEFAULT '🎁 ধামাকা অফার: ২ বা ততোধিক পিস অর্ডার করলেই ডেলিভারি সম্পূর্ণ ফ্রি!',
  cod_enabled BOOLEAN NOT NULL DEFAULT true,             -- cash on delivery enabled
  advance_charge_required BOOLEAN NOT NULL DEFAULT false, -- require advance delivery fee outside dhaka
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_account ON delivery_zones(account_id, sort_order);

-- RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can view delivery zones" ON delivery_zones;
CREATE POLICY "Account members can view delivery zones" ON delivery_zones
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage delivery zones" ON delivery_zones;
CREATE POLICY "Agents can manage delivery zones" ON delivery_zones
  FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "Public can view active delivery zones" ON delivery_zones;
CREATE POLICY "Public can view active delivery zones" ON delivery_zones
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Account members can view delivery settings" ON delivery_settings;
CREATE POLICY "Account members can view delivery settings" ON delivery_settings
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "Agents can manage delivery settings" ON delivery_settings;
CREATE POLICY "Agents can manage delivery settings" ON delivery_settings
  FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "Public can view delivery settings" ON delivery_settings;
CREATE POLICY "Public can view delivery settings" ON delivery_settings
  FOR SELECT USING (true);

-- Seed default delivery zones for any accounts that don't have them
INSERT INTO delivery_zones (account_id, name, code, charge, is_free, estimated_time, sort_order, is_active)
SELECT 
  a.id, 
  z.name, 
  z.code, 
  z.charge, 
  z.is_free, 
  z.estimated_time, 
  z.sort_order, 
  true
FROM accounts a
CROSS JOIN (
  VALUES 
    ('ঢাকার ভেতরে', 'inside_dhaka', 100::NUMERIC, false, '২৪ - ৪৮ ঘণ্টার মধ্যে', 1),
    ('ঢাকার আশপাশে (সাভার/গাজীপুর/কেরানীগঞ্জ)', 'dhaka_suburbs', 120::NUMERIC, false, '২৪ - ৪৮ ঘণ্টার মধ্যে', 2),
    ('ঢাকার বাইরে (সারাদেশে)', 'outside_dhaka', 150::NUMERIC, false, '২ - ৩ কার্যদিবস', 3)
) AS z(name, code, charge, is_free, estimated_time, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_zones dz WHERE dz.account_id = a.id
);

-- Seed default delivery settings for existing accounts
INSERT INTO delivery_settings (account_id, free_delivery_global, free_delivery_min_qty, free_delivery_min_amount)
SELECT a.id, false, 2, 0
FROM accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_settings ds WHERE ds.account_id = a.id
);
