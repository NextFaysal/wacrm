-- ============================================================
-- 060_gemini_provider_support.sql
-- Add Google Gemini (AI Studio) as a supported AI provider
-- ============================================================

ALTER TABLE IF EXISTS ai_configs DROP CONSTRAINT IF EXISTS ai_configs_provider_check;
ALTER TABLE IF EXISTS ai_configs ADD CONSTRAINT ai_configs_provider_check CHECK (provider IN ('openai', 'anthropic', 'gemini'));

ALTER TABLE IF EXISTS ai_usage_log DROP CONSTRAINT IF EXISTS ai_usage_log_provider_check;
ALTER TABLE IF EXISTS ai_usage_log ADD CONSTRAINT ai_usage_log_provider_check CHECK (provider IN ('openai', 'anthropic', 'gemini'));

