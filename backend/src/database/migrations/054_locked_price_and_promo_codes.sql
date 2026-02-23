-- Migration 054: Locked Price on Subscriptions + Promo Codes
--
-- 9.6.2  Price-change grace period
--   • locked_price_monthly / locked_price_annual on subscriptions
--   • When an admin changes pricing, existing subscribers keep their
--     locked price until the current period ends.
--
-- 9.6.3  Promo codes / coupons
--   • promo_codes table (admin-managed)
--   • promo_code_usages table (tracks redemptions)
--   • promo_code_id + discount columns on subscriptions

-- ═══════════════════════════════════════════════════════════════════
-- 9.6.2 — Locked price columns on subscriptions
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS locked_price_monthly  NUMERIC(10,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS locked_price_annual   NUMERIC(10,2)  DEFAULT NULL;

COMMENT ON COLUMN public.subscriptions.locked_price_monthly IS
  'Price (USD) locked at payment time for monthly billing. NULL = use current catalog price.';
COMMENT ON COLUMN public.subscriptions.locked_price_annual IS
  'Price (USD) locked at payment time for annual billing. NULL = use current catalog price.';

-- ═══════════════════════════════════════════════════════════════════
-- 9.6.3 — Promo codes
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text          NOT NULL,
  description     text,
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  -- Applicability
  applicable_tiers text[]       NOT NULL DEFAULT ARRAY['pro','enterprise'],
  applicable_periods text[]     NOT NULL DEFAULT ARRAY['monthly','annual'],
  -- Validity window
  valid_from      timestamptz   NOT NULL DEFAULT now(),
  valid_until     timestamptz,
  -- Usage limits
  max_uses        integer,                -- NULL = unlimited
  current_uses    integer       NOT NULL DEFAULT 0,
  max_uses_per_user integer     DEFAULT 1,
  -- Lifecycle
  is_active       boolean       NOT NULL DEFAULT true,
  created_by      uuid          NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- Unique code (case-insensitive look-ups via UPPER)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code_upper
  ON public.promo_codes (UPPER(code));

CREATE INDEX IF NOT EXISTS idx_promo_codes_active
  ON public.promo_codes (is_active, valid_from, valid_until);

-- ── Promo code usage tracking ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promo_code_usages (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id  uuid          NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id        uuid          NOT NULL REFERENCES auth.users(id),
  payment_id     uuid,         -- links to the payments row when applied
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_code_usages_user
  ON public.promo_code_usages (user_id, promo_code_id);

CREATE INDEX IF NOT EXISTS idx_promo_code_usages_code
  ON public.promo_code_usages (promo_code_id);

-- ── Link subscription to the promo code that was applied ─────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS promo_code_id       uuid          REFERENCES public.promo_codes(id),
  ADD COLUMN IF NOT EXISTS promo_discount_percent numeric(5,2) DEFAULT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.promo_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages   ENABLE ROW LEVEL SECURITY;

-- Service-role only (all access through backend).
REVOKE ALL ON public.promo_codes       FROM anon, authenticated;
REVOKE ALL ON public.promo_code_usages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.promo_codes       TO service_role;
GRANT SELECT, INSERT         ON public.promo_code_usages TO service_role;

-- ── Updated_at trigger for promo_codes ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promo_codes_updated_at ON public.promo_codes;
CREATE TRIGGER trg_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_promo_codes_updated_at();
