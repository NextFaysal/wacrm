-- ============================================================
-- 060_gemini_provider_support.sql
-- Add Google Gemini (AI Studio) as a supported AI provider
-- ============================================================

ALTER TABLE IF EXISTS ai_configs DROP CONSTRAINT IF EXISTS ai_configs_provider_check;
ALTER TABLE IF EXISTS ai_configs ADD CONSTRAINT ai_configs_provider_check CHECK (provider IN ('openai', 'anthropic', 'gemini'));
