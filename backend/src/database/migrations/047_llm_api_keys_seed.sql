-- Migration: 047_llm_api_keys_seed.sql
-- Seeds the llm_api_keys row so the admin UI can store per-provider API keys
-- and the llm_defaults row for default temperature/maxTokens overrides.

INSERT INTO system_settings (key, value) VALUES
  ('llm_api_keys', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
