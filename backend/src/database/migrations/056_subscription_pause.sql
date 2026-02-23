-- Migration 056: Subscription pause/resume support
-- Adds 'suspended' status to subscriptions and pause tracking columns.

BEGIN;

-- 1. Drop the existing CHECK constraint on status (if any) and add one that includes 'suspended'
DO $$
BEGIN
  -- Drop any CHECK constraint referencing status on subscriptions
  DECLARE
    _con text;
  BEGIN
    FOR _con IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.subscriptions'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', _con);
    END LOOP;
  END;
END
$$;

-- Add updated CHECK constraint including 'suspended'
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'expired', 'suspended'));

-- 2. Add pause tracking columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_at       TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pause_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pause_reason     TEXT DEFAULT NULL;

-- 3. Index for cron: find expired pauses efficiently
CREATE INDEX IF NOT EXISTS idx_subscriptions_pause_expired
  ON public.subscriptions (pause_expires_at)
  WHERE status = 'suspended' AND pause_expires_at IS NOT NULL;

-- Security
REVOKE ALL ON TABLE public.subscriptions FROM anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

COMMIT;
