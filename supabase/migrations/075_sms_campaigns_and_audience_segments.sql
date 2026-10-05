-- ============================================================
-- 075_sms_campaigns_and_audience_segments.sql
--
-- 1. sms_campaigns table for bulk promotional & flash sale marketing
-- 2. Link sms_logs with campaign_id
-- 3. Optimization indexes for review drip and audience segmentation
-- ============================================================

CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment_type TEXT NOT NULL DEFAULT 'ALL',
  provider TEXT NOT NULL DEFAULT 'bulksmsbd',
  sender_id TEXT,
  message_template TEXT NOT NULL,
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_account ON sms_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_campaigns(status);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage sms campaigns" ON sms_campaigns;
CREATE POLICY "Account members can manage sms campaigns" ON sms_campaigns
  FOR ALL USING (is_account_member(account_id));

-- Link sms_logs with campaign_id
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON sms_logs(campaign_id);

-- Performance index for review drip cron scanning
CREATE INDEX IF NOT EXISTS idx_orders_review_drip ON orders(account_id, status, review_requested_at, review_submitted_at)
  WHERE status = 'DELIVERED';
