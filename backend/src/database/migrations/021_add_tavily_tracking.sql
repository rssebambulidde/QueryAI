-- Add Tavily Tracking Migration
-- Adds columns to track Tavily search usage per subscription
-- Run this in Supabase SQL Editor

-- Add Tavily search tracking columns to subscriptions table
ALTER TABLE subscriptions 
    ADD COLUMN IF NOT EXISTS tavily_searches_used INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS tavily_searches_limit INTEGER;

-- Add constraint to ensure tavily_searches_used is non-negative
ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_tavily_searches_used_check 
    CHECK (tavily_searches_used >= 0);

-- Add constraint to ensure tavily_searches_limit is positive if set
ALTER TABLE subscriptions 
    ADD CONSTRAINT subscriptions_tavily_searches_limit_check 
    CHECK (tavily_searches_limit IS NULL OR tavily_searches_limit > 0);

-- Create index for efficient queries on Tavily usage
CREATE INDEX IF NOT EXISTS idx_subscriptions_tavily_searches_used 
    ON subscriptions(tavily_searches_used) 
    WHERE tavily_searches_limit IS NOT NULL;

-- Create index for queries filtering by usage approaching limit
CREATE INDEX IF NOT EXISTS idx_subscriptions_tavily_usage_approaching_limit 
    ON subscriptions(user_id, tavily_searches_used, tavily_searches_limit) 
    WHERE tavily_searches_limit IS NOT NULL 
    AND tavily_searches_used > 0;

-- Add comments for documentation
COMMENT ON COLUMN subscriptions.tavily_searches_used IS 'Number of Tavily searches used in the current billing period';
COMMENT ON COLUMN subscriptions.tavily_searches_limit IS 'Maximum number of Tavily searches allowed per billing period for this tier';
