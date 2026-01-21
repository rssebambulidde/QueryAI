-- Add metadata field to conversations table for storing filter settings and other conversation-specific data
-- Migration: 006_add_conversation_metadata.sql

-- Add metadata column if it doesn't exist
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on metadata for better query performance (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_conversations_metadata ON conversations USING GIN (metadata);

-- Add comment
COMMENT ON COLUMN conversations.metadata IS 'Stores conversation-specific settings like search filters (topic, timeRange, country, etc.)';
