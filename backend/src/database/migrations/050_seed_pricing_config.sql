-- Migration: 050_seed_pricing_config.sql
-- Seeds the pricing_config key in the system_settings table.
-- Stores tier pricing and overage unit pricing as JSONB so
-- superadmin can change prices at runtime.

INSERT INTO system_settings (key, value) VALUES
  ('pricing_config', '{
    "tiers": {
      "free":       { "monthly": 0,   "annual": 0   },
      "starter":    { "monthly": 9,   "annual": 90  },
      "premium":    { "monthly": 15,  "annual": 150 },
      "pro":        { "monthly": 45,  "annual": 450 },
      "enterprise": { "monthly": 99,  "annual": 0   }
    },
    "overage": {
      "queries": 0.05,
      "document_upload": 0.50,
      "tavily_searches": 0.10
    }
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
