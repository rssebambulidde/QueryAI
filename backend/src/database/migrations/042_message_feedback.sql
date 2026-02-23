-- Migration 042: User feedback loop — rate answers, flag bad citations
-- Stores thumbs-up/down ratings, optional free-text comments, and
-- flagged citation URLs per message. Enables admin analytics and
-- automatic routing of negative feedback to the LLM-as-judge pipeline.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. message_feedback table
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS message_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id        uuid NOT NULL,
  conversation_id   uuid REFERENCES conversations(id) ON DELETE SET NULL,
  rating            smallint NOT NULL CHECK (rating IN (-1, 1)),  -- thumbs down / up
  comment           text,
  flagged_citations jsonb DEFAULT '[]'::jsonb,  -- array of { sourceUrl, sourceTitle, reason? }
  model             text,                       -- which AI model produced the answer
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_message_feedback UNIQUE (user_id, message_id)
);

-- Indexes for admin analytics queries
CREATE INDEX IF NOT EXISTS idx_message_feedback_user      ON message_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_created   ON message_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_rating    ON message_feedback (rating);
CREATE INDEX IF NOT EXISTS idx_message_feedback_model     ON message_feedback (model)    WHERE model IS NOT NULL;

-- RLS: users can only manage their own feedback
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_feedback_user_policy ON message_feedback;
CREATE POLICY message_feedback_user_policy ON message_feedback
  FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. RPC: upsert_message_feedback  (insert or update)
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.upsert_message_feedback(
  p_user_id           uuid,
  p_message_id        uuid,
  p_conversation_id   uuid DEFAULT NULL,
  p_rating            smallint DEFAULT 1,
  p_comment           text DEFAULT NULL,
  p_flagged_citations jsonb DEFAULT '[]'::jsonb,
  p_model             text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO message_feedback (
    user_id, message_id, conversation_id,
    rating, comment, flagged_citations, model
  )
  VALUES (
    p_user_id, p_message_id, p_conversation_id,
    p_rating, p_comment, p_flagged_citations, p_model
  )
  ON CONFLICT (user_id, message_id)
  DO UPDATE SET
    rating            = EXCLUDED.rating,
    comment           = EXCLUDED.comment,
    flagged_citations = EXCLUDED.flagged_citations,
    created_at        = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.upsert_message_feedback FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.upsert_message_feedback TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. RPC: get_feedback_analytics  (admin aggregate)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_feedback_analytics(
  p_days      int DEFAULT 30,
  p_group_by  text DEFAULT 'day'   -- 'day' | 'week' | 'month'
)
RETURNS TABLE (
  period              text,
  total_feedback      bigint,
  thumbs_up           bigint,
  thumbs_down         bigint,
  flagged_count       bigint,
  avg_rating          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_group_by
      WHEN 'week'  THEN to_char(date_trunc('week',  mf.created_at), 'YYYY-MM-DD')
      WHEN 'month' THEN to_char(date_trunc('month', mf.created_at), 'YYYY-MM-DD')
      ELSE              to_char(date_trunc('day',    mf.created_at), 'YYYY-MM-DD')
    END AS period,
    count(*)::bigint AS total_feedback,
    count(*) FILTER (WHERE mf.rating = 1)::bigint  AS thumbs_up,
    count(*) FILTER (WHERE mf.rating = -1)::bigint AS thumbs_down,
    count(*) FILTER (WHERE jsonb_typeof(mf.flagged_citations) = 'array' AND jsonb_array_length(mf.flagged_citations) > 0)::bigint AS flagged_count,
    round(avg(mf.rating)::numeric, 3) AS avg_rating
  FROM message_feedback mf
  WHERE mf.created_at >= now() - make_interval(days => p_days)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION private.get_feedback_analytics FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_feedback_analytics TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RPC: get_feedback_by_model  (admin: breakdown per model)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_feedback_by_model(
  p_days int DEFAULT 30
)
RETURNS TABLE (
  model          text,
  total_feedback bigint,
  thumbs_up      bigint,
  thumbs_down    bigint,
  flagged_count  bigint,
  approval_rate  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    coalesce(mf.model, 'unknown') AS model,
    count(*)::bigint AS total_feedback,
    count(*) FILTER (WHERE mf.rating = 1)::bigint  AS thumbs_up,
    count(*) FILTER (WHERE mf.rating = -1)::bigint AS thumbs_down,
    count(*) FILTER (WHERE jsonb_typeof(mf.flagged_citations) = 'array' AND jsonb_array_length(mf.flagged_citations) > 0)::bigint AS flagged_count,
    CASE WHEN count(*) > 0
      THEN round(count(*) FILTER (WHERE mf.rating = 1)::numeric / count(*)::numeric * 100, 1)
      ELSE 0
    END AS approval_rate
  FROM message_feedback mf
  WHERE mf.created_at >= now() - make_interval(days => p_days)
  GROUP BY 1
  ORDER BY total_feedback DESC;
END;
$$;

REVOKE ALL ON FUNCTION private.get_feedback_by_model FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_feedback_by_model TO service_role;
