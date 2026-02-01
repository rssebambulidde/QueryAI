-- Overage Tracking Migration (Week 8: Usage-Based Pricing)
-- Adds overage_records table and supports overage billing.
-- Note: Uses 025 (011 is reserved for retrieval_metrics).

-- Overage records: one row per (user, period, metric_type).
-- Tracks usage beyond tier limits and computed charges.
CREATE TABLE IF NOT EXISTS overage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('queries', 'document_upload', 'tavily_searches')),
    limit_value INTEGER NOT NULL,
    usage_value INTEGER NOT NULL,
    overage_units INTEGER NOT NULL CHECK (overage_units >= 0),
    tier TEXT NOT NULL CHECK (tier IN ('free', 'starter', 'premium', 'pro')),
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('UGX', 'USD')),
    unit_price DECIMAL(12, 4) NOT NULL,
    amount_charged DECIMAL(12, 2) NOT NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, period_start, period_end, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_overage_records_user_id ON overage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_overage_records_period ON overage_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_overage_records_payment_id ON overage_records(payment_id);

CREATE TRIGGER update_overage_records_updated_at
    BEFORE UPDATE ON overage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE overage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overage records"
    ON overage_records FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access overage_records"
    ON overage_records FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
