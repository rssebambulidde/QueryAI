# Manual Processing Guide - Extraction & Embedding

## 📋 Overview

This guide explains how to manually trigger text extraction and embedding generation for documents, instead of having them run automatically on upload.

---

## 🎯 Why Manual Processing?

**Benefits:**
- **Control**: Choose when to process documents
- **Cost Management**: Process only when needed
- **Batch Processing**: Process multiple documents at once
- **Retry Failed**: Re-process failed extractions/embeddings
- **Existing Documents**: Process documents uploaded before Phase 2.3/2.4

---

## 🔧 Upload Options

### Automatic Processing (Default)

**Current behavior** - extraction and embedding run automatically:

```bash
POST /api/documents/upload
Content-Type: multipart/form-data

file: [your-file.pdf]
```

**Result:**
- ✅ Text extraction runs automatically
- ✅ Embedding generation runs automatically
- ✅ Document status: `embedded` when complete

---

### Manual Processing (Upload Only)

**Disable auto-processing** using query parameters:

```bash
POST /api/documents/upload?autoExtract=false&autoEmbed=false
Content-Type: multipart/form-data

file: [your-file.pdf]
```

**Result:**
- ✅ File uploaded and stored
- ❌ Text extraction NOT run
- ❌ Embedding generation NOT run
- ✅ Document status: `processing` (ready for manual extraction)

**Options:**
- `?autoExtract=false` - Disable automatic text extraction
- `?autoEmbed=false` - Disable automatic embedding (extraction still runs)
- `?autoExtract=false&autoEmbed=false` - Disable both

---

## 🔨 Manual Triggers

### 1. Single Document - Text Extraction

**Extract text from a single document:**

```bash
POST /api/documents/:id/extract
Authorization: Bearer <token>
```

**Example:**
```bash
POST /api/documents/123e4567-e89b-12d3-a456-426614174000/extract
```

**Response:**
```json
{
  "success": true,
  "message": "Text extraction started",
  "data": {
    "documentId": "123e4567-e89b-12d3-a456-426614174000",
    "status": "processing"
  }
}
```

**What happens:**
1. Downloads file from storage
2. Extracts text (PDF, DOCX, TXT, MD)
3. Updates document with extracted text
4. Status: `processing` → `extracted` or `failed`

---

### 2. Single Document - Embedding Generation

**Generate embeddings for a single extracted document:**

```bash
POST /api/documents/:id/embed
Authorization: Bearer <token>
```

**Example:**
```bash
POST /api/documents/123e4567-e89b-12d3-a456-426614174000/embed
```

**Response:**
```json
{
  "success": true,
  "message": "Embedding generation started",
  "data": {
    "documentId": "123e4567-e89b-12d3-a456-426614174000",
    "status": "embedding"
  }
}
```

**What happens:**
1. Checks if text is extracted
2. Chunks the text (500-1000 tokens each)
3. Generates embeddings (OpenAI API)
4. Stores chunks in database
5. Status: `embedding` → `embedded` or `embedding_failed`

---

### 3. Batch Text Extraction

**Extract text from multiple documents at once:**

```bash
POST /api/documents/batch-extract
Authorization: Bearer <token>
Content-Type: application/json

{
  "documentIds": [
    "doc-id-1",
    "doc-id-2",
    "doc-id-3"
  ],
  "autoEmbed": false  // Optional: auto-embed after extraction
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processing 3 document(s)",
  "data": {
    "results": [
      {
        "documentId": "doc-id-1",
        "success": true,
        "message": "Extraction started"
      },
      {
        "documentId": "doc-id-2",
        "success": true,
        "message": "Document already has extracted text"
      },
      {
        "documentId": "doc-id-3",
        "success": false,
        "message": "Document not found"
      }
    ],
    "total": 3,
    "started": 2,
    "failed": 1
  }
}
```

**Features:**
- ✅ Process up to 50 documents at once
- ✅ Skips already extracted documents
- ✅ Optional auto-embedding after extraction
- ✅ Returns results for each document

---

### 4. Batch Embedding Generation

**Generate embeddings for multiple extracted documents:**

```bash
POST /api/documents/batch-embed
Authorization: Bearer <token>
Content-Type: application/json

{
  "documentIds": [
    "doc-id-1",
    "doc-id-2",
    "doc-id-3"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processing 3 document(s)",
  "data": {
    "results": [
      {
        "documentId": "doc-id-1",
        "success": true,
        "message": "Embedding generation started"
      },
      {
        "documentId": "doc-id-2",
        "success": true,
        "message": "Document already has embeddings"
      },
      {
        "documentId": "doc-id-3",
        "success": false,
        "message": "Document text must be extracted before generating embeddings"
      }
    ],
    "total": 3,
    "started": 2,
    "failed": 1
  }
}
```

**Features:**
- ✅ Process up to 50 documents at once
- ✅ Skips already embedded documents
- ✅ Validates text extraction first
- ✅ Returns results for each document

---

## 📊 Check Status

### Get Embedding Status

```bash
GET /api/documents/:id/embedding-status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "123e4567...",
    "status": "embedded",
    "chunkCount": 25,
    "embeddingMetadata": {
      "model": "text-embedding-3-small",
      "dimensions": 1536,
      "chunkCount": 25,
      "totalTokens": 12500,
      "completedAt": "2025-01-27T..."
    },
    "embeddingError": null
  }
}
```

### List All Chunks

```bash
GET /api/documents/:id/chunks
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "123e4567...",
    "chunks": [
      {
        "id": "chunk-id-1",
        "chunkIndex": 0,
        "content": "First chunk content...",
        "startChar": 0,
        "endChar": 500,
        "tokenCount": 125,
        "embeddingId": null,
        "createdAt": "2025-01-27T..."
      }
    ],
    "count": 25
  }
}
```

---

## 🔄 Processing Flow Examples

### Example 1: Process Existing Documents

**Scenario:** You have 10 documents uploaded before Phase 2.3/2.4

**Step 1: Extract text for all**
```bash
POST /api/documents/batch-extract
{
  "documentIds": ["doc-1", "doc-2", ..., "doc-10"],
  "autoEmbed": false
}
```

**Step 2: Generate embeddings for all**
```bash
POST /api/documents/batch-embed
{
  "documentIds": ["doc-1", "doc-2", ..., "doc-10"]
}
```

---

### Example 2: Upload Without Processing

**Step 1: Upload document (no processing)**
```bash
POST /api/documents/upload?autoExtract=false&autoEmbed=false
file: document.pdf
```

**Step 2: Extract text manually**
```bash
POST /api/documents/{id}/extract
```

**Step 3: Generate embeddings manually**
```bash
POST /api/documents/{id}/embed
```

---

### Example 3: Retry Failed Extraction

**Step 1: Check status**
```bash
GET /api/documents/{id}
```

**Step 2: Retry extraction**
```bash
POST /api/documents/{id}/extract
```

**Step 3: If successful, generate embeddings**
```bash
POST /api/documents/{id}/embed
```

---

## 🎛️ Frontend Integration

### Upload with Manual Processing

```typescript
// Upload without auto-processing
const formData = new FormData();
formData.append('file', file);

const response = await apiClient.post(
  '/api/documents/upload?autoExtract=false&autoEmbed=false',
  formData,
  {
    headers: { 'Content-Type': 'multipart/form-data' },
  }
);
```

### Batch Extract

```typescript
// Extract text for multiple documents
const response = await apiClient.post('/api/documents/batch-extract', {
  documentIds: ['doc-1', 'doc-2', 'doc-3'],
  autoEmbed: false, // Don't auto-embed
});
```

### Batch Embed

```typescript
// Generate embeddings for multiple documents
const response = await apiClient.post('/api/documents/batch-embed', {
  documentIds: ['doc-1', 'doc-2', 'doc-3'],
});
```

---

## ⚠️ Important Notes

### Processing Limits

- **Batch size**: Maximum 50 documents per request
- **Rate limiting**: API rate limits apply
- **Time**: Processing runs in background (non-blocking)

### Status Tracking

Monitor document status:
- `processing` - Text extraction in progress
- `extracted` - Text extracted, ready for embedding
- `embedding` - Embedding generation in progress
- `embedded` - Complete (text + embeddings)
- `failed` - Text extraction failed
- `embedding_failed` - Embedding generation failed

### Error Handling

- Failed extractions can be retried
- Failed embeddings can be retried
- Check `extraction_error` or `embedding_error` fields
- Use status endpoints to monitor progress

---

## 📝 Summary

**Manual Processing Endpoints:**

1. **Single Document:**
   - `POST /api/documents/:id/extract` - Extract text
   - `POST /api/documents/:id/embed` - Generate embeddings

2. **Batch Processing:**
   - `POST /api/documents/batch-extract` - Extract text for multiple
   - `POST /api/documents/batch-embed` - Generate embeddings for multiple

3. **Status Checking:**
   - `GET /api/documents/:id/embedding-status` - Check embedding status
   - `GET /api/documents/:id/chunks` - List all chunks

**Upload Options:**
- `?autoExtract=false` - Disable auto-extraction
- `?autoEmbed=false` - Disable auto-embedding
- Default: Both enabled (backward compatible)

---

**Ready to use!** All endpoints are implemented and ready for testing. 🚀
