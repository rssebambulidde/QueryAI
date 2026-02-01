-- Verification Migration: Ensure all tier constraints include 'starter' and 'enterprise'
-- This migration verifies and fixes tier CHECK constraints to ensure they include:
-- 'free', 'starter', 'premium', 'pro', 'enterprise'
-- Run this migration to ensure constraints are correct even if previous migrations were run out of order

-- Expected tier values for all constraints
DO $$
DECLARE
    expected_tiers TEXT[] := ARRAY['free', 'starter', 'premium', 'pro', 'enterprise'];
    constraint_name TEXT;
    constraint_def TEXT;
BEGIN
    -- 1. Verify and fix subscriptions.tier constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tier_check') THEN
        -- Drop and recreate to ensure it includes all tiers
        ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_tier_check;
    END IF;
    ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_tier_check
        CHECK (tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));
    
    RAISE NOTICE 'Updated subscriptions.tier constraint';

    -- 2. Verify and fix subscriptions.pending_tier constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_tier_check') THEN
        ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_pending_tier_check;
    END IF;
    ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_pending_tier_check
        CHECK (pending_tier IS NULL OR pending_tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));
    
    RAISE NOTICE 'Updated subscriptions.pending_tier constraint';

    -- 3. Verify and fix payments.tier constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_tier_check') THEN
        ALTER TABLE payments DROP CONSTRAINT payments_tier_check;
    END IF;
    ALTER TABLE payments
        ADD CONSTRAINT payments_tier_check
        CHECK (tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));
    
    RAISE NOTICE 'Updated payments.tier constraint';

    -- 4. Verify and fix overage_records.tier constraint (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'overage_records') THEN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'overage_records_tier_check') THEN
            ALTER TABLE overage_records DROP CONSTRAINT overage_records_tier_check;
        END IF;
        ALTER TABLE overage_records
            ADD CONSTRAINT overage_records_tier_check
            CHECK (tier IN ('free', 'starter', 'premium', 'pro', 'enterprise'));
        
        RAISE NOTICE 'Updated overage_records.tier constraint';
    ELSE
        RAISE NOTICE 'Table overage_records does not exist, skipping constraint update';
    END IF;

END $$;

-- Update comments to reflect all tiers
COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: free, starter, premium, pro, or enterprise';
COMMENT ON COLUMN subscriptions.pending_tier IS 'Pending tier change: free, starter, premium, pro, or enterprise';
COMMENT ON COLUMN payments.tier IS 'Payment tier: free, starter, premium, pro, or enterprise';

-- Verify constraints were created correctly
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    -- Count tier constraints
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conname IN (
        'subscriptions_tier_check',
        'subscriptions_pending_tier_check',
        'payments_tier_check',
        'overage_records_tier_check'
    );
    
    RAISE NOTICE 'Total tier constraints verified: %', constraint_count;
END $$;
