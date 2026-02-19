-- Migration 037: get_conversations_with_metadata RPC function
-- Replaces the N+1 pattern where each conversation triggers separate
-- message-count and last-message queries.  A single call now returns
-- all conversations for a user together with their metadata.
--
-- Lives in the 'private' schema (same as save_message_pair).

CREATE SCHEMA IF NOT EXISTS private;

DROP FUNCTION IF EXISTS private.get_conversations_with_metadata(UUID, INT, INT);

CREATE OR REPLACE FUNCTION private.get_conversations_with_metadata(
  p_user_id UUID,
  p_limit   INT DEFAULT 50,
  p_offset  INT DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  topic_id      UUID,
  title         TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ,
  message_count BIGINT,
  last_message  TEXT,
  last_message_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE                        -- read-only, safe for read replicas
SECURITY DEFINER
SET search_path = public      -- unqualified tables resolve to public.*
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.topic_id,
    c.title,
    c.metadata,
    c.created_at,
    c.updated_at,
    COALESCE(m_agg.cnt, 0)                     AS message_count,
    LEFT(m_last.content, 100)                   AS last_message,
    m_last.created_at                           AS last_message_at
  FROM conversations c
  -- Aggregate message count per conversation
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM messages m
    WHERE m.conversation_id = c.id
  ) m_agg ON true
  -- Fetch the most recent message
  LEFT JOIN LATERAL (
    SELECT m2.content, m2.created_at
    FROM messages m2
    WHERE m2.conversation_id = c.id
    ORDER BY m2.created_at DESC
    LIMIT 1
  ) m_last ON true
  WHERE c.user_id = p_user_id
  ORDER BY c.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Restrict access: only service_role can execute.
REVOKE EXECUTE ON FUNCTION private.get_conversations_with_metadata(UUID, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION private.get_conversations_with_metadata(UUID, INT, INT) TO service_role;
