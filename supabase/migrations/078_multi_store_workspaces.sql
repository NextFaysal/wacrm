-- ============================================================
-- 078_multi_store_workspaces.sql
--
-- 1. Relax single-account per owner constraint to support multi-store / multi-brand
-- 2. Add store metadata (logo_url, brand_color) to accounts
-- 3. Policy allowing account owners to manage all their created stores
-- ============================================================

-- Drop 1-account-per-owner constraint so users can create and manage multiple stores
DROP INDEX IF EXISTS idx_accounts_one_per_owner;

-- Add store branding fields to accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS store_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#10b981';

-- Ensure owners can view and select all accounts they own
DROP POLICY IF EXISTS "Owners can view all their owned accounts" ON accounts;
CREATE POLICY "Owners can view all their owned accounts" ON accounts
  FOR SELECT USING (owner_user_id = auth.uid() OR is_account_member(id));
