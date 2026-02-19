-- ============================================================================
-- Migration 043: Topic hierarchy and nesting
--
-- Adds parent_topic_id to topics table to enable hierarchical topic trees.
-- Uses a materialized path column (topic_path) for efficient ancestor queries.
-- ============================================================================

-- 1. Add parent_topic_id and path columns
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS parent_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic_path TEXT DEFAULT '';

-- 2. Index for fast child lookups and path queries
CREATE INDEX IF NOT EXISTS idx_topics_parent_topic_id ON topics(parent_topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_path ON topics(topic_path);

-- 3. Prevent circular references: a topic cannot be its own parent
ALTER TABLE topics
  ADD CONSTRAINT chk_topic_no_self_parent
  CHECK (parent_topic_id IS DISTINCT FROM id);

-- 4. RPC: Get the ancestor chain for a given topic (returns from root → leaf)
CREATE OR REPLACE FUNCTION private.get_topic_ancestors(
  p_topic_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  parent_topic_id UUID,
  depth INT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestors AS (
    SELECT t.id, t.name, t.description, t.parent_topic_id, 0 AS depth
    FROM topics t
    WHERE t.id = p_topic_id AND t.user_id = p_user_id
    UNION ALL
    SELECT t.id, t.name, t.description, t.parent_topic_id, a.depth + 1
    FROM topics t
    INNER JOIN ancestors a ON t.id = a.parent_topic_id
    WHERE t.user_id = p_user_id AND a.depth < 10
  )
  SELECT ancestors.id, ancestors.name, ancestors.description,
         ancestors.parent_topic_id, ancestors.depth
  FROM ancestors
  ORDER BY ancestors.depth DESC;  -- root first
END;
$$;

-- 5. RPC: Get all descendant topic IDs for a given topic
CREATE OR REPLACE FUNCTION private.get_topic_descendants(
  p_topic_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  depth INT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    SELECT t.id, 0 AS depth
    FROM topics t
    WHERE t.id = p_topic_id AND t.user_id = p_user_id
    UNION ALL
    SELECT t.id, d.depth + 1
    FROM topics t
    INNER JOIN descendants d ON t.parent_topic_id = d.id
    WHERE t.user_id = p_user_id AND d.depth < 10
  )
  SELECT descendants.id, descendants.depth
  FROM descendants;
END;
$$;

-- 6. Add ancestor_topic_ids to retrieval_metrics for rollup analytics
ALTER TABLE retrieval_metrics
  ADD COLUMN IF NOT EXISTS ancestor_topic_ids UUID[] DEFAULT NULL;

-- 7. Security
REVOKE ALL ON FUNCTION private.get_topic_ancestors(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_topic_ancestors(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION private.get_topic_descendants(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_topic_descendants(UUID, UUID) TO service_role;
