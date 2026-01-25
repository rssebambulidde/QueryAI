# Text Extraction - Complete Guide

## 📍 Where Extracted Text is Stored

### Database Storage (Supabase PostgreSQL)

**Table:** `documents`

**Column:** `extracted_text` (TEXT type)

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    user_id UUID,
    filename TEXT,
    file_path TEXT,
    extracted_text TEXT,  -- ← Full extracted text stored here
    text_length INTEGER,  -- Character count
    status TEXT,          -- 'processing', 'extracted', 'failed'
    metadata JSONB,       -- Stats: wordCount, pageCount, etc.
    ...
);
```

### Storage Location Details:

1. **Database**: Supabase PostgreSQL
   - **Table**: `documents`
   - **Column**: `extracted_text` (TEXT type - unlimited length in PostgreSQL)
   - **Location**: Your Supabase project database
   - **Access**: Only accessible by the authenticated user (RLS policies)

2. **File Storage**: Supabase Storage
   - **Original PDF**: Stored in Supabase Storage bucket
   - **Path**: `{user_id}/{timestamp}-{filename}.pdf`
   - **Purpose**: Original file backup, download, view

### Data Flow:

```
PDF Upload
    ↓
Supabase Storage (original file)
    ↓
Text Extraction (in memory)
    ↓
PostgreSQL Database (extracted_text column)
    ↓
Ready for Phase 2.4 (chunking & embeddings)
```

---

## ⏱️ Timeout for Large PDFs (500+ pages)

### Current Settings:

- **Upload Timeout**: 120 seconds (2 minutes) - Frontend
- **Extraction Timeout**: 60 seconds (1 minute) - Backend
- **Text Length Limit**: 1,000,000 characters (~200,000 words)

### Is 2 Minutes Enough for 500+ Pages?

**Short Answer**: Probably not for very large PDFs.

**Why**:
- 500-page PDF can be 50-100MB+
- Upload time: 30-60 seconds (depends on connection)
- Extraction time: 30-120+ seconds (depends on PDF complexity)
- **Total**: Could easily exceed 2 minutes

### Current Limitations:

1. **Extraction runs synchronously** during upload
2. **Single timeout** for both upload + extraction
3. **No progress tracking** for extraction
4. **No chunked processing** for large files

### Recommended Solutions:

#### Option 1: Increase Timeouts (Quick Fix)
```typescript
// Frontend: Increase upload timeout
timeout: 300000, // 5 minutes

// Backend: Increase extraction timeout
const EXTRACTION_TIMEOUT = 300000; // 5 minutes
```

#### Option 2: Make Extraction Fully Async (Better)
- Upload completes immediately
- Extraction runs in background job queue
- User sees "Processing..." status
- Status updates when complete

#### Option 3: Chunked Processing (Best for Large Files)
- Process PDF in page chunks
- Update progress incrementally
- Handle memory better
- More resilient to timeouts

---

## 📊 PDFs with Tables - What Happens?

### Current Behavior:

**pdf-parse v2** extracts tables, but the current implementation only extracts **plain text**.

### What Gets Extracted:

✅ **Extracted:**
- All text content
- Text from tables (as plain text, not structured)
- Headers and footers
- Body text

❌ **NOT Preserved:**
- Table structure (rows/columns)
- Table formatting
- Images in tables
- Complex layouts

### Example:

**Original PDF Table:**
```
| Name    | Age | City     |
|---------|-----|----------|
| John    | 25  | New York |
| Jane    | 30  | London   |
```

**Extracted Text:**
```
Name Age City
John 25 New York
Jane 30 London
```

### pdf-parse v2 Table Support:

The library **does support** table extraction, but we're not using it yet:

```typescript
// Current (text only)
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
// Returns: { text: "...", pages: [...] }

// Available (with tables)
const result = await parser.getTables();
// Returns: { tables: [...], text: "..." }
```

### Future Enhancement (Phase 2.4+):

We can enhance extraction to:
1. Extract tables as structured data
2. Store table data in `metadata` JSONB field
3. Preserve table structure for better RAG
4. Use table data in AI responses

---

## 🔍 Current Implementation Details

### Text Storage Limits:

**PostgreSQL TEXT Type:**
- **Maximum Size**: Unlimited (up to 1GB per field)
- **Current Limit**: 1,000,000 characters (enforced in code)
- **Why Limit**: 
  - Performance (queries, indexing)
  - Memory usage
  - Cost considerations

### What Happens if Text is Too Long:

```typescript
// In ExtractionService
if (text.length > MAX_TEXT_LENGTH) {
  text = text.substring(0, MAX_TEXT_LENGTH);
  metadata.truncated = true;
}
```

- Text is **truncated** to 1M characters
- `metadata.truncated = true` flag set
- Warning logged
- Extraction continues

### Database Storage Size:

**Example for 500-page PDF:**
- Average: ~500 words/page
- Total: ~250,000 words
- Characters: ~1,500,000 characters
- **Storage**: ~1.5 MB in database

**PostgreSQL TEXT Storage:**
- Efficient compression
- No practical limit for most documents
- Can handle millions of characters

---

## 🚀 Recommendations for Large PDFs

### Immediate Fixes:

1. **Increase Timeouts**:
   ```typescript
   // Frontend
   timeout: 300000, // 5 minutes
   
   // Backend
   const EXTRACTION_TIMEOUT = 300000; // 5 minutes
   ```

2. **Make Extraction Async**:
   - Don't wait for extraction during upload
   - Return immediately with "processing" status
   - Extract in background
   - Update status when done

3. **Add Progress Tracking**:
   - Show extraction progress
   - Update status incrementally
   - Better user experience

### Long-term Solutions:

1. **Background Job Queue** (Bull/BullMQ):
   - Process extractions asynchronously
   - Retry failed extractions
   - Better error handling

2. **Chunked Processing**:
   - Process PDF page by page
   - Update progress per page
   - Handle memory better

3. **Table Extraction**:
   - Use `parser.getTables()` for structured data
   - Store tables in metadata
   - Better RAG accuracy

---

## 📝 Summary

### Where Text is Stored:
- **Database**: `documents.extracted_text` column (PostgreSQL TEXT)
- **Location**: Supabase PostgreSQL database
- **Access**: User-specific (RLS policies)
- **Size Limit**: 1M characters (configurable)

### Timeout for 500+ Pages:
- **Current**: 2 minutes (likely insufficient)
- **Recommended**: 5+ minutes or async processing
- **Best**: Background job queue

### Tables in PDFs:
- **Current**: Extracted as plain text (structure lost)
- **Available**: pdf-parse v2 supports table extraction
- **Future**: Can extract structured table data

---

**Next Steps**: Would you like me to implement any of these improvements?
