-- Migration 057: Login Activity tracking
-- Stores login/signup events with real client IP addresses
-- (Supabase audit_log_entries does not capture IPs when the backend proxies auth)

CREATE TABLE IF NOT EXISTS public.login_activity (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text        NOT NULL CHECK (action IN ('login', 'signup')),
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: recent activity per user
CREATE INDEX IF NOT EXISTS idx_login_activity_user_created
  ON public.login_activity (user_id, created_at DESC);

-- RLS: service_role only (accessed via backend)
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.login_activity FROM anon, authenticated;
GRANT SELECT, INSERT ON public.login_activity TO service_role;
