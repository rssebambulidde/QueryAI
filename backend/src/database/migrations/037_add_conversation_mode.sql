-- Migration 037: Add conversation mode column
-- 'research' = web RAG + citations, 'chat' = general knowledge

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'research';
ALTER TABLE conversations ADD CONSTRAINT conversations_mode_check CHECK (mode IN ('research', 'chat'));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations (mode);
