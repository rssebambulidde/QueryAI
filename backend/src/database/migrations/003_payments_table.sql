-- Payments Table for Pesapal Integration
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

-- Payments table to track payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    pesapal_order_tracking_id TEXT UNIQUE,
    pesapal_merchant_reference TEXT UNIQUE,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'premium', 'pro')),
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'UGX',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    payment_method TEXT,
    payment_description TEXT,
    callback_data JSONB,
    webhook_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_pesapal_order_tracking_id ON payments(pesapal_order_tracking_id);
CREATE INDEX IF NOT EXISTS idx_payments_pesapal_merchant_reference ON payments(pesapal_merchant_reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Add updated_at trigger
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payments
CREATE POLICY "Users can view their own payments"
    ON payments FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role can manage payments"
    ON payments FOR ALL
    USING (auth.role() = 'service_role');
