-- ============================================================
-- 065_advanced_ecommerce_ai_features.sql
--
-- 1. Adds Meta Conversions API (CAPI) credentials to business_settings
-- 2. Adds Smart Courier Routing, Meta CAPI, VIP Loyalty, and Live Tracking Bot toggles to ai_action_settings
-- 3. Adds Loyalty Tier and lifetime analytics to contacts
-- ============================================================

-- 1. Business Settings Meta CAPI fields
ALTER TABLE business_settings 
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_test_code TEXT;

-- 2. AI Action Settings toggles for advanced autonomous capabilities
ALTER TABLE ai_action_settings 
  ADD COLUMN IF NOT EXISTS smart_courier_routing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_capi_tracking BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vip_loyalty BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS live_tracking_bot BOOLEAN NOT NULL DEFAULT true;

-- 3. Contact Loyalty Tier & Lifetime stats
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS total_spend NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders INT DEFAULT 0;
