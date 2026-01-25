# Multi-User Data Storage & Isolation Explained

## Overview

This document explains how data is stored and isolated when you have **2 different signed up users** in the system. It covers:
1. **Documents Table** (Supabase PostgreSQL)
2. **Document Chunks Table** (Supabase PostgreSQL)
3. **Pinecone Vector Database** (Embeddings)

---

## Scenario: 2 Users

Let's say we have:
- **User A** (user_id: `aaa-111-222`)
- **User B** (user_id: `bbb-333-444`)

Both users upload documents and process them. Here's what happens:

---

## 1. Documents Table (`documents`)

### Storage Structure

**Location:** Supabase PostgreSQL Database

**Table Schema:**
```sql
documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,  -- ← KEY: Links document to user
    topic_id UUID,
    filename TEXT,
    file_path TEXT,
    file_type TEXT,
    file_size INTEGER,
    status TEXT,
    extracted_text TEXT,
    text_length INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

### Example Data

**User A's Documents:**
```
| id          | user_id     | filename           | status    |
|-------------|-------------|--------------------|-----------|
| doc-aaa-1   | aaa-111-222 | report.pdf         | processed |
| doc-aaa-2   | aaa-111-222 | manual.docx        | processed |
```

**User B's Documents:**
```
| id          | user_id     | filename           | status    |
|-------------|-------------|--------------------|-----------|
| doc-bbb-1   | bbb-333-444 | presentation.pdf   | processed |
| doc-bbb-2   | bbb-333-444 | guide.txt          | extracted |
```

### Isolation Mechanism

**Row Level Security (RLS) Policy:**
```sql
-- Users can ONLY see their own documents
CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = user_id);
```

**What This Means:**
- When **User A** queries documents, they **ONLY** see documents where `user_id = 'aaa-111-222'`
- When **User B** queries documents, they **ONLY** see documents where `user_id = 'bbb-333-444'`
- **User A cannot see User B's documents** (and vice versa)
- Database enforces this automatically via RLS

**Backend Code:**
```typescript
// When User A requests documents
const documents = await DocumentService.getDocuments(userId: 'aaa-111-222');
// Returns ONLY documents where user_id = 'aaa-111-222'
```

---

## 2. Document Chunks Table (`document_chunks`)

### Storage Structure

**Location:** Supabase PostgreSQL Database

**Table Schema:**
```sql
document_chunks (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,  -- ← Links chunk to document
    chunk_index INTEGER,
    content TEXT,
    start_char INTEGER,
    end_char INTEGER,
    token_count INTEGER,
    embedding_id TEXT,  -- ← Links to Pinecone vector ID
    created_at TIMESTAMPTZ
)
```

### Example Data

**User A's Chunks:**
```
| id        | document_id | chunk_index | content          | embedding_id        |
|-----------|-------------|-------------|------------------|---------------------|
| chunk-1   | doc-aaa-1   | 0           | "First chunk..." | doc-aaa-1:chunk-1   |
| chunk-2   | doc-aaa-1   | 1           | "Second chunk..." | doc-aaa-1:chunk-2   |
| chunk-3   | doc-aaa-2   | 0           | "Another doc..."  | doc-aaa-2:chunk-3   |
```

**User B's Chunks:**
```
| id        | document_id | chunk_index | content          | embedding_id        |
|-----------|-------------|-------------|------------------|---------------------|
| chunk-4   | doc-bbb-1   | 0           | "User B doc..."  | doc-bbb-1:chunk-4   |
| chunk-5   | doc-bbb-1   | 1           | "More content..." | doc-bbb-1:chunk-5   |
```

### Isolation Mechanism

**Row Level Security (RLS) Policy:**
```sql
-- Users can ONLY see chunks of their own documents
CREATE POLICY "Users can view chunks of own documents"
    ON document_chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = document_chunks.document_id
            AND documents.user_id = auth.uid()  -- ← Checks document ownership
        )
    );
```

**What This Means:**
- **User A** can only see chunks where the `document_id` belongs to a document owned by User A
- **User B** can only see chunks where the `document_id` belongs to a document owned by User B
- **Isolation is enforced through the document ownership chain**

**How It Works:**
1. User A requests chunks for `doc-aaa-1`
2. Database checks: Does `doc-aaa-1` belong to User A? (via `documents.user_id`)
3. If YES → Return chunks
4. If NO → Return empty (RLS blocks access)

**Backend Code:**
```typescript
// When User A requests chunks
const chunks = await ChunkService.getChunksByDocument(
    documentId: 'doc-aaa-1',
    userId: 'aaa-111-222'  // ← Verifies ownership
);
// Returns ONLY chunks for documents owned by User A
```

---

## 3. Pinecone Vector Database (Embeddings)

### Storage Structure

**Location:** Pinecone Cloud (Separate service)

**Index:** `queryai-embeddings` (Single index for ALL users)

**Vector Structure:**
```typescript
{
    id: "documentId:chunkId",  // e.g., "doc-aaa-1:chunk-1"
    values: [0.123, -0.456, ...],  // 1536 numbers (embedding)
    metadata: {
        userId: "aaa-111-222",      // ← KEY: User isolation
        documentId: "doc-aaa-1",
        chunkId: "chunk-1",
        chunkIndex: 0,
        topicId: "optional-topic-id",
        content: "First chunk content...",
        createdAt: "2025-01-20T..."
    }
}
```

### Example Data in Pinecone

**All vectors stored in ONE index, but tagged with userId:**

```
Vector ID: "doc-aaa-1:chunk-1"
Metadata: {
    userId: "aaa-111-222",  ← User A
    documentId: "doc-aaa-1",
    ...
}

Vector ID: "doc-aaa-1:chunk-2"
Metadata: {
    userId: "aaa-111-222",  ← User A
    documentId: "doc-aaa-1",
    ...
}

Vector ID: "doc-bbb-1:chunk-4"
Metadata: {
    userId: "bbb-333-444",  ← User B
    documentId: "doc-bbb-1",
    ...
}

Vector ID: "doc-bbb-1:chunk-5"
Metadata: {
    userId: "bbb-333-444",  ← User B
    documentId: "doc-bbb-1",
    ...
}
```

### Isolation Mechanism

**Metadata Filtering:**
```typescript
// When User A searches
const results = await PineconeService.search(queryEmbedding, {
    userId: 'aaa-111-222',  // ← REQUIRED filter
    topK: 10
});

// Pinecone query includes filter:
filter: {
    userId: { $eq: 'aaa-111-222' }  // ← Only returns User A's vectors
}
```

**What This Means:**
- **All users share the same Pinecone index**
- **Isolation is enforced via metadata filtering**
- When **User A** searches, Pinecone **ONLY** returns vectors where `metadata.userId = 'aaa-111-222'`
- When **User B** searches, Pinecone **ONLY** returns vectors where `metadata.userId = 'bbb-333-444'`
- **User A cannot see User B's vectors** (and vice versa)

**Backend Code:**
```typescript
// Pinecone search with user filter
static async search(queryEmbedding, options) {
    const filter = {
        userId: { $eq: options.userId }  // ← REQUIRED - enforces isolation
    };
    
    if (options.topicId) {
        filter.topicId = { $eq: options.topicId };
    }
    
    const results = await index.query({
        vector: queryEmbedding,
        topK: 10,
        filter: filter  // ← Pinecone filters by userId
    });
    
    // Returns ONLY vectors matching userId
}
```

---

## Complete Data Flow Example

### User A Uploads and Processes a Document

**Step 1: Upload Document**
```
POST /api/documents/upload
Headers: Authorization: Bearer <UserA_token>

→ Document created in database:
   id: "doc-aaa-1"
   user_id: "aaa-111-222"  ← Stored with User A's ID
   status: "stored"
```

**Step 2: Process Document**
```
POST /api/documents/doc-aaa-1/process
Headers: Authorization: Bearer <UserA_token>

→ Text extracted
→ Document updated:
   status: "extracted"
   extracted_text: "Full document text..."

→ Text chunked into 108 chunks
→ Chunks stored in database:
   document_id: "doc-aaa-1"  ← Links to User A's document
   (Each chunk has unique ID)

→ Embeddings generated (108 vectors)
→ Vectors stored in Pinecone:
   id: "doc-aaa-1:chunk-1"
   metadata: { userId: "aaa-111-222", ... }  ← Tagged with User A's ID
   id: "doc-aaa-1:chunk-2"
   metadata: { userId: "aaa-111-222", ... }
   ... (108 vectors total)
```

**Step 3: User A Searches**
```
POST /api/search/semantic
Headers: Authorization: Bearer <UserA_token>
Body: { query: "What is the main topic?" }

→ Query embedding generated
→ Pinecone search with filter:
   filter: { userId: { $eq: "aaa-111-222" } }
   
→ Returns ONLY vectors where userId = "aaa-111-222"
→ User A sees ONLY their own document chunks
```

---

## User B's Data (Separate & Isolated)

**User B uploads and processes:**
```
→ Document created:
   id: "doc-bbb-1"
   user_id: "bbb-333-444"  ← Different user ID

→ Chunks stored:
   document_id: "doc-bbb-1"  ← Links to User B's document

→ Vectors stored in Pinecone:
   id: "doc-bbb-1:chunk-4"
   metadata: { userId: "bbb-333-444", ... }  ← Tagged with User B's ID
```

**User B searches:**
```
→ Pinecone search with filter:
   filter: { userId: { $eq: "bbb-333-444" } }
   
→ Returns ONLY vectors where userId = "bbb-333-444"
→ User B sees ONLY their own document chunks
```

---

## Security & Isolation Summary

### Database Level (Supabase PostgreSQL)

| Table | Isolation Method | How It Works |
|-------|-----------------|--------------|
| **documents** | `user_id` column + RLS | Each document has `user_id`. RLS policy ensures users only see their own documents. |
| **document_chunks** | `document_id` → `documents.user_id` + RLS | Chunks linked to documents. RLS checks document ownership via join. |

### Vector Database Level (Pinecone)

| Storage | Isolation Method | How It Works |
|---------|-----------------|--------------|
| **Pinecone Index** | `metadata.userId` filter | All vectors in one index, but each vector has `userId` in metadata. Search queries ALWAYS filter by `userId`. |

---

## Key Points

### ✅ What's Isolated

1. **Documents Table:**
   - Each document has `user_id`
   - RLS ensures users only see their own documents
   - Database enforces isolation automatically

2. **Document Chunks Table:**
   - Chunks linked to documents via `document_id`
   - RLS checks document ownership
   - Users can only see chunks of their own documents

3. **Pinecone Vectors:**
   - All vectors in one index (shared infrastructure)
   - Each vector tagged with `userId` in metadata
   - Search queries **ALWAYS** filter by `userId`
   - Users can only retrieve their own vectors

### ✅ What's Shared

1. **Pinecone Index:**
   - Single index (`queryai-embeddings`) for all users
   - More cost-effective than separate indexes per user
   - Isolation enforced via metadata filtering

2. **Database Tables:**
   - Single tables for all users
   - Isolation enforced via `user_id` + RLS policies

### ✅ Security Guarantees

1. **User A cannot access User B's data:**
   - Database RLS blocks access
   - Pinecone filter blocks access
   - Backend code verifies ownership

2. **Backend Verification:**
   - Every API call requires authentication
   - `userId` extracted from JWT token
   - All queries filtered by `userId`

3. **Cascade Deletion:**
   - If User A deletes a document:
     - Document deleted from `documents` table
     - Chunks deleted from `document_chunks` table (CASCADE)
     - Vectors deleted from Pinecone (by documentId filter)

---

## Visual Representation

```
┌─────────────────────────────────────────────────────────┐
│                    USER A (aaa-111-222)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Documents Table:                                       │
│  ┌─────────────┐                                       │
│  │ doc-aaa-1   │ → user_id: aaa-111-222               │
│  │ doc-aaa-2   │ → user_id: aaa-111-222               │
│  └─────────────┘                                       │
│                                                         │
│  Chunks Table:                                          │
│  ┌─────────────┐                                       │
│  │ chunk-1     │ → document_id: doc-aaa-1             │
│  │ chunk-2     │ → document_id: doc-aaa-1             │
│  │ chunk-3     │ → document_id: doc-aaa-2             │
│  └─────────────┘                                       │
│                                                         │
│  Pinecone:                                              │
│  ┌─────────────────────────────────────┐              │
│  │ doc-aaa-1:chunk-1                    │              │
│  │ metadata: { userId: "aaa-111-222" } │              │
│  │ doc-aaa-1:chunk-2                    │              │
│  │ metadata: { userId: "aaa-111-222" } │              │
│  └─────────────────────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    USER B (bbb-333-444)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Documents Table:                                       │
│  ┌─────────────┐                                       │
│  │ doc-bbb-1   │ → user_id: bbb-333-444               │
│  │ doc-bbb-2   │ → user_id: bbb-333-444               │
│  └─────────────┘                                       │
│                                                         │
│  Chunks Table:                                          │
│  ┌─────────────┐                                       │
│  │ chunk-4     │ → document_id: doc-bbb-1             │
│  │ chunk-5     │ → document_id: doc-bbb-1             │
│  │ chunk-6     │ → document_id: doc-bbb-2             │
│  └─────────────┘                                       │
│                                                         │
│  Pinecone:                                              │
│  ┌─────────────────────────────────────┐              │
│  │ doc-bbb-1:chunk-4                    │              │
│  │ metadata: { userId: "bbb-333-444" } │              │
│  │ doc-bbb-1:chunk-5                    │              │
│  │ metadata: { userId: "bbb-333-444" } │              │
│  └─────────────────────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              SHARED PINECONE INDEX                       │
│         (queryai-embeddings)                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  All vectors stored here, but isolated by metadata:     │
│                                                         │
│  Vector: "doc-aaa-1:chunk-1"                           │
│  Metadata: { userId: "aaa-111-222", ... }             │
│                                                         │
│  Vector: "doc-bbb-1:chunk-4"                           │
│  Metadata: { userId: "bbb-333-444", ... }             │
│                                                         │
│  When User A searches:                                 │
│  → Filter: userId = "aaa-111-222"                      │
│  → Returns ONLY User A's vectors                       │
│                                                         │
│  When User B searches:                                 │
│  → Filter: userId = "bbb-333-444"                      │
│  → Returns ONLY User B's vectors                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

### Documents Table
- ✅ Each document has `user_id`
- ✅ RLS ensures users only see their own documents
- ✅ Isolation enforced at database level

### Document Chunks Table
- ✅ Chunks linked to documents via `document_id`
- ✅ RLS checks document ownership
- ✅ Users only see chunks of their own documents

### Pinecone Vectors
- ✅ All vectors in one shared index (cost-effective)
- ✅ Each vector tagged with `userId` in metadata
- ✅ Search queries **ALWAYS** filter by `userId`
- ✅ Users only retrieve their own vectors

### Security
- ✅ **User A cannot access User B's data** (enforced at multiple levels)
- ✅ Database RLS blocks unauthorized access
- ✅ Pinecone filter blocks unauthorized access
- ✅ Backend code verifies ownership on every request

---

**Last Updated:** 2025-01-20  
**Status:** Complete Explanation ✅
