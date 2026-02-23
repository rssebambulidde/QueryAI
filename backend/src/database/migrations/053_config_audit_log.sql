-- Migration 053: Config Audit Log
-- Stores an immutable trail of every pricing / tier-limit change
-- made through the admin dashboard.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.config_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type   text        NOT NULL CHECK (config_type IN ('pricing_config', 'tier_limits')),
  action        text        NOT NULL DEFAULT 'update',
  old_value     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  new_value     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  changed_by    uuid        NOT NULL REFERENCES auth.users(id),
  change_summary text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index: most common query is "newest first, filtered by type"
CREATE INDEX IF NOT EXISTS idx_config_audit_log_type_created
  ON public.config_audit_log (config_type, created_at DESC);

-- Index: look-ups by admin who made the change
CREATE INDEX IF NOT EXISTS idx_config_audit_log_changed_by
  ON public.config_audit_log (changed_by);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.config_audit_log ENABLE ROW LEVEL SECURITY;

-- Only the service-role (supabaseAdmin) can read/write.
-- No anon/authenticated policies — the table is accessed exclusively
-- via backend service-role calls.

-- ── Grants ───────────────────────────────────────────────────────────────────

REVOKE ALL ON public.config_audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.config_audit_log TO service_role;
