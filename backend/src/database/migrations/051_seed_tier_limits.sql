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
      "allowResearchMode": false,
      "features": {
        "embedding": false,
        "analytics": false,
        "apiAccess": false,
        "whiteLabel": false
      }
    },
    "pro": {
      "queriesPerMonth": null,
      "tavilySearchesPerMonth": 200,
      "maxCollections": null,
      "allowResearchMode": true,
      "features": {
        "embedding": true,
        "analytics": true,
        "apiAccess": true,
        "whiteLabel": true
      }
    },
    "enterprise": {
      "queriesPerMonth": null,
      "tavilySearchesPerMonth": null,
      "maxCollections": null,
      "allowResearchMode": true,
      "features": {
        "embedding": true,
        "analytics": true,
        "apiAccess": true,
        "whiteLabel": true,
        "teamCollaboration": true
      },
      "maxTeamMembers": 50
    }
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
