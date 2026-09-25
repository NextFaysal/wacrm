-- ============================================================
-- 057_meta_window_and_cost_optimizer.sql
--
-- Tracks Meta WhatsApp Cloud API messaging cost windows:
-- 1. 72-Hour Free Customer Service Window for Meta Ad (CTWA) referrals
-- 2. 24-Hour Free Service Window for organic customer messages
-- 3. ai_followup_count to strictly avoid spamming customers (cost & retention guard)
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_ad_referral BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_window_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_followup_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_headline TEXT,
  ADD COLUMN IF NOT EXISTS referral_source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_free_window ON conversations(free_window_expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_is_ad ON conversations(is_ad_referral);
