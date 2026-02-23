-- Migration 045: Public schema wrappers for ALL remaining private-schema RPCs
-- PostgREST (used by the Supabase JS client) only exposes the public schema.
-- .schema('private').rpc() silently fails. These SECURITY DEFINER wrappers
-- in public call the same underlying tables with service_role-only access.
--
-- Covers RPCs from migrations: 036, 037, 038, 039, 040, 042, 043

-- ═══════════════════════════════════════════════════════════════════════
-- 036: save_message_pair
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_message_pair(
  p_conversation_id UUID,
  p_user_content    TEXT,
  p_assistant_content TEXT,
  p_sources         JSONB DEFAULT NULL,
  p_metadata        JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_msg messages%ROWTYPE;
  v_asst_msg messages%ROWTYPE;
BEGIN
  INSERT INTO messages (conversation_id, role, content)
  VALUES (p_conversation_id, 'user', p_user_content)
  RETURNING * INTO v_user_msg;

  INSERT INTO messages (conversation_id, role, content, sources, metadata)
  VALUES (p_conversation_id, 'assistant', p_assistant_content, p_sources, p_metadata)
  RETURNING * INTO v_asst_msg;

  UPDATE conversations SET updated_at = NOW() WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'userMessage', jsonb_build_object(
      'id',              v_user_msg.id,
      'conversation_id', v_user_msg.conversation_id,
      'role',            v_user_msg.role,
      'content',         v_user_msg.content,
      'sources',         v_user_msg.sources,
      'metadata',        v_user_msg.metadata,
      'created_at',      v_user_msg.created_at
    ),
    'assistantMessage', jsonb_build_object(
      'id',              v_asst_msg.id,
      'conversation_id', v_asst_msg.conversation_id,
      'role',            v_asst_msg.role,
      'content',         v_asst_msg.content,
      'sources',         v_asst_msg.sources,
      'metadata',        v_asst_msg.metadata,
      'created_at',      v_asst_msg.created_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_message_pair FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_message_pair FROM anon;
REVOKE ALL ON FUNCTION public.save_message_pair FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_message_pair TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 037: get_conversations_with_metadata
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_conversations_with_metadata(
  p_user_id UUID,
  p_limit   INT DEFAULT 50,
  p_offset  INT DEFAULT 0
) RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  topic_id        UUID,
  title           TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  message_count   BIGINT,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.user_id, c.topic_id, c.title, c.metadata,
    c.created_at, c.updated_at,
    COALESCE(m_agg.cnt, 0) AS message_count,
    LEFT(m_last.content, 100) AS last_message,
    m_last.created_at AS last_message_at
  FROM conversations c
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM messages m WHERE m.conversation_id = c.id
  ) m_agg ON true
  LEFT JOIN LATERAL (
    SELECT m2.content, m2.created_at FROM messages m2
    WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1
  ) m_last ON true
  WHERE c.user_id = p_user_id
  ORDER BY c.updated_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conversations_with_metadata FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_conversations_with_metadata FROM anon;
REVOKE ALL ON FUNCTION public.get_conversations_with_metadata FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversations_with_metadata TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 038: get_evaluation_aggregates
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_evaluation_aggregates(
  p_days     integer DEFAULT 30,
  p_group_by text    DEFAULT 'day'
) RETURNS TABLE (
  period                text,
  evaluation_count      bigint,
  avg_faithfulness      numeric,
  avg_relevance         numeric,
  avg_citation_accuracy numeric,
  avg_overall           numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_group_by
      WHEN 'week'  THEN to_char(date_trunc('week',  ae.created_at), 'YYYY-"W"IW')
      WHEN 'month' THEN to_char(date_trunc('month', ae.created_at), 'YYYY-MM')
      ELSE to_char(ae.created_at::date, 'YYYY-MM-DD')
    END AS period,
    count(*)::bigint AS evaluation_count,
    round(avg(ae.faithfulness)::numeric, 2) AS avg_faithfulness,
    round(avg(ae.relevance)::numeric, 2) AS avg_relevance,
    round(avg(ae.citation_accuracy)::numeric, 2) AS avg_citation_accuracy,
    round(((avg(ae.faithfulness) + avg(ae.relevance) + avg(ae.citation_accuracy)) / 3.0)::numeric, 2) AS avg_overall
  FROM public.answer_evaluations ae
  WHERE ae.created_at >= (now() - (p_days || ' days')::interval)
  GROUP BY 1 ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_evaluation_aggregates FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_evaluation_aggregates FROM anon;
REVOKE ALL ON FUNCTION public.get_evaluation_aggregates FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_evaluation_aggregates TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 039: get_message_versions
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_message_versions(p_message_id uuid)
RETURNS SETOF public.messages
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE root AS (
    SELECT m.* FROM public.messages m WHERE m.id = p_message_id
    UNION ALL
    SELECT p.* FROM public.messages p JOIN root r ON r.parent_message_id = p.id
  ),
  root_id AS (
    SELECT id FROM root WHERE parent_message_id IS NULL LIMIT 1
  )
  SELECT m.* FROM public.messages m, root_id
  WHERE m.id = root_id.id OR m.parent_message_id = root_id.id
  ORDER BY m.version ASC;
$$;

REVOKE ALL ON FUNCTION public.get_message_versions FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_message_versions FROM anon;
REVOKE ALL ON FUNCTION public.get_message_versions FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_message_versions TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 040: citation click RPCs
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_citation_click(
  p_user_id       uuid,
  p_conversation_id uuid,
  p_message_id    uuid,
  p_source_index  smallint,
  p_source_url    text,
  p_source_domain text,
  p_source_type   text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO citation_clicks (user_id, conversation_id, message_id, source_index, source_url, source_domain, source_type)
  VALUES (p_user_id, p_conversation_id, p_message_id, p_source_index, p_source_url, p_source_domain, p_source_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_citation_click FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_citation_click FROM anon;
REVOKE ALL ON FUNCTION public.record_citation_click FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_citation_click TO service_role;

CREATE OR REPLACE FUNCTION public.get_citation_click_stats(p_days integer DEFAULT 30)
RETURNS TABLE (
  total_clicks      bigint,
  unique_users      bigint,
  clicks_by_type    jsonb,
  top_domains       jsonb,
  avg_clicks_per_msg numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_since timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM citation_clicks WHERE clicked_at >= v_since)::bigint,
    (SELECT count(DISTINCT user_id) FROM citation_clicks WHERE clicked_at >= v_since)::bigint,
    (SELECT coalesce(jsonb_object_agg(source_type, cnt), '{}'::jsonb)
     FROM (SELECT source_type, count(*) AS cnt FROM citation_clicks WHERE clicked_at >= v_since GROUP BY source_type) t),
    (SELECT coalesce(jsonb_agg(row_to_json(d) ORDER BY d.clicks DESC), '[]'::jsonb)
     FROM (SELECT source_domain AS domain, count(*) AS clicks, count(DISTINCT user_id) AS unique_users
           FROM citation_clicks WHERE clicked_at >= v_since AND source_domain IS NOT NULL
           GROUP BY source_domain ORDER BY count(*) DESC LIMIT 25) d),
    (SELECT coalesce(round(count(*)::numeric / nullif(count(DISTINCT message_id), 0), 2), 0)
     FROM citation_clicks WHERE clicked_at >= v_since);
END;
$$;

REVOKE ALL ON FUNCTION public.get_citation_click_stats FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_citation_click_stats FROM anon;
REVOKE ALL ON FUNCTION public.get_citation_click_stats FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_citation_click_stats TO service_role;

CREATE OR REPLACE FUNCTION public.get_domain_click_through_rates(p_days integer DEFAULT 30)
RETURNS TABLE (
  domain             text,
  total_cited        bigint,
  total_clicked      bigint,
  click_through_rate numeric,
  unique_clickers    bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_since timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  RETURN QUERY
  SELECT cc.source_domain AS domain,
    count(*)::bigint AS total_cited,
    count(*)::bigint AS total_clicked,
    1.0::numeric AS click_through_rate,
    count(DISTINCT cc.user_id)::bigint AS unique_clickers
  FROM citation_clicks cc
  WHERE cc.clicked_at >= v_since AND cc.source_domain IS NOT NULL
  GROUP BY cc.source_domain ORDER BY count(*) DESC LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.get_domain_click_through_rates FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_domain_click_through_rates FROM anon;
REVOKE ALL ON FUNCTION public.get_domain_click_through_rates FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_click_through_rates TO service_role;

CREATE OR REPLACE FUNCTION public.get_domain_click_boost_scores(p_days integer DEFAULT 90)
RETURNS TABLE (
  domain      text,
  click_count bigint,
  boost_score numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - (p_days || ' days')::interval;
  v_max   bigint;
BEGIN
  SELECT max(cnt) INTO v_max
  FROM (SELECT count(*) AS cnt FROM citation_clicks
        WHERE clicked_at >= v_since AND source_domain IS NOT NULL
        GROUP BY source_domain) sub;

  IF v_max IS NULL OR v_max = 0 THEN RETURN; END IF;

  RETURN QUERY
  SELECT cc.source_domain AS domain,
    count(*)::bigint AS click_count,
    round(count(*)::numeric / v_max, 4) AS boost_score
  FROM citation_clicks cc
  WHERE cc.clicked_at >= v_since AND cc.source_domain IS NOT NULL
  GROUP BY cc.source_domain ORDER BY count(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_domain_click_boost_scores FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_domain_click_boost_scores FROM anon;
REVOKE ALL ON FUNCTION public.get_domain_click_boost_scores FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_click_boost_scores TO service_role;

-- ═══════════════════════════════════════════════════════════════════════
-- 042: feedback RPCs
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.upsert_message_feedback(
  p_user_id           uuid,
  p_message_id        uuid,
  p_conversation_id   uuid DEFAULT NULL,
  p_rating            smallint DEFAULT 1,
  p_comment           text DEFAULT NULL,
  p_flagged_citations jsonb DEFAULT '[]'::jsonb,
  p_model             text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO message_feedback (
    user_id, message_id, conversation_id,
    rating, comment, flagged_citations, model
  ) VALUES (
    p_user_id, p_message_id, p_conversation_id,
    p_rating, p_comment, p_flagged_citations, p_model
  )
  ON CONFLICT (user_id, message_id) DO UPDATE SET
    rating            = EXCLUDED.rating,
    comment           = EXCLUDED.comment,
    flagged_citations = EXCLUDED.flagged_citations,
    created_at        = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_message_feedback FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_message_feedback FROM anon;
REVOKE ALL ON FUNCTION public.upsert_message_feedback FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_message_feedback TO service_role;

CREATE OR REPLACE FUNCTION public.get_feedback_analytics(
  p_days     int  DEFAULT 30,
  p_group_by text DEFAULT 'day'
) RETURNS TABLE (
  period         text,
  total_feedback bigint,
  thumbs_up      bigint,
  thumbs_down    bigint,
  flagged_count  bigint,
  avg_rating     numeric
)
LANGUAGE plpgsql SECURITY DEFINER
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
  GROUP BY 1 ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_feedback_analytics FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_feedback_analytics FROM anon;
REVOKE ALL ON FUNCTION public.get_feedback_analytics FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_feedback_analytics TO service_role;

CREATE OR REPLACE FUNCTION public.get_feedback_by_model(p_days int DEFAULT 30)
RETURNS TABLE (
  model          text,
  total_feedback bigint,
  thumbs_up      bigint,
  thumbs_down    bigint,
  flagged_count  bigint,
  approval_rate  numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT coalesce(mf.model, 'unknown') AS model,
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
  GROUP BY 1 ORDER BY total_feedback DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_feedback_by_model FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_feedback_by_model FROM anon;
REVOKE ALL ON FUNCTION public.get_feedback_by_model FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_feedback_by_model TO service_role;
