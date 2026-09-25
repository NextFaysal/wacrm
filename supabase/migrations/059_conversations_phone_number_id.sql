-- ============================================================
-- 059_conversations_phone_number_id.sql
--
-- Tracks which WhatsApp phone number received a conversation.
-- Required for multi-number accounts so inbox can filter by
-- "Show only conversations from Sales Line" or display a badge
-- on each conversation card.
--
-- The webhook already sets `wa_phone_number_id` on new messages
-- via the `processMessage` call. This migration adds the column
-- to conversations so it persists at the conversation level.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- Add the column (existing rows get NULL — backfill not needed
-- since the inbox just treats NULL as "unknown number" which is
-- fine for historical conversations pre-migration).
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT;

-- Index for inbox filtering ("show conversations for number X")
CREATE INDEX IF NOT EXISTS idx_conversations_wa_phone_number_id
  ON conversations(account_id, wa_phone_number_id)
  WHERE wa_phone_number_id IS NOT NULL;
