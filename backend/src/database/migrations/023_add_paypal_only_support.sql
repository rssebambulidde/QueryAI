-- PayPal-Only Support Migration
-- Adds PayPal fields, sets payment provider to PayPal only.
-- Run after existing payment/subscription migrations.
-- Note: Pesapal columns are dropped in Step 5 (run after user migration).

-- Step 1: Add PayPal support to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS paypal_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

-- Add payment_provider (PayPal only); backfill existing rows
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'paypal';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_provider_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_provider_check
  CHECK (payment_provider IS NULL OR payment_provider = 'paypal');

UPDATE payments
  SET payment_provider = 'paypal'
  WHERE payment_provider IS NULL;

ALTER TABLE payments
  ALTER COLUMN payment_provider SET DEFAULT 'paypal';

-- Step 2: Migrate existing Pesapal payments (if any)
-- UPDATE payments SET payment_provider = 'paypal' WHERE payment_provider = 'pesapal';

-- Step 3: Add PayPal subscription ID to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_paypal_payment_id ON payments(paypal_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_provider ON payments(payment_provider);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_subscription_id ON subscriptions(paypal_subscription_id);

-- Step 5: Refunds table - add PayPal refund ID (Pesapal column remains until archive)
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS paypal_refund_id TEXT;

CREATE INDEX IF NOT EXISTS idx_refunds_paypal_refund_id ON refunds(paypal_refund_id);

-- Step 6: Remove Pesapal columns (run after user migration / data archive)
-- ALTER TABLE payments
--   DROP COLUMN IF EXISTS pesapal_order_tracking_id,
--   DROP COLUMN IF EXISTS pesapal_merchant_reference;
-- ALTER TABLE refunds
--   DROP COLUMN IF EXISTS pesapal_refund_id;
