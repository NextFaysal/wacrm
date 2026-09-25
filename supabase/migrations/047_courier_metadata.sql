-- ============================================================
-- 047_courier_metadata.sql
--
-- Adds metadata JSONB column to courier_configs for storing provider-specific
-- configurations such as Pathao OAuth credentials (username, password, store_id,
-- is_sandbox) and cached access tokens.
-- ============================================================

ALTER TABLE courier_configs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
