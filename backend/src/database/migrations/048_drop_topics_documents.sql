-- 048: Drop topic and document tables (Phase 6 cleanup)
-- IMPORTANT: This is irreversible. Run AFTER verifying Phase 2 (v2 migration) works correctly.
-- Date: 2026-02-22

BEGIN;

-- ── Drop FK columns referencing topics/documents ──────────────────────────────

ALTER TABLE conversations DROP COLUMN IF EXISTS topic_id;
ALTER TABLE feedback DROP COLUMN IF EXISTS topic_id;
ALTER TABLE quality_evaluations DROP COLUMN IF EXISTS topic_id;
ALTER TABLE cited_sources DROP COLUMN IF EXISTS document_id;
ALTER TABLE cited_sources DROP COLUMN IF EXISTS topic_id;

-- ── Drop tables (CASCADE removes dependent constraints/indexes) ───────────────

DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS topics CASCADE;

-- ── Drop related RPCs ─────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_feedback_by_topic CASCADE;
DROP FUNCTION IF EXISTS private.get_feedback_by_topic CASCADE;

-- ── Revoke/cleanup (no-op if already dropped) ────────────────────────────────

-- Revoke any remaining grants on dropped functions
-- (CASCADE above handles most cleanup automatically)

COMMIT;
