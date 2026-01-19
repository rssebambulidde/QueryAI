# Document Extraction Capabilities Guide

## Current Status vs. What's Possible

### 📊 Tables in Word Documents (DOCX)

**Current Status:**
- ❌ **NOT Extracted** - Only plain text is extracted
- Uses `mammoth.extractRawText()` which strips all formatting

**What's Possible:**
- ✅ **Can Extract** - `mammoth` supports converting DOCX to HTML/Markdown
- HTML preserves table structure
- Can parse HTML to extract structured table data

**Implementation:**
```typescript
// Current (text only)
const result = await mammoth.extractRawText({ buffer });

// Available (with tables)
const result = await mammoth.convertToHtml({ buffer });
// Then parse HTML to extract <table> elements
```

---

### 🖼️ Images in Documents

**Current Status:**
- ❌ **NOT Extracted** - Images are ignored
- Only text content is extracted

**What's Possible:**

#### PDF Images:
- ✅ **pdf-parse v2 supports** `getImage()` method
- Extracts embedded images from PDFs
- Returns image buffers and data URLs

#### DOCX Images:
- ✅ **mammoth supports** image extraction
- Can extract images as base64 or buffers
- Preserves image metadata

**Implementation:**
```typescript
// PDF images
const result = await parser.getImage();
// Returns: { pages: [{ images: [{ data, dataUrl, width, height }] }] }

// DOCX images  
const result = await mammoth.convertToHtml({ buffer });
// Images embedded as base64 in HTML
```

---

### 📄 Scanned PDFs (Image-based PDFs)

**Current Status:**
- ❌ **NOT Supported** - Only text-based PDFs work
- Scanned PDFs have no extractable text
- Need OCR (Optical Character Recognition)

**What's Needed:**
- OCR library: **Tesseract.js** (free, open-source)
- Or cloud OCR: **Google Vision API**, **AWS Textract**, **Azure Computer Vision**

**How It Works:**
1. Convert PDF pages to images
2. Run OCR on each image
3. Extract text from OCR results
4. Combine into full document text

**Implementation Options:**

#### Option 1: Tesseract.js (Free, Self-hosted)
```typescript
import Tesseract from 'tesseract.js';

// Convert PDF page to image
const image = await parser.getScreenshot({ partial: [1] });

// Run OCR
const { data: { text } } = await Tesseract.recognize(
  image.pages[0].data,
  'eng',
  { logger: m => console.log(m) }
);
```

#### Option 2: Cloud OCR (Better Accuracy)
- Google Vision API
- AWS Textract
- Azure Computer Vision

---

## Storage Considerations

### Where to Store Extracted Data:

**Text:**
- ✅ Already stored in `documents.extracted_text` (TEXT column)

**Tables:**
- ✅ Already stored in `documents.metadata.tables` (JSONB)

**Images:**
- **Option 1**: Store in Supabase Storage (separate bucket)
- **Option 2**: Store as base64 in `documents.metadata.images` (JSONB)
- **Option 3**: Store image metadata only, keep original in PDF

**OCR Results:**
- Store in `documents.extracted_text` (same as regular text)
- Mark with `metadata.ocr: true` flag

---

## Recommended Implementation Priority

### Phase 1: DOCX Tables (Easy)
- Use `mammoth.convertToHtml()`
- Parse HTML to extract `<table>` elements
- Store in `metadata.tables`

### Phase 2: PDF Images (Medium)
- Use `parser.getImage()`
- Store image metadata in `metadata.images`
- Optionally save images to Storage

### Phase 3: Scanned PDF OCR (Complex)
- Integrate Tesseract.js
- Convert PDF pages to images
- Run OCR per page
- Combine results

---

## Database Schema Updates Needed

```sql
-- Add image storage fields (optional)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS images_metadata JSONB DEFAULT '[]';

-- Example structure:
-- metadata.images = [
--   {
--     page: 1,
--     index: 0,
--     width: 800,
--     height: 600,
--     format: 'png',
--     storagePath: 'user_id/document_id/image_1.png'
--   }
-- ]
```

---

## Performance Considerations

### DOCX Tables:
- Fast - Direct XML parsing
- No performance impact

### PDF Images:
- Medium - Image extraction is fast
- Storage size increases

### OCR (Scanned PDFs):
- **Slow** - 10-30 seconds per page
- **CPU intensive**
- **Memory intensive**
- Best run in background job queue

---

## Cost Considerations

### Free Options:
- Tesseract.js (self-hosted)
- No API costs
- Uses your server resources

### Paid Options:
- Google Vision API: ~$1.50 per 1,000 pages
- AWS Textract: ~$1.50 per 1,000 pages
- Better accuracy, faster processing

---

**Next Steps**: Would you like me to implement any of these features?
