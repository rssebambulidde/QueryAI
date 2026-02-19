-- 039_message_versioning.sql
-- Add version tracking columns to messages table for regeneration history.

-- 1. Add columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS version          integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_message_id uuid    REFERENCES public.messages(id) ON DELETE SET NULL;

-- 2. Index for looking up all versions of a message
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id
  ON public.messages (parent_message_id)
  WHERE parent_message_id IS NOT NULL;

-- 3. Index for ordering versions
CREATE INDEX IF NOT EXISTS idx_messages_version
  ON public.messages (parent_message_id, version);

-- 4. RPC: get all versions of a message (returns the root + all children)
CREATE OR REPLACE FUNCTION private.get_message_versions(p_message_id uuid)
RETURNS SETOF public.messages
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Find the root message (either it IS the root, or follow parent_message_id)
  WITH RECURSIVE root AS (
    SELECT m.*
    FROM public.messages m
    WHERE m.id = p_message_id
    UNION ALL
    SELECT p.*
    FROM public.messages p
    JOIN root r ON r.parent_message_id = p.id
  ),
  root_id AS (
    SELECT id FROM root WHERE parent_message_id IS NULL
    LIMIT 1
  )
  SELECT m.*
  FROM public.messages m, root_id
  WHERE m.id = root_id.id
     OR m.parent_message_id = root_id.id
  ORDER BY m.version ASC;
$$;

-- 5. RPC: get regeneration quality analytics (compares evaluations across versions)
CREATE OR REPLACE FUNCTION private.get_regeneration_quality_stats(
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  total_regenerations   bigint,
  avg_version_count     numeric,
  quality_improved      bigint,
  quality_unchanged     bigint,
  quality_declined      bigint,
  avg_quality_delta     numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH versioned AS (
    -- Messages that are regenerations (have a parent)
    SELECT
      m.id,
      m.parent_message_id,
      m.version,
      m.created_at,
      (m.metadata->>'qualityScore')::numeric AS quality_score
    FROM public.messages m
    WHERE m.parent_message_id IS NOT NULL
      AND m.created_at >= NOW() - (p_days || ' days')::interval
  ),
  with_parent_score AS (
    SELECT
      v.id,
      v.parent_message_id,
      v.version,
      v.quality_score,
      (pm.metadata->>'qualityScore')::numeric AS parent_quality_score
    FROM versioned v
    JOIN public.messages pm ON pm.id = v.parent_message_id
  ),
  compared AS (
    SELECT
      *,
      CASE
        WHEN quality_score IS NOT NULL AND parent_quality_score IS NOT NULL THEN
          quality_score - parent_quality_score
        ELSE NULL
      END AS delta
    FROM with_parent_score
  )
  SELECT
    COUNT(*)::bigint AS total_regenerations,
    (SELECT AVG(vc) FROM (
      SELECT COUNT(*)::numeric AS vc
      FROM public.messages
      WHERE parent_message_id IS NOT NULL
        AND created_at >= NOW() - (p_days || ' days')::interval
      GROUP BY parent_message_id
    ) sub) AS avg_version_count,
    COUNT(*) FILTER (WHERE delta > 0)::bigint  AS quality_improved,
    COUNT(*) FILTER (WHERE delta = 0)::bigint  AS quality_unchanged,
    COUNT(*) FILTER (WHERE delta < 0)::bigint  AS quality_declined,
    AVG(delta) AS avg_quality_delta
  FROM compared;
$$;

-- 6. Security
REVOKE ALL ON FUNCTION private.get_message_versions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_message_versions(uuid) TO service_role;

REVOKE ALL ON FUNCTION private.get_regeneration_quality_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_regeneration_quality_stats(integer) TO service_role;
