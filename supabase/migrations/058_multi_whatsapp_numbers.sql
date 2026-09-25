-- ============================================================
-- 058_multi_whatsapp_numbers.sql — Allow multiple WhatsApp
-- numbers per account (single dashboard, multiple phones)
--
-- Previously: UNIQUE(account_id) meant one WhatsApp number per
-- account. Users managing multiple numbers (e.g. different
-- regional lines or brands) had to create separate accounts.
--
-- After this migration:
--   * One account can have N whatsapp_config rows, each with a
--     distinct phone_number_id.
--   * UNIQUE(phone_number_id) [from 013] stays — one account per
--     number globally (no cross-account sharing of a number).
--   * The webhook already routes by phone_number_id so it still
--     works without any route changes.
--   * An optional `label` column lets users give each number a
--     friendly name ("Customer Support", "Sales BD", etc.).
--   * `is_primary` lets callers designate a default number for
--     outbound actions that don't target a specific number yet
--     (e.g. broadcast drafts). Only one row per account may be
--     primary — enforced by a partial unique index.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Drop the UNIQUE(account_id) constraint so an account can
--    have more than one row. The UNIQUE(phone_number_id) from
--    migration 013 stays — each phone number is still globally
--    unique across all accounts.
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

-- Also drop the legacy UNIQUE(user_id) if it still exists on any
-- schema that didn't fully apply migration 017 (e.g. fresh test
-- databases seeded from 001 only).
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

-- 2. Add a human-readable label column so users can name their
--    numbers ("Sales Line", "Support BD", "Marketing").
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS label TEXT;

-- 3. Add is_primary flag. NULL is treated as false; TRUE means
--    this row is the default outbound number for the account.
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Enforce at most one primary per account using a partial
--    unique index (only indexes rows where is_primary = TRUE).
--    DROP first so re-runs don't error.
DROP INDEX IF EXISTS idx_whatsapp_config_one_primary_per_account;
CREATE UNIQUE INDEX idx_whatsapp_config_one_primary_per_account
  ON whatsapp_config(account_id)
  WHERE is_primary = TRUE;

-- 5. For existing rows (which each already represent the only
--    number for their account), set is_primary = TRUE so
--    callers looking for the "default" number still get a result.
UPDATE whatsapp_config
  SET is_primary = TRUE
  WHERE is_primary = FALSE
    AND id IN (
      -- Pick the oldest row per account as the primary.
      SELECT DISTINCT ON (account_id) id
      FROM whatsapp_config
      ORDER BY account_id, created_at ASC
    );

-- 6. Update the RLS policy from migration 017. The old policy
--    used UNIQUE(account_id) to guarantee maybeSingle() worked.
--    Now we need members to see ALL rows for their account,
--    not just one. The membership check stays the same.
DROP POLICY IF EXISTS whatsapp_config_select ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_insert ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_update ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_delete ON whatsapp_config;

-- From migration 017_account_sharing.sql the policies were set on
-- the "Users can manage own config" policy name. Drop both names
-- for safety.
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;

CREATE POLICY whatsapp_config_select ON whatsapp_config
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY whatsapp_config_insert ON whatsapp_config
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY whatsapp_config_update ON whatsapp_config
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

CREATE POLICY whatsapp_config_delete ON whatsapp_config
  FOR DELETE USING (is_account_member(account_id, 'admin'));
