-- Migration 041: Cross-conversation citation tracking
-- Tracks every source (URL / documentId) cited across all conversations.
-- Enables: "My Sources" panel, source explorer, per-topic most-relied-on sources.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. cited_sources table
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cited_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url      text,                         -- full URL for web sources
  source_type     text NOT NULL CHECK (source_type IN ('document', 'web')),
  document_id     uuid,                         -- FK for document sources (nullable)
  source_title    text NOT NULL DEFAULT '',
  source_domain   text,                         -- extracted domain for grouping
  first_cited_at  timestamptz NOT NULL DEFAULT now(),
  last_cited_at   timestamptz NOT NULL DEFAULT now(),
  citation_count  integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, source_url, document_id)     -- one row per user+source combo
);

-- Indexes for common query patterns
CREATE INDEX idx_cited_sources_user_id       ON cited_sources (user_id);
CREATE INDEX idx_cited_sources_source_type   ON cited_sources (source_type);
CREATE INDEX idx_cited_sources_document_id   ON cited_sources (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_cited_sources_citation_count ON cited_sources (citation_count DESC);
CREATE INDEX idx_cited_sources_last_cited    ON cited_sources (last_cited_at DESC);
CREATE INDEX idx_cited_sources_domain        ON cited_sources (source_domain) WHERE source_domain IS NOT NULL;

-- RLS
ALTER TABLE cited_sources ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. cited_source_conversations junction table
--    Links a cited_source to the conversations where it was cited.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cited_source_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cited_source_id   uuid NOT NULL REFERENCES cited_sources(id) ON DELETE CASCADE,
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id        uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  snippet           text,                       -- context snippet from the message
  topic_id          uuid REFERENCES topics(id) ON DELETE SET NULL,
  cited_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cited_source_id, message_id)          -- one row per source+message
);

CREATE INDEX idx_csc_cited_source_id   ON cited_source_conversations (cited_source_id);
CREATE INDEX idx_csc_conversation_id   ON cited_source_conversations (conversation_id);
CREATE INDEX idx_csc_topic_id          ON cited_source_conversations (topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX idx_csc_cited_at          ON cited_source_conversations (cited_at DESC);

ALTER TABLE cited_source_conversations ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. RPC: private.upsert_cited_source
--    Upserts a cited_source row and inserts the junction record.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.upsert_cited_source(
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
  -- Upsert the cited_source row
  INSERT INTO cited_sources (user_id, source_url, source_type, document_id, source_title, source_domain)
  VALUES (p_user_id, p_source_url, p_source_type, p_document_id, p_source_title, p_source_domain)
  ON CONFLICT (user_id, source_url, document_id) DO UPDATE SET
    citation_count = cited_sources.citation_count + 1,
    last_cited_at  = now(),
    source_title   = COALESCE(NULLIF(p_source_title, ''), cited_sources.source_title)
  RETURNING id INTO v_cited_source_id;

  -- Insert the conversation junction (ignore if duplicate)
  INSERT INTO cited_source_conversations (cited_source_id, conversation_id, message_id, snippet, topic_id)
  VALUES (v_cited_source_id, p_conversation_id, p_message_id, p_snippet, p_topic_id)
  ON CONFLICT (cited_source_id, message_id) DO NOTHING;

  RETURN v_cited_source_id;
END;
$$;

REVOKE ALL ON FUNCTION private.upsert_cited_source FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.upsert_cited_source TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 4. RPC: private.get_user_cited_sources
--    Returns user's most-cited sources with optional topic + date filter.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_user_cited_sources(
  p_user_id    uuid,
  p_topic_id   uuid    DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date   timestamptz DEFAULT NULL,
  p_limit      integer DEFAULT 50,
  p_offset     integer DEFAULT 0
) RETURNS TABLE (
  id             uuid,
  source_url     text,
  source_type    text,
  document_id    uuid,
  source_title   text,
  source_domain  text,
  first_cited_at timestamptz,
  last_cited_at  timestamptz,
  citation_count integer,
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
    AND (p_topic_id IS NULL OR csc.topic_id = p_topic_id)
    AND (p_start_date IS NULL OR cs.last_cited_at >= p_start_date)
    AND (p_end_date IS NULL OR cs.last_cited_at <= p_end_date)
  GROUP BY cs.id
  ORDER BY cs.citation_count DESC, cs.last_cited_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION private.get_user_cited_sources FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_cited_sources TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 5. RPC: private.get_source_conversations
--    Returns all conversations where a specific source was cited.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_source_conversations(
  p_user_id         uuid,
  p_cited_source_id uuid,
  p_limit           integer DEFAULT 50,
  p_offset          integer DEFAULT 0
) RETURNS TABLE (
  conversation_id   uuid,
  conversation_title text,
  message_id        uuid,
  snippet           text,
  topic_id          uuid,
  topic_name        text,
  cited_at          timestamptz
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
  JOIN conversations c ON c.id = csc.conversation_id
  LEFT JOIN topics t ON t.id = csc.topic_id
  WHERE cs.user_id = p_user_id
    AND csc.cited_source_id = p_cited_source_id
  ORDER BY csc.cited_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION private.get_source_conversations FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_source_conversations TO service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 6. RPC: private.get_topic_cited_sources
--    Returns the most-cited sources for a specific topic.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.get_topic_cited_sources(
  p_user_id  uuid,
  p_topic_id uuid,
  p_limit    integer DEFAULT 20
) RETURNS TABLE (
  id              uuid,
  source_url      text,
  source_type     text,
  document_id     uuid,
  source_title    text,
  source_domain   text,
  topic_citation_count bigint,
  total_citation_count integer
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

REVOKE ALL ON FUNCTION private.get_topic_cited_sources FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_topic_cited_sources TO service_role;
