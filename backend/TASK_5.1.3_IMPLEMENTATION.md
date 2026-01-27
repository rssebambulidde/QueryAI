# Task 5.1.3: Implement Inline Citation Support Implementation

## Overview
Implemented inline citation support to track which parts of the answer cite which sources and link answer segments to sources. The system now provides structured inline citation data that enables frontend to display citations inline with answer text.

## Files Created

### 1. `backend/src/types/citation.ts`
- **Citation Type Definitions**: Type definitions for inline citations
- **Key Types**:
  - `InlineCitationSegment`: Represents a segment of text with associated citations
  - `InlineCitation`: Links a citation to a specific source
  - `InlineCitationResult`: Complete inline citation data for an answer
  - `CitationLink`: Links a citation to a source with metadata
  - `InlineCitationFormatOptions`: Options for formatting inline citations

### 2. `backend/src/services/inline-citation-formatter.service.ts`
- **InlineCitationFormatterService**: Service for formatting inline citations
- **Key Features**:
  - **Multiple Formats**: Supports markdown, HTML, plain text, and structured JSON
  - **Citation Linking**: Creates clickable citation links
  - **Coverage Analysis**: Calculates citation coverage percentage
  - **Source Grouping**: Groups segments by source

- **Methods**:
  - `formatInlineCitations(segments, options)`: Format inline citations for display
  - `formatCitationLinks(citations, sources)`: Format citation links
  - `getCitationCoverage(segments, totalLength)`: Get citation coverage percentage
  - `getSegmentsBySource(segments, sourceIndex)`: Get segments by source

## Files Modified

### 1. `backend/src/services/citation-parser.service.ts`
- Added `buildInlineCitationSegments` method:
  - Builds inline citation segments from text and citations
  - Links citations to sources
  - Creates structured segment data
  - Maps source indices to source IDs

### 2. `backend/src/services/ai.service.ts`
- Integrated inline citation building:
  - Builds inline citations after parsing
  - Includes inline citation data in response
  - Links answer segments to sources
  - Logs inline citation statistics

- Extended `QuestionResponse` interface:
  - Added `inline` field to citations object
  - Includes segments, citations, sourceMap, and statistics

## Features

### 1. Inline Citation Tracking

#### Segment Creation
- **Text Segmentation**: Divides answer into segments
- **Citation Association**: Associates citations with text segments
- **Position Tracking**: Tracks exact positions in original text
- **Source Linking**: Links segments to source IDs

#### Citation Linking
- **Source Index Mapping**: Maps citations to source indices
- **Source ID Resolution**: Resolves source IDs from sources
- **Metadata Preservation**: Preserves citation metadata (URL, document ID, title)

### 2. Inline Citation Data Structure

#### InlineCitationSegment
```typescript
interface InlineCitationSegment {
  text: string; // Text content
  startIndex: number; // Start position
  endIndex: number; // End position
  citations: InlineCitation[]; // Associated citations
  sourceIds: string[]; // Source IDs referenced
}
```

#### InlineCitation
```typescript
interface InlineCitation {
  citationId: string; // Unique identifier
  citationFormat: string; // Original format
  sourceIndex: number; // Source index (0-based)
  sourceId?: string; // Source ID
  sourceType: 'document' | 'web' | 'reference';
  position: { start: number; end: number };
  metadata?: { documentId?, url?, title? };
}
```

### 3. Citation Formatting

#### Format Options
- **Markdown**: Formats citations as markdown links
- **HTML**: Formats citations as HTML links with classes
- **Plain Text**: Formats citations as plain text
- **Structured**: Returns structured JSON data

#### Link Generation
- **Clickable Links**: Creates clickable citation links
- **Source Metadata**: Includes source metadata in links
- **Document Links**: Creates document:// links for documents
- **Web Links**: Creates http/https links for web sources

### 4. Citation Analysis

#### Coverage Analysis
- **Citation Coverage**: Calculates percentage of answer with citations
- **Source Distribution**: Shows which sources are cited most
- **Segment Analysis**: Analyzes citation distribution across segments

#### Source Grouping
- **Segments by Source**: Groups segments by source
- **Source Citation Count**: Counts citations per source
- **Source Coverage**: Calculates coverage per source

## Usage Example

```typescript
// Automatic inline citation building when citations are parsed
const response = await AIService.askQuestion({
  question: "What is machine learning?",
  userId: "user123",
  enableCitationParsing: true,
});

// Access inline citations
if (response.citations?.inline) {
  const inline = response.citations.inline;
  
  console.log(`Segments: ${inline.segmentCount}`);
  console.log(`Citations: ${inline.citationCount}`);
  
  // Access segments with citations
  inline.segments.forEach(segment => {
    console.log(`Text: ${segment.text}`);
    console.log(`Citations: ${segment.citations.length}`);
    console.log(`Source IDs: ${segment.sourceIds.join(', ')}`);
  });
  
  // Access individual citations
  inline.citations.forEach(citation => {
    console.log(`Citation: ${citation.citationFormat}`);
    console.log(`Source Index: ${citation.sourceIndex}`);
    console.log(`Source ID: ${citation.sourceId}`);
  });
}

// Format inline citations
const { InlineCitationFormatterService } = await import('./inline-citation-formatter.service');

const formatted = InlineCitationFormatterService.formatInlineCitations(
  inline.segments,
  {
    format: 'markdown',
    linkCitations: true,
    includeSourceMetadata: true,
  }
);

// Get citation coverage
const coverage = InlineCitationFormatterService.getCitationCoverage(
  inline.segments,
  response.answer.length
);
console.log(`Citation coverage: ${coverage.toFixed(2)}%`);

// Get segments by source
const segmentsForSource1 = InlineCitationFormatterService.getSegmentsBySource(
  inline.segments,
  0 // Source index 0
);
```

## Inline Citation Building Flow

```
1. Parse Citations
   │
   ├─► Extract citations from text
   │
   └─► Get citation positions

2. Build Source Map
   │
   ├─► Index sources by array index
   ├─► Map source indices to source IDs
   └─► Create lookup maps

3. Process Text Segments
   │
   ├─► For each citation:
   │   ├─► Find text before citation
   │   ├─► Find text segment with citation
   │   ├─► Link citation to source
   │   └─► Create inline citation object
   │
   └─► Create segments with citations

4. Link to Sources
   │
   ├─► Match citations to sources by index
   ├─► Match citations to sources by ID/URL
   └─► Resolve source IDs

5. Build Result
   │
   ├─► Create segment array
   ├─► Create citation array
   ├─► Build source map
   └─► Return inline citation result
```

## Example: Inline Citation Structure

### Input Text
```
Machine learning is a subset of AI [Document 1] that uses algorithms [Web Source 1](https://example.com). Neural networks [1] are key components.
```

### Inline Citation Result
```json
{
  "segments": [
    {
      "text": "Machine learning is a subset of AI [Document 1]",
      "startIndex": 0,
      "endIndex": 45,
      "citations": [
        {
          "citationId": "citation-1",
          "citationFormat": "[Document 1]",
          "sourceIndex": 0,
          "sourceId": "doc123",
          "sourceType": "document",
          "position": { "start": 35, "end": 45 },
          "metadata": {}
        }
      ],
      "sourceIds": ["doc123"]
    },
    {
      "text": " that uses algorithms [Web Source 1](https://example.com).",
      "startIndex": 45,
      "endIndex": 95,
      "citations": [
        {
          "citationId": "citation-2",
          "citationFormat": "[Web Source 1](https://example.com)",
          "sourceIndex": 1,
          "sourceId": "https://example.com",
          "sourceType": "web",
          "position": { "start": 70, "end": 95 },
          "metadata": {
            "url": "https://example.com"
          }
        }
      ],
      "sourceIds": ["https://example.com"]
    },
    {
      "text": " Neural networks [1] are key components.",
      "startIndex": 95,
      "endIndex": 130,
      "citations": [
        {
          "citationId": "citation-3",
          "citationFormat": "[1]",
          "sourceIndex": -1,
          "sourceType": "reference",
          "position": { "start": 110, "end": 113 },
          "metadata": {}
        }
      ],
      "sourceIds": []
    }
  ],
  "citations": [/* all citations */],
  "sourceMap": { "0": "doc123", "1": "https://example.com" },
  "citationCount": 3,
  "segmentCount": 3
}
```

## Acceptance Criteria

✅ **Inline citations tracked**
- Answer segments created with citations
- Citations linked to segments
- Position tracking accurate
- Source linking functional

✅ **Citations linked to answer parts**
- Segments contain associated citations
- Citations reference correct sources
- Source IDs resolved correctly
- Metadata preserved

✅ **Format correct**
- Markdown format correct
- HTML format correct
- Plain text format correct
- Structured format valid JSON

## Integration with Other Features

### With Citation Parsing
- Uses parsed citations from CitationParserService
- Builds inline structure from parsed citations
- Works together for complete citation processing

### With Citation Validation
- Inline citations use validated citations
- Source indices match validated sources
- Ensures citation accuracy

### With Response Processing
- Inline citations included in response
- Available for frontend display
- Enables rich citation UI

## Testing Recommendations

1. **Unit Tests**: Test inline citation building with various text and citation patterns
2. **Integration Tests**: Test integration with AI service
3. **Formatting Tests**: Test all formatting options
4. **Edge Cases**:
   - No citations
   - All text has citations
   - Overlapping citations
   - Citations at text boundaries
   - Missing sources
   - Invalid source indices
5. **Coverage Tests**: Test citation coverage calculation
6. **Source Linking Tests**: Test source linking accuracy

## Future Enhancements

1. **Smart Segmentation**: Improve segment boundaries (sentence/paragraph aware)
2. **Citation Highlighting**: Add visual highlighting for cited segments
3. **Citation Tooltips**: Add tooltips with source information
4. **Citation Analytics**: Track citation usage patterns
5. **Citation Confidence**: Score citation confidence per segment
6. **Multi-Source Segments**: Better handling of segments with multiple citations
7. **Citation Visualization**: Generate citation visualization data
