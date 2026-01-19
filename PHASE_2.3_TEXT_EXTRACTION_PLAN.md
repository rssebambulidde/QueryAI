# Phase 2.3: Text Extraction - Implementation Plan

## Overview

**Goal:** Extract text content from uploaded documents (PDF, DOCX, TXT, MD) and store it in the database for future embedding generation and RAG implementation.

**Status:** Planning Phase  
**Dependencies:** Phase 2.2 (Document Upload System) ✅  
**Next Phase:** 2.4 (Embedding Generation)

---

## Objectives

1. ✅ Extract text from PDF files
2. ✅ Extract text from DOCX files  
3. ✅ Handle TXT and MD files (already text-based)
4. ✅ Store extracted text in database
5. ✅ Handle extraction errors gracefully
6. ✅ Track extraction status per document
7. ✅ Support async processing for large files

---

## Technical Approach

### Libraries to Use

1. **PDF Extraction**: `pdf-parse` (lightweight, pure JavaScript)
   - No external dependencies
   - Works well with Buffer input
   - Handles most PDF formats

2. **DOCX Extraction**: `mammoth` (converts DOCX to HTML/Markdown)
   - Preserves formatting
   - Can extract plain text or formatted text
   - Good error handling

3. **TXT/MD Files**: Direct Buffer-to-string conversion
   - Already text-based, minimal processing needed

### Alternative Considerations

- **PDF.js** (Mozilla): More robust but heavier, browser-focused
- **docx** library: Alternative DOCX parser, more control but more complex
- **OCR (Tesseract.js)**: For Phase 2.3 - marked as optional, can be added later

---

## Database Schema Changes

### New Migration: `003_documents_text_extraction.sql`

```sql
-- Documents table (extends existing schema from ARCHITECTURE.md)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_type TEXT NOT NULL, -- pdf, docx, txt, md
    file_size INTEGER NOT NULL,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'extracted', 'failed')),
    extracted_text TEXT, -- Full extracted text content
    text_length INTEGER, -- Character count of extracted text
    extraction_error TEXT, -- Error message if extraction failed
    metadata JSONB DEFAULT '{}', -- Additional metadata (page count, word count, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_topic_id ON documents(topic_id);

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

-- Indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_id ON document_chunks(embedding_id) WHERE embedding_id IS NOT NULL;
```

### TypeScript Types

Update `backend/src/types/database.ts`:

```typescript
export interface Document {
  id: string;
  user_id: string;
  topic_id?: string;
  filename: string;
  file_path: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'md';
  file_size: number;
  status: 'processing' | 'extracted' | 'failed';
  extracted_text?: string;
  text_length?: number;
  extraction_error?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  start_char?: number;
  end_char?: number;
  token_count?: number;
  embedding_id?: string;
  created_at: string;
}
```

---

## Service Implementation

### New Service: `backend/src/services/extraction.service.ts`

**Responsibilities:**
- Extract text from different file types
- Handle extraction errors
- Validate extracted text quality
- Calculate text statistics (length, word count, etc.)

**Key Methods:**

```typescript
export class ExtractionService {
  /**
   * Extract text from a document buffer
   */
  static async extractText(
    buffer: Buffer,
    fileType: 'pdf' | 'docx' | 'txt' | 'md',
    fileName: string
  ): Promise<ExtractionResult>

  /**
   * Extract text from PDF
   */
  private static async extractFromPDF(buffer: Buffer): Promise<string>

  /**
   * Extract text from DOCX
   */
  private static async extractFromDOCX(buffer: Buffer): Promise<string>

  /**
   * Extract text from TXT/MD
   */
  private static async extractFromText(buffer: Buffer): Promise<string>

  /**
   * Validate and clean extracted text
   */
  private static cleanText(text: string): string

  /**
   * Calculate text statistics
   */
  private static calculateStats(text: string): TextStats
}
```

**Interfaces:**

```typescript
export interface ExtractionResult {
  text: string;
  stats: {
    length: number;
    wordCount: number;
    pageCount?: number; // For PDFs
    paragraphCount?: number;
  };
  metadata?: Record<string, any>;
}

export interface TextStats {
  length: number;
  wordCount: number;
  pageCount?: number;
  paragraphCount?: number;
}
```

---

## API Endpoints

### Update Existing Endpoints

#### 1. `POST /api/documents/upload` (Modified)
- Upload file to storage
- Create document record with status='processing'
- Trigger async text extraction
- Return document with status

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": "uuid",
    "path": "user_id/timestamp-filename.pdf",
    "name": "filename.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "status": "processing",
    "createdAt": "2025-01-18T..."
  }
}
```

#### 2. New: `POST /api/documents/:id/extract` (Optional - Manual Trigger)
- Manually trigger text extraction for a document
- Useful for retrying failed extractions

#### 3. New: `GET /api/documents/:id/text`
- Get extracted text for a document
- Only return if status='extracted'
- Include text statistics

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "text": "Full extracted text...",
    "stats": {
      "length": 5000,
      "wordCount": 800,
      "pageCount": 3
    },
    "extractedAt": "2025-01-18T..."
  }
}
```

#### 4. Update: `GET /api/documents` (Modified)
- Include extraction status in document list
- Include text_length if extracted
- Filter by status (optional query param)

---

## Processing Flow

### Automatic Extraction (Recommended)

```
1. User uploads document
   ↓
2. File saved to Supabase Storage
   ↓
3. Document record created (status='processing')
   ↓
4. Background job triggered (async)
   ↓
5. Download file buffer from storage
   ↓
6. Extract text based on file type
   ↓
7. Validate and clean text
   ↓
8. Update document record:
   - extracted_text = text
   - text_length = text.length
   - status = 'extracted' or 'failed'
   - metadata = stats
   ↓
9. Log success/error
```

### Error Handling

- **Extraction failures**: Set status='failed', store error message
- **Empty text**: Mark as failed with "No text content found"
- **Large files**: Implement timeout (e.g., 60 seconds)
- **Memory issues**: Stream processing for very large files (future optimization)

---

## Implementation Steps

### Step 1: Install Dependencies
```bash
cd backend
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

### Step 2: Create Database Migration
- Create `003_documents_text_extraction.sql`
- Run migration in Supabase SQL Editor
- Verify tables created

### Step 3: Update Type Definitions
- Add `Document` and `DocumentChunk` interfaces to `database.ts`
- Export types

### Step 4: Create Extraction Service
- Implement `ExtractionService` class
- Add extraction methods for each file type
- Add text cleaning and validation
- Add error handling

### Step 5: Create Database Service
- Create `DocumentService` for database operations
- Methods: `createDocument`, `updateDocument`, `getDocument`, `getDocumentText`
- Use Supabase client

### Step 6: Update Upload Endpoint
- Modify `POST /api/documents/upload`
- Create document record after upload
- Trigger extraction (sync or async)
- Return document with status

### Step 7: Add New Endpoints
- `GET /api/documents/:id/text` - Get extracted text
- `POST /api/documents/:id/extract` - Manual extraction trigger

### Step 8: Update Document List Endpoint
- Include status and text_length in response
- Add optional status filter

### Step 9: Error Handling & Logging
- Add comprehensive error handling
- Log extraction attempts and results
- Add metrics tracking

### Step 10: Testing
- Unit tests for extraction service
- Integration tests for upload + extraction flow
- Test error scenarios (corrupted files, unsupported formats)
- Test large files

### Step 11: Frontend Updates (Optional for Phase 2.3)
- Show extraction status in document list
- Display text preview (if needed)
- Show extraction errors

---

## Configuration

### Environment Variables
No new environment variables needed for Phase 2.3.

### Limits & Constraints
- **Max text length**: 1,000,000 characters (~200,000 words)
- **Extraction timeout**: 60 seconds per file
- **Concurrent extractions**: 5 per user (future rate limiting)

---

## Error Scenarios & Handling

| Scenario | Handling |
|----------|----------|
| Corrupted PDF | Catch error, set status='failed', store error message |
| Password-protected PDF | Set status='failed', error: "Password-protected PDFs not supported" |
| Corrupted DOCX | Catch error, set status='failed', store error message |
| Empty file | Set status='failed', error: "File is empty" |
| No text content | Set status='failed', error: "No extractable text found" |
| Extraction timeout | Set status='failed', error: "Extraction timed out" |
| Memory error | Set status='failed', error: "File too large to process" |

---

## Testing Strategy

### Unit Tests
- `extraction.service.test.ts`
  - Test PDF extraction with sample PDF
  - Test DOCX extraction with sample DOCX
  - Test TXT/MD extraction
  - Test error handling (corrupted files)
  - Test text cleaning
  - Test statistics calculation

### Integration Tests
- `documents.routes.test.ts`
  - Test upload → extraction flow
  - Test status updates
  - Test error responses
  - Test text retrieval endpoint

### Manual Testing Checklist
- [ ] Upload PDF → verify text extracted
- [ ] Upload DOCX → verify text extracted
- [ ] Upload TXT → verify text extracted
- [ ] Upload MD → verify text extracted
- [ ] Upload corrupted file → verify error handling
- [ ] Upload large file → verify timeout handling
- [ ] Check database records → verify data stored correctly

---

## Future Enhancements (Post Phase 2.3)

1. **Async Processing Queue**: Use Bull/BullMQ for background jobs
2. **OCR Support**: Add Tesseract.js for image-based PDFs
3. **Incremental Extraction**: Extract text in chunks for very large files
4. **Formatting Preservation**: Store formatted text (HTML/Markdown) alongside plain text
5. **Extraction Caching**: Cache extraction results to avoid re-processing
6. **Progress Tracking**: Real-time extraction progress updates

---

## Dependencies

### New npm Packages
- `pdf-parse`: ^1.1.1
- `mammoth`: ^1.6.0
- `@types/pdf-parse`: ^1.1.4 (dev)

### Existing Dependencies
- `@supabase/supabase-js`: Already installed
- `express`: Already installed
- `multer`: Already installed

---

## Success Criteria

✅ **Phase 2.3 Complete When:**
1. PDF files can be uploaded and text extracted
2. DOCX files can be uploaded and text extracted
3. TXT/MD files can be uploaded and text extracted
4. Extracted text is stored in database
5. Extraction status is tracked (processing/extracted/failed)
6. Errors are handled gracefully
7. All tests pass
8. Documentation updated

---

## Timeline Estimate

- **Step 1-3** (Setup): 1-2 hours
- **Step 4** (Extraction Service): 3-4 hours
- **Step 5** (Database Service): 2-3 hours
- **Step 6-8** (API Endpoints): 3-4 hours
- **Step 9** (Error Handling): 2 hours
- **Step 10** (Testing): 3-4 hours
- **Step 11** (Frontend - Optional): 2-3 hours

**Total Estimate:** 16-22 hours (2-3 days)

---

## Notes

- Text extraction is synchronous in Phase 2.3 (can be made async later)
- OCR for images is optional and can be added in a future phase
- Chunking will be implemented in Phase 2.4 (Embedding Generation)
- Large file handling can be optimized in future phases

---

**Last Updated:** 2025-01-18  
**Status:** Ready for Implementation
