-- Migration: 051_seed_tier_limits.sql
-- Seeds the tier_limits key in the system_settings table.
-- Stores per-tier quotas and feature flags as JSONB so
-- superadmin can adjust limits at runtime.

INSERT INTO system_settings (key, value) VALUES
  ('tier_limits', '{
    "free": {
      "queriesPerMonth": 300,
      "tavilySearchesPerMonth": 10,
      "maxCollections": 3,
      "allowResearchMode": false
    },
    "pro": {
      "queriesPerMonth": null,
      "tavilySearchesPerMonth": 200,
      "maxCollections": null,
      "allowResearchMode": true
    },
    "enterprise": {
      "queriesPerMonth": null,
      "tavilySearchesPerMonth": null,
      "maxCollections": null,
      "allowResearchMode": true
    }
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
