-- Add Annual Billing (Phase 3, Week 7.1)
-- Adds billing period and annual discount to subscriptions.
-- Run after existing subscription migrations.

-- Add billing period and annual discount columns
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS annual_discount DECIMAL(5, 2) DEFAULT 0;

-- Ensure billing_period constraint (drop first if re-running)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_period_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_billing_period_check
  CHECK (billing_period IN ('monthly', 'annual'));

-- Optional: ensure annual_discount is 0–100 if used as percentage
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_annual_discount_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_annual_discount_check
  CHECK (annual_discount >= 0 AND annual_discount <= 100);

-- Index for filtering by billing period
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_period ON subscriptions(billing_period);

COMMENT ON COLUMN subscriptions.billing_period IS 'Billing interval: monthly or annual';
COMMENT ON COLUMN subscriptions.annual_discount IS 'Discount percentage applied when billing_period is annual (0–100)';
