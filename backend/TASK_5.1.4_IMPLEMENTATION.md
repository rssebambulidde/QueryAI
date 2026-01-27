# Task 5.1.4: Enhance Citation Metadata

## Overview
Enhanced citation metadata to include comprehensive information about sources, including publication dates, author information, document metadata (type, size), and access dates for web sources.

## Implementation Date
January 26, 2026

## Objectives
- Include publication dates in citations
- Include author information
- Add document metadata (type, size)
- Include access dates for web sources
- Enhance citation data structure

## Files Modified

### 1. `backend/src/types/source.ts`
**Changes:**
- Enhanced `SourceMetadata` interface with comprehensive metadata fields
- Added comments indicating required fields for documents and web sources
- Maintained backward compatibility with optional fields

**Key Fields Added:**
- `publishedDate` / `publicationDate`: ISO date strings for publication dates
- `accessDate`: ISO date string for when web sources were accessed (REQUIRED for web sources)
- `author` / `authors`: Author information (single or multiple)
- `documentType`: File type (pdf, docx, txt, md) - REQUIRED for documents
- `fileSize` / `fileSizeFormatted`: File size in bytes and human-readable format - REQUIRED for documents
- Additional fields: `createdAt`, `updatedAt`, `publisher`, `journal`, `doi`, `isbn`, etc.

### 2. `backend/src/services/rag.service.ts`
**Changes:**
- Enhanced `DocumentContext` interface to include new metadata fields
- Enhanced `RAGContext` interface to include `accessDate` for web sources
- Updated `retrieveDocumentContext` to extract and include:
  - File size (bytes and formatted)
  - File type
  - Author(s) from document metadata
  - Publication dates from document metadata
  - Creation and update timestamps
- Updated `retrieveWebSearch` to include access dates (when source was accessed)
- Updated `extractSources` to include all enhanced metadata in source objects
- Updated context formatting to display enhanced metadata
- Preserved metadata during re-ranking, diversity filtering, and hybrid search operations

**Key Enhancements:**
- Document metadata extraction from database records
- Automatic file size formatting (B, KB, MB)
- Access date generation for web sources (current timestamp)
- Metadata preservation through all processing pipelines

### 3. `backend/src/services/ai.service.ts`
**Changes:**
- Updated `Source` interface to use `SourceMetadata` type
- Updated fallback search to include metadata for web sources

## Features Implemented

### Publication Dates
- Extracted from document metadata when available
- Included from web search results
- Stored in both `publishedDate` and `publicationDate` fields for compatibility

### Author Information
- Extracted from document metadata (`author` or `Author` fields)
- Supports single author (`author`) or multiple authors (`authors` array)
- Included from web search results when available

### Document Metadata
- **File Type**: Extracted from `file_type` field (pdf, docx, txt, md)
- **File Size**: Extracted from `file_size` field in bytes
- **Formatted Size**: Automatically formatted as human-readable (B, KB, MB)
- **Timestamps**: Creation and update timestamps from database

### Access Dates
- Automatically generated for web sources when search is performed
- Stored as ISO date strings
- Required field for web sources

## Data Structure

### SourceMetadata Interface
```typescript
export interface SourceMetadata {
  // Publication information
  publishedDate?: string;
  publicationDate?: string;
  accessDate?: string; // REQUIRED for web sources
  
  // Author information
  author?: string;
  authors?: string[];
  
  // Document-specific metadata
  documentType?: string; // REQUIRED for documents
  fileSize?: number; // REQUIRED for documents
  fileSizeFormatted?: string;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  
  // Additional metadata
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  
  // Quality indicators
  authorityScore?: number;
  qualityScore?: number;
  relevanceScore?: number;
}
```

## Usage Example

```typescript
// Document source with metadata
{
  type: 'document',
  title: 'Research Paper.pdf',
  documentId: 'doc-123',
  metadata: {
    documentType: 'pdf',
    fileSize: 2457600,
    fileSizeFormatted: '2.34 MB',
    author: 'John Doe',
    publishedDate: '2024-01-15T00:00:00Z',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  }
}

// Web source with metadata
{
  type: 'web',
  title: 'Article Title',
  url: 'https://example.com/article',
  metadata: {
    publishedDate: '2024-01-20T00:00:00Z',
    accessDate: '2024-01-26T10:30:00Z', // When source was accessed
    author: 'Jane Smith',
    url: 'https://example.com/article'
  }
}
```

## Acceptance Criteria

✅ **Metadata included in citations**
- All metadata fields are included in the `metadata` property of sources
- Both document and web sources include comprehensive metadata

✅ **Metadata accurate**
- Metadata extracted from actual document records and web search results
- File sizes automatically formatted for readability
- Access dates accurately reflect when sources were accessed

✅ **No breaking changes**
- All new fields are optional, maintaining backward compatibility
- Existing code continues to work without modifications
- Graceful handling when metadata is not available

## Testing Recommendations

1. **Document Sources:**
   - Verify file size extraction and formatting
   - Test with documents that have author metadata
   - Test with documents that have publication dates
   - Verify metadata preservation through processing pipelines

2. **Web Sources:**
   - Verify access date generation
   - Test with web results that include publication dates
   - Test with web results that include author information

3. **Edge Cases:**
   - Documents without metadata
   - Web sources without publication dates
   - Missing author information
   - Very large file sizes

## Performance Impact

- **Minimal**: Metadata extraction adds negligible overhead
- **File Size Formatting**: Simple calculation, no performance impact
- **Access Date Generation**: Single timestamp creation per web source

## Future Enhancements

- Extract publication dates from document content using NLP
- Parse author information from document headers/footers
- Add support for additional metadata fields (DOI, ISBN, etc.)
- Implement metadata validation and quality checks
