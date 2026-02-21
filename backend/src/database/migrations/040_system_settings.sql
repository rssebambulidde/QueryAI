-- Migration: 040_system_settings.sql
-- Creates the system_settings table for admin-configurable runtime settings.
-- Used by ProviderRegistry to persist per-mode LLM provider + model config.

-- ─── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  key   TEXT        PRIMARY KEY,
  value JSONB       NOT NULL,
  updated_by UUID   REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service-role (supabaseAdmin) can read/write
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- No permissive policies → anon / authenticated cannot touch this table.
-- Backend accesses it exclusively via supabaseAdmin (service-role key).

-- ─── Seed defaults ──────────────────────────────────────────────────────────

INSERT INTO system_settings (key, value) VALUES
  ('llm_provider_chat',     '{"providerId": "openai", "modelId": "gpt-4o-mini"}'::jsonb),
  ('llm_provider_research', '{"providerId": "openai", "modelId": "gpt-4o-mini"}'::jsonb),
  ('llm_defaults',          '{"temperature": 0.7, "maxTokens": 4096}'::jsonb),
  ('feature_flags',         '{"deepResearchEnabled": true, "generalChatEnabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── Permissions ────────────────────────────────────────────────────────────

REVOKE ALL ON system_settings FROM anon, authenticated;
