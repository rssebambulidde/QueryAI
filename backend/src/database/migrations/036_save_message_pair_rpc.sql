-- Migration 036: Atomic save_message_pair RPC function
-- Lives in the 'private' schema so it is NOT exposed via PostgREST / Supabase
-- client SDKs.  Only reachable by the backend through the service_role client
-- which can call schema-qualified functions directly.

-- Ensure the private schema exists
CREATE SCHEMA IF NOT EXISTS private;

-- Drop the old public-schema version if it was previously deployed
DROP FUNCTION IF EXISTS public.save_message_pair(UUID, TEXT, TEXT, JSONB, JSONB);

CREATE OR REPLACE FUNCTION private.save_message_pair(
  p_conversation_id UUID,
  p_user_content    TEXT,
  p_assistant_content TEXT,
  p_sources         JSONB DEFAULT NULL,
  p_metadata        JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- so unqualified table names resolve to public.*
AS $$
DECLARE
  v_user_msg    messages%ROWTYPE;
  v_asst_msg    messages%ROWTYPE;
BEGIN
  -- Insert user message
  INSERT INTO messages (conversation_id, role, content)
  VALUES (p_conversation_id, 'user', p_user_content)
  RETURNING * INTO v_user_msg;

  -- Insert assistant message
  INSERT INTO messages (conversation_id, role, content, sources, metadata)
  VALUES (p_conversation_id, 'assistant', p_assistant_content, p_sources, p_metadata)
  RETURNING * INTO v_asst_msg;

  -- Update conversation timestamp
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;

  -- Return both messages as a JSON object
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

-- Restrict access: only service_role can execute.
REVOKE EXECUTE ON FUNCTION private.save_message_pair(UUID, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION private.save_message_pair(UUID, TEXT, TEXT, JSONB, JSONB) TO service_role;
