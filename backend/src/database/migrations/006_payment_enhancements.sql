-- Payment Enhancements Migration
-- Adds fields for refunds and payment retry tracking

-- Add refund fields to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS recurring_payment_id TEXT;

-- Create refunds table for detailed refund tracking
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL,
    reason TEXT,
    pesapal_refund_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    refund_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Add updated_at trigger for refunds
CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own refunds
CREATE POLICY "Users can view their own refunds"
    ON refunds FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role can manage refunds"
    ON refunds FOR ALL
    USING (auth.role() = 'service_role');
