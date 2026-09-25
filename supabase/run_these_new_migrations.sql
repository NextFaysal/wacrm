-- ============================================================
-- RUN THESE MIGRATIONS FOR MULTI-WHATSAPP SUPPORT (058 + 059)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Migration 058: Allow Multiple WhatsApp Numbers per Account
-- ------------------------------------------------------------

-- Drop UNIQUE(account_id) constraint so an account can have more than one row
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_config_account_id_key'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      DROP CONSTRAINT whatsapp_config_account_id_key;
  END IF;
END $$;

-- Drop legacy UNIQUE(user_id) if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_config_user_id_key'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      DROP CONSTRAINT whatsapp_config_user_id_key;
  END IF;
END $$;

-- Add friendly label column
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Add is_primary flag
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforce at most one primary per account
DROP INDEX IF EXISTS idx_whatsapp_config_one_primary_per_account;
CREATE UNIQUE INDEX idx_whatsapp_config_one_primary_per_account
  ON whatsapp_config(account_id)
  WHERE is_primary = TRUE;

-- Update existing rows to primary if needed
UPDATE whatsapp_config
  SET is_primary = TRUE
  WHERE is_primary = FALSE
    AND id IN (
      SELECT DISTINCT ON (account_id) id
      FROM whatsapp_config
      ORDER BY account_id, created_at ASC
    );

-- Update RLS policies
DROP POLICY IF EXISTS whatsapp_config_select ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_insert ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_update ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_delete ON whatsapp_config;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;

CREATE POLICY whatsapp_config_select ON whatsapp_config
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY whatsapp_config_insert ON whatsapp_config
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY whatsapp_config_update ON whatsapp_config
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

CREATE POLICY whatsapp_config_delete ON whatsapp_config
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ------------------------------------------------------------
-- 2. Migration 059: Track Receiving WhatsApp Number on Conversations
-- ------------------------------------------------------------

-- Add wa_phone_number_id column to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT;

-- Index for filtering by number in inbox
CREATE INDEX IF NOT EXISTS idx_conversations_wa_phone_number_id
  ON conversations(account_id, wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;
