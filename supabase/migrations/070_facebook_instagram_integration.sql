-- ============================================================
-- 070_facebook_instagram_integration.sql
--
-- 1. meta_integrations: Facebook Page, Instagram Account, Ads Config & AI Settings
-- 2. meta_comments: Facebook & Instagram comments feed, status, AI auto-replies
-- 3. meta_comment_replies: Thread replies (public comments & private DMs)
-- 4. meta_ads_metrics: Daily ad campaign spend, clicks, impressions, ROAS
-- 5. conversations: Support for omnichannel channels ('whatsapp', 'facebook', 'instagram')
-- ============================================================

-- 1. Meta Integrations Config
CREATE TABLE IF NOT EXISTS meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  page_id TEXT,
  page_name TEXT,
  page_access_token TEXT,
  instagram_account_id TEXT,
  instagram_username TEXT,
  ad_account_id TEXT,
  app_id TEXT,
  app_secret TEXT,
  verify_token TEXT DEFAULT 'wacrm_meta_verify_token',
  ai_comment_reply_enabled BOOLEAN DEFAULT true,
  ai_comment_private_dm_enabled BOOLEAN DEFAULT true,
  ai_comment_prompt TEXT DEFAULT 'You are a warm, helpful customer support assistant for an online shop. Reply to Facebook and Instagram comments in a polite, engaging, and friendly manner in the same language the customer used (Bengali or English). If they ask for price, stock, or how to order, politely let them know that full details and price have been sent to their inbox/DM, and encourage them to check their messages.',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_integrations_account ON meta_integrations(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_page ON meta_integrations(page_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_ig ON meta_integrations(instagram_account_id);

ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage meta integrations" ON meta_integrations;
CREATE POLICY "Account members can manage meta integrations" ON meta_integrations
  FOR ALL USING (is_account_member(account_id));

-- 2. Meta Comments Table
CREATE TABLE IF NOT EXISTS meta_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  post_id TEXT,
  post_url TEXT,
  post_caption TEXT,
  comment_id TEXT NOT NULL,
  parent_comment_id TEXT,
  sender_id TEXT,
  sender_name TEXT,
  sender_username TEXT,
  message TEXT NOT NULL,
  sentiment TEXT DEFAULT 'neutral',
  is_hidden BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  ai_replied BOOLEAN DEFAULT false,
  ai_reply_text TEXT,
  ai_private_dm_sent BOOLEAN DEFAULT false,
  comment_created_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_comments_account ON meta_comments(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_comments_comment_id ON meta_comments(comment_id);
CREATE INDEX IF NOT EXISTS idx_meta_comments_post_id ON meta_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_meta_comments_platform ON meta_comments(platform);
CREATE INDEX IF NOT EXISTS idx_meta_comments_ai_replied ON meta_comments(ai_replied);

ALTER TABLE meta_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage meta comments" ON meta_comments;
CREATE POLICY "Account members can manage meta comments" ON meta_comments
  FOR ALL USING (is_account_member(account_id));

-- 3. Meta Comment Replies Table
CREATE TABLE IF NOT EXISTS meta_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('page', 'ai', 'user')),
  reply_id TEXT,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_comment_replies_account ON meta_comment_replies(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_comment_replies_comment ON meta_comment_replies(comment_id);

ALTER TABLE meta_comment_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage comment replies" ON meta_comment_replies;
CREATE POLICY "Account members can manage comment replies" ON meta_comment_replies
  FOR ALL USING (is_account_member(account_id));

-- 4. Meta Ads Metrics Table
CREATE TABLE IF NOT EXISTS meta_ads_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  spend NUMERIC(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cpc NUMERIC(10, 4) DEFAULT 0,
  cpm NUMERIC(10, 4) DEFAULT 0,
  ctr NUMERIC(6, 4) DEFAULT 0,
  conversions INT DEFAULT 0,
  attributed_revenue NUMERIC(12, 2) DEFAULT 0,
  roas NUMERIC(10, 2) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_account ON meta_ads_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON meta_ads_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_date ON meta_ads_metrics(date);

ALTER TABLE meta_ads_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account members can manage ads metrics" ON meta_ads_metrics;
CREATE POLICY "Account members can manage ads metrics" ON meta_ads_metrics
  FOR ALL USING (is_account_member(account_id));

-- 5. Add multi-channel support to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'facebook', 'instagram')),
  ADD COLUMN IF NOT EXISTS meta_psid TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_meta_psid ON conversations(meta_psid);
