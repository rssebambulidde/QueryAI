-- Migration 055: User notifications table (in-app alerts)
-- Supports usage alerts (9.6.9) and future notification types.

CREATE TABLE IF NOT EXISTS user_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,            -- 'usage_warning' | 'usage_limit' | 'system' | ...
  title       text NOT NULL,
  message     text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb, -- metric, percentage, tier, etc.
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

-- Index: fast lookup for user's unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON user_notifications (user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Service-role only (supabaseAdmin) — no anon/authenticated policies
REVOKE ALL ON user_notifications FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON user_notifications TO service_role;

-- Seed default usage alert thresholds into system_settings
INSERT INTO system_settings (key, value)
VALUES (
  'usage_alert_thresholds',
  '{"thresholds": [80, 100], "enabled": true, "metrics": ["queries", "tavilySearches", "collections"]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
