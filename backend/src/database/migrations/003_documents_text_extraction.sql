-- Documents and Text Extraction Schema
-- Phase 2.3: Text Extraction
-- Run this in Supabase SQL Editor after 001_initial_schema.sql and 002_row_level_security.sql

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'md')),
    file_size INTEGER NOT NULL,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'extracted', 'failed')),
    extracted_text TEXT, -- Full extracted text content
    text_length INTEGER, -- Character count of extracted text
    extraction_error TEXT, -- Error message if extraction failed
    metadata JSONB DEFAULT '{}', -- Additional metadata (page count, word count, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Chunks table (for future Phase 2.4 - Embedding Generation)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    start_char INTEGER, -- Character position in original text
    end_char INTEGER, -- Character position in original text
    token_count INTEGER, -- Approximate token count
    embedding_id TEXT, -- Reference to Pinecone ID (Phase 2.5)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_topic_id ON documents(topic_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_id ON document_chunks(embedding_id) WHERE embedding_id IS NOT NULL;

-- Add updated_at trigger for documents
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security for documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Documents Policies
-- Users can view their own documents
CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own documents
CREATE POLICY "Users can create own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to documents"
    ON documents FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Document Chunks Policies
-- Users can view chunks of their own documents
CREATE POLICY "Users can view chunks of own documents"
    ON document_chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = document_chunks.document_id
            AND documents.user_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to document_chunks"
    ON document_chunks FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
