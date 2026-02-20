-- Migration 044: Public schema wrappers for cited-source RPCs
-- The original RPCs in the private schema cannot be reached via PostgREST /
-- supabaseAdmin.schema('private').rpc() because PostgREST only exposes public
-- by default. These SECURITY DEFINER wrappers live in public and delegate to
-- the same underlying tables.

-- 1. get_user_cited_sources ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_cited_sources(
  p_user_id    uuid,
  p_topic_id   uuid    DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date   timestamptz DEFAULT NULL,
  p_limit      integer DEFAULT 50,
  p_offset     integer DEFAULT 0
) RETURNS TABLE (
  id                 uuid,
  source_url         text,
  source_type        text,
  document_id        uuid,
  source_title       text,
  source_domain      text,
  first_cited_at     timestamptz,
  last_cited_at      timestamptz,
  citation_count     integer,
  conversation_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.source_url,
    cs.source_type,
    cs.document_id,
    cs.source_title,
    cs.source_domain,
    cs.first_cited_at,
    cs.last_cited_at,
    cs.citation_count,
    COUNT(DISTINCT csc.conversation_id) AS conversation_count
  FROM cited_sources cs
  LEFT JOIN cited_source_conversations csc ON csc.cited_source_id = cs.id
  WHERE cs.user_id = p_user_id
    AND (p_topic_id IS NULL   OR csc.topic_id = p_topic_id)
    AND (p_start_date IS NULL OR csc.cited_at >= p_start_date)
    AND (p_end_date IS NULL   OR csc.cited_at <= p_end_date)
  GROUP BY cs.id
  ORDER BY cs.citation_count DESC, cs.last_cited_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_cited_sources FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_cited_sources FROM anon;
REVOKE ALL ON FUNCTION public.get_user_cited_sources FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_cited_sources TO service_role;

-- 2. get_source_conversations ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_source_conversations(
  p_user_id         uuid,
  p_cited_source_id uuid,
  p_limit           integer DEFAULT 50,
  p_offset          integer DEFAULT 0
) RETURNS TABLE (
  conversation_id    uuid,
  conversation_title text,
  message_id         uuid,
  snippet            text,
  topic_id           uuid,
  topic_name         text,
  cited_at           timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    csc.conversation_id,
    c.title AS conversation_title,
    csc.message_id,
    csc.snippet,
    csc.topic_id,
    t.name AS topic_name,
    csc.cited_at
  FROM cited_source_conversations csc
  JOIN cited_sources cs ON cs.id = csc.cited_source_id
  LEFT JOIN conversations c ON c.id = csc.conversation_id
  LEFT JOIN topics t ON t.id = csc.topic_id
  WHERE csc.cited_source_id = p_cited_source_id
    AND cs.user_id = p_user_id
  ORDER BY csc.cited_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_source_conversations FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_source_conversations FROM anon;
REVOKE ALL ON FUNCTION public.get_source_conversations FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_source_conversations TO service_role;

-- 3. get_topic_cited_sources ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_topic_cited_sources(
  p_user_id  uuid,
  p_topic_id uuid,
  p_limit    integer DEFAULT 20
) RETURNS TABLE (
  id                    uuid,
  source_url            text,
  source_type           text,
  document_id           uuid,
  source_title          text,
  source_domain         text,
  topic_citation_count  bigint,
  total_citation_count  integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.source_url,
    cs.source_type,
    cs.document_id,
    cs.source_title,
    cs.source_domain,
    COUNT(csc.id) AS topic_citation_count,
    cs.citation_count AS total_citation_count
  FROM cited_sources cs
  JOIN cited_source_conversations csc ON csc.cited_source_id = cs.id
  WHERE cs.user_id = p_user_id
    AND csc.topic_id = p_topic_id
  GROUP BY cs.id
  ORDER BY topic_citation_count DESC, cs.last_cited_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_topic_cited_sources FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_topic_cited_sources FROM anon;
REVOKE ALL ON FUNCTION public.get_topic_cited_sources FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_topic_cited_sources TO service_role;

-- 4. upsert_cited_source ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_cited_source(
  p_user_id         uuid,
  p_source_url      text,
  p_source_type     text,
  p_document_id     uuid,
  p_source_title    text,
  p_source_domain   text,
  p_conversation_id uuid,
  p_message_id      uuid,
  p_snippet         text,
  p_topic_id        uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cited_source_id uuid;
BEGIN
  INSERT INTO cited_sources (user_id, source_url, source_type, document_id, source_title, source_domain)
  VALUES (p_user_id, p_source_url, p_source_type, p_document_id, p_source_title, p_source_domain)
  ON CONFLICT (user_id, source_url, document_id) DO UPDATE SET
    citation_count = cited_sources.citation_count + 1,
    last_cited_at  = now(),
    source_title   = COALESCE(NULLIF(p_source_title, ''), cited_sources.source_title)
  RETURNING id INTO v_cited_source_id;

  INSERT INTO cited_source_conversations (cited_source_id, conversation_id, message_id, snippet, topic_id)
  VALUES (v_cited_source_id, p_conversation_id, p_message_id, p_snippet, p_topic_id)
  ON CONFLICT (cited_source_id, message_id) DO NOTHING;

  RETURN v_cited_source_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cited_source FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_cited_source FROM anon;
REVOKE ALL ON FUNCTION public.upsert_cited_source FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_cited_source TO service_role;
