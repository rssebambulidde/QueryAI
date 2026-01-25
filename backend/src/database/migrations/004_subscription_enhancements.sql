-- Subscription Enhancements Migration
-- Adds fields for scheduled downgrades, trials, grace periods, and auto-renewal

-- Add pending_tier for scheduled downgrades
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS pending_tier TEXT CHECK (pending_tier IN ('free', 'premium', 'pro'));

-- Add trial period support
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- Add grace period for failed payments
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ;

-- Add auto-renewal preference
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE;

-- Add index for renewal queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end) 
WHERE status = 'active';

-- Add index for grace period queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_grace_period_end ON subscriptions(grace_period_end) 
WHERE grace_period_end IS NOT NULL;
