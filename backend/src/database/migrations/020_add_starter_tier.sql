-- Add Starter Tier Migration
-- Adds 'starter' tier to subscription tier constraints
-- Run this in Supabase SQL Editor

-- Drop existing CHECK constraints on tier columns
-- Note: PostgreSQL doesn't support DROP CONSTRAINT IF EXISTS directly, so we use a DO block
DO $$
BEGIN
    -- Drop tier constraint from subscriptions table
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subscriptions_tier_check'
    ) THEN
        ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_tier_check;
    END IF;
    
    -- Drop tier constraint from payments table
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_tier_check'
    ) THEN
        ALTER TABLE payments DROP CONSTRAINT payments_tier_check;
    END IF;
    
    -- Drop pending_tier constraint from subscriptions table
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subscriptions_pending_tier_check'
    ) THEN
        ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_pending_tier_check;
    END IF;
END $$;

-- Add new CHECK constraints that include 'starter' tier
ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_tier_check 
    CHECK (tier IN ('free', 'starter', 'premium', 'pro'));

ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_pending_tier_check 
    CHECK (pending_tier IS NULL OR pending_tier IN ('free', 'starter', 'premium', 'pro'));

ALTER TABLE payments 
    ADD CONSTRAINT payments_tier_check 
    CHECK (tier IN ('free', 'starter', 'premium', 'pro'));

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: free, starter, premium, or pro';
COMMENT ON COLUMN subscriptions.pending_tier IS 'Pending tier change: free, starter, premium, or pro';
COMMENT ON COLUMN payments.tier IS 'Payment tier: free, starter, premium, or pro';
