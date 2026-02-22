-- Migration 049: Default payments.currency to 'USD'
-- Removes UGX support — PayPal doesn't support UGX so dual-currency was dead code.

BEGIN;

-- Set default to 'USD' for all future payments
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'USD';

-- Update any existing UGX rows to USD (historical cleanup)
UPDATE payments SET currency = 'USD' WHERE currency = 'UGX';

-- Update overage_records if they have a currency column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overage_records' AND column_name = 'currency'
  ) THEN
    EXECUTE 'UPDATE overage_records SET currency = ''USD'' WHERE currency = ''UGX''';
    EXECUTE 'ALTER TABLE overage_records ALTER COLUMN currency SET DEFAULT ''USD''';
  END IF;
END $$;

COMMIT;
