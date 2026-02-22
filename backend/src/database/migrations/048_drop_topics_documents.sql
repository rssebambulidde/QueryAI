-- 048: Drop topic and document tables (Phase 6 cleanup)
-- IMPORTANT: This is irreversible. Run AFTER verifying Phase 2 (v2 migration) works correctly.
-- Date: 2026-02-22

BEGIN;

-- ── Drop topic/document-related RPCs first (depend on topics table) ───────────

DROP FUNCTION IF EXISTS public.get_feedback_by_topic CASCADE;
DROP FUNCTION IF EXISTS private.get_feedback_by_topic CASCADE;
DROP FUNCTION IF EXISTS public.get_topic_cited_sources CASCADE;
DROP FUNCTION IF EXISTS private.get_topic_cited_sources CASCADE;
DROP FUNCTION IF EXISTS public.get_topic_ancestors CASCADE;
DROP FUNCTION IF EXISTS private.get_topic_ancestors CASCADE;
DROP FUNCTION IF EXISTS public.get_topic_descendants CASCADE;
DROP FUNCTION IF EXISTS private.get_topic_descendants CASCADE;

-- ── Drop FK columns referencing topics/documents ──────────────────────────────

-- conversations
ALTER TABLE conversations DROP COLUMN IF EXISTS topic_id;

-- message_feedback (was incorrectly named "feedback" in original migration)
ALTER TABLE message_feedback DROP COLUMN IF EXISTS topic_id;

-- answer_evaluations (was incorrectly named "quality_evaluations")
ALTER TABLE answer_evaluations DROP COLUMN IF EXISTS topic_id;

-- cited_sources has document_id
ALTER TABLE cited_sources DROP COLUMN IF EXISTS document_id;

-- cited_source_conversations has topic_id
ALTER TABLE cited_source_conversations DROP COLUMN IF EXISTS topic_id;

-- retrieval_metrics has topic_id and ancestor_topic_ids
ALTER TABLE retrieval_metrics DROP COLUMN IF EXISTS topic_id;
ALTER TABLE retrieval_metrics DROP COLUMN IF EXISTS ancestor_topic_ids;

-- ── Drop tables (CASCADE removes dependent constraints/indexes) ───────────────

DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS topics CASCADE;

COMMIT;
