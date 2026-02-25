-- Migration 037: Create chat_attachments table
-- Stores uploaded chat attachments with extracted text so follow-up messages
-- only need to send a fileId reference instead of the full base64 payload.

CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT, -- path in Supabase Storage (nullable if storage disabled)
  extracted_text TEXT, -- pre-extracted text content (nullable for images)
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'success', 'truncated', 'failed')),
  extraction_chars INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_attachments_user_id ON public.chat_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_conversation_id ON public.chat_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_created_at ON public.chat_attachments(created_at);

-- RLS
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- Users can only access their own attachments
CREATE POLICY chat_attachments_select_own ON public.chat_attachments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY chat_attachments_insert_own ON public.chat_attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY chat_attachments_delete_own ON public.chat_attachments
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass (supabaseAdmin uses service role key)
CREATE POLICY chat_attachments_service_all ON public.chat_attachments
  FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT SELECT, INSERT, DELETE ON public.chat_attachments TO authenticated;
GRANT ALL ON public.chat_attachments TO service_role;

COMMENT ON TABLE public.chat_attachments IS 'Stores uploaded chat attachments with pre-extracted text for efficient follow-up references';
COMMENT ON COLUMN public.chat_attachments.storage_path IS 'Path in Supabase Storage bucket (chat-attachments/{user_id}/{id}.ext)';
COMMENT ON COLUMN public.chat_attachments.extracted_text IS 'Pre-extracted text content from the document, used for AI context without re-processing';
