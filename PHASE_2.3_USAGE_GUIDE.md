# Phase 2.3: Text Extraction - Usage Guide

## How Phase 2.3 Works

Phase 2.3 adds **automatic text extraction** from uploaded documents. Here's how it works:

### Automatic Flow

1. **Upload Document** → File saved to Supabase Storage
2. **Create Database Record** → Document record created with `status='processing'`
3. **Extract Text** → Text automatically extracted in background
4. **Update Status** → Document updated with:
   - `status='extracted'` (success) or `status='failed'` (error)
   - `extracted_text` - Full text content
   - `text_length` - Character count
   - `metadata` - Statistics (word count, page count, etc.)

### Supported File Types

- **PDF** - Text extracted from all pages
- **DOCX** - Text content extracted
- **TXT** - Direct text content
- **MD** - Markdown text content

---

## Accessing Phase 2.3 Features

### 1. Upload Documents (Automatic Extraction)

**Location**: Dashboard → "Your Documents" tab

**Steps**:
1. Click "Your Documents" in the left sidebar
2. Drag & drop a file or click "Choose File"
3. Click "Upload"
4. Text extraction starts automatically

**What Happens**:
- File uploads to Storage
- Document record created in database
- Text extraction runs in background
- Status updates automatically

### 2. View Document Status

Documents show their extraction status:
- **Processing** - Extraction in progress
- **Extracted** - Text successfully extracted
- **Failed** - Extraction failed (check error message)

### 3. Get Extracted Text

**API Endpoint**: `GET /api/documents/:id/text`

**Response**:
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

### 4. Retry Failed Extractions

**API Endpoint**: `POST /api/documents/:id/extract`

Manually trigger extraction for documents that failed.

### 5. Sync Legacy Documents

**API Endpoint**: `POST /api/documents/sync`

Migrate documents uploaded before Phase 2.3 to the database.

**What It Does**:
- Finds all documents in Storage
- Creates database records for documents not yet in database
- Skips documents that already exist

**Response**:
```json
{
  "success": true,
  "message": "Synced 5 document(s), skipped 2",
  "data": {
    "synced": 5,
    "skipped": 2,
    "total": 7
  }
}
```

---

## Fixing "Documents Not Loading" Issue

### Problem
Documents uploaded before Phase 2.3 are in Storage but not in the database, so they don't show up.

### Solution 1: Automatic Merge (Recommended)
The system now automatically merges Storage and database documents when listing. Your old documents should appear automatically.

### Solution 2: Manual Sync
If documents still don't appear, use the sync endpoint:

```bash
POST /api/documents/sync
Authorization: Bearer <your-token>
```

This will:
1. Find all documents in Storage
2. Create database records for missing ones
3. Enable text extraction for those documents

### Solution 3: Run Database Migration
To enable full Phase 2.3 features:

1. Go to Supabase SQL Editor
2. Run the migration:
   ```sql
   -- Copy contents from:
   -- backend/src/database/migrations/003_documents_text_extraction.sql
   ```
3. This creates the `documents` and `document_chunks` tables

---

## Document Status Meanings

| Status | Meaning | What to Do |
|--------|---------|------------|
| `processing` | Extraction in progress | Wait for completion |
| `extracted` | Text successfully extracted | Ready to use |
| `failed` | Extraction failed | Check `extraction_error`, retry if needed |

---

## Error Handling

### Common Errors

1. **"Documents table not found"**
   - **Cause**: Database migration not run
   - **Fix**: Run `003_documents_text_extraction.sql` migration

2. **"No extractable text found"**
   - **Cause**: File is empty or image-only PDF
   - **Fix**: Upload a file with actual text content

3. **"Password-protected PDFs are not supported"**
   - **Cause**: PDF requires password
   - **Fix**: Remove password or convert to regular PDF

4. **"Extraction timed out"**
   - **Cause**: File too large or corrupted
   - **Fix**: Try a smaller file or check file integrity

---

## Next Steps (Phase 2.4)

Once text is extracted, Phase 2.4 will:
- Split text into chunks
- Generate embeddings
- Store in Pinecone for semantic search
- Enable RAG (Retrieval Augmented Generation)

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents` | List all documents (merged from Storage + DB) |
| `GET` | `/api/documents/:id/text` | Get extracted text for a document |
| `POST` | `/api/documents/:id/extract` | Manually trigger extraction |
| `POST` | `/api/documents/sync` | Sync Storage documents to database |
| `POST` | `/api/documents/upload` | Upload new document (auto-extracts) |
| `DELETE` | `/api/documents` | Delete document (from Storage + DB) |

---

**Last Updated**: 2025-01-18
