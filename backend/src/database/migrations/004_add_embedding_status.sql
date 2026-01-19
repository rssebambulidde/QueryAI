-- Migration: Add embedding status and error fields
-- Phase 2.4: Embedding Generation
-- Run this after 003_documents_text_extraction.sql

-- Add embedding_error column if it doesn't exist
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS embedding_error TEXT;

-- Update status constraint to include embedding statuses
-- Note: PostgreSQL doesn't support modifying CHECK constraints directly
-- We need to drop and recreate the constraint
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents 
ADD CONSTRAINT documents_status_check 
CHECK (status IN ('processing', 'extracted', 'failed', 'embedding', 'embedded', 'embedding_failed', 'processed'));

-- Add index for embedding status queries
CREATE INDEX IF NOT EXISTS idx_documents_embedding_status 
ON documents(status) 
WHERE status IN ('embedding', 'embedded', 'embedding_failed');

-- Add index for chunks with embeddings (for Phase 2.5)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_id 
ON document_chunks(embedding_id) 
WHERE embedding_id IS NOT NULL;
