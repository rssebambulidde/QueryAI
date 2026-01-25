-- Subscription History Table
-- Tracks all subscription changes for audit trail

CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('tier_change', 'status_change', 'period_change', 'cancellation', 'reactivation', 'renewal')),
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_history_change_type ON subscription_history(change_type);

-- Row Level Security (RLS) for subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription history
CREATE POLICY "Users can view their own subscription history"
    ON subscription_history FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role can manage subscription history"
    ON subscription_history FOR ALL
    USING (auth.role() = 'service_role');
