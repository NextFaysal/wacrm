-- ============================================================
-- 045_auto_assignment.sql
--
-- Adds Auto-Assignment (Round-Robin) settings to accounts
-- and indexes for efficient agent workload queries.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS auto_assign_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_assign_online_only BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(account_id, assigned_agent_id);
