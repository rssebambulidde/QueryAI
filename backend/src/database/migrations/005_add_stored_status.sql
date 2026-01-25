-- Migration: Add 'stored' status to documents table
-- This allows documents to be uploaded without auto-processing
-- Run this migration to add the 'stored' status option

-- Update status constraint to include 'stored'
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents
ADD CONSTRAINT documents_status_check
CHECK (status IN ('stored', 'processing', 'extracted', 'failed', 'embedding', 'embedded', 'embedding_failed', 'processed'));

-- Update default status to 'stored' for new documents
ALTER TABLE documents
ALTER COLUMN status SET DEFAULT 'stored';

-- Update any existing documents with 'processing' status that don't have extracted_text to 'stored'
UPDATE documents
SET status = 'stored'
WHERE status = 'processing' 
  AND (extracted_text IS NULL OR extracted_text = '');
