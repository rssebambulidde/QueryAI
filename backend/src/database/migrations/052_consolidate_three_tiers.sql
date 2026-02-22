-- Migration: 052_consolidate_three_tiers.sql
-- Consolidates subscription tiers from 5 (free, starter, premium, pro, enterprise)
-- to 3 (free, pro, enterprise). Migrates existing starter/premium rows → pro,
-- tightens CHECK constraints, and strips retired feature-flag keys from tier_limits.

BEGIN;

-- ============================================================
-- 1. Migrate existing rows: starter → pro, premium → pro
-- ============================================================

UPDATE subscriptions SET tier = 'pro' WHERE tier IN ('starter', 'premium');
UPDATE subscriptions SET pending_tier = 'pro' WHERE pending_tier IN ('starter', 'premium');
UPDATE payments      SET tier = 'pro' WHERE tier IN ('starter', 'premium');
UPDATE overage_records SET tier = 'pro' WHERE tier IN ('starter', 'premium');

-- ============================================================
-- 2. Drop old CHECK constraints and add new 3-tier ones
-- ============================================================

-- subscriptions.tier
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'pro', 'enterprise'));

-- subscriptions.pending_tier
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_pending_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_pending_tier_check
  CHECK (pending_tier IS NULL OR pending_tier IN ('free', 'pro', 'enterprise'));

-- payments.tier
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tier_check;
ALTER TABLE payments ADD CONSTRAINT payments_tier_check
  CHECK (tier IN ('free', 'pro', 'enterprise'));

-- overage_records.tier
ALTER TABLE overage_records DROP CONSTRAINT IF EXISTS overage_records_tier_check;
ALTER TABLE overage_records ADD CONSTRAINT overage_records_tier_check
  CHECK (tier IN ('free', 'pro', 'enterprise'));

-- ============================================================
-- 3. Update column comments
-- ============================================================

COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: free, pro, or enterprise';
COMMENT ON COLUMN subscriptions.pending_tier IS 'Pending tier change: free, pro, or enterprise';
COMMENT ON COLUMN payments.tier IS 'Payment tier: free, pro, or enterprise';
COMMENT ON COLUMN overage_records.tier IS 'Tier at time of overage: free, pro, or enterprise';

-- ============================================================
-- 4. Strip retired feature-flag keys from tier_limits JSON
--    Removes: features, maxTeamMembers (now hard-coded in app)
-- ============================================================

UPDATE system_settings
SET value = (
  SELECT jsonb_object_agg(
    tier_key,
    tier_val - 'features' - 'maxTeamMembers'
  )
  FROM jsonb_each(value) AS t(tier_key, tier_val)
)
WHERE key = 'tier_limits';

-- Also remove any leftover starter / premium keys from tier_limits
UPDATE system_settings
SET value = value - 'starter' - 'premium'
WHERE key = 'tier_limits';

COMMIT;
