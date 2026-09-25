-- ============================================================
-- 043_quick_replies_shortcut.sql
--
-- Adds optional shortcut identifier (e.g. "price", "faq") to
-- quick_replies so agents can trigger them via `/shortcut` in
-- the message composer.
-- ============================================================

ALTER TABLE quick_replies
  ADD COLUMN IF NOT EXISTS shortcut TEXT;

CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(account_id, shortcut);
