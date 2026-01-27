/**
 * Citation Types
 * Type definitions for inline citations and citation linking
 */

/**
 * Inline citation segment
 * Represents a segment of text with associated citations
 */
export interface InlineCitationSegment {
  text: string; // Text content of the segment
  startIndex: number; // Start position in original text
  endIndex: number; // End position in original text
  citations: InlineCitation[]; // Citations associated with this segment
  sourceIds: string[]; // Source IDs referenced in this segment
}

/**
 * Inline citation
 * Links a citation to a specific source
 */
export interface InlineCitation {
  citationId: string; // Unique identifier for this citation instance
  citationFormat: string; // Original citation format (e.g., "[Document 1]")
  sourceIndex: number; // Index of source in sources array (0-based)
  sourceId?: string; // Source ID if available
  sourceType: 'document' | 'web' | 'reference';
  position: {
    start: number; // Start position in text
    end: number; // End position in text
  };
  metadata?: {
    documentId?: string;
    url?: string;
    title?: string;
  };
}

/**
 * Inline citation result
 * Complete inline citation data for an answer
 */
export interface InlineCitationResult {
  segments: InlineCitationSegment[]; // Text segments with citations
  citations: InlineCitation[]; // All inline citations
  sourceMap: Map<number, string>; // Map of source index to source ID
  citationCount: number; // Total number of citations
  segmentCount: number; // Total number of segments
}

/**
 * Citation link
 * Links a citation to a source with metadata
 */
export interface CitationLink {
  citation: InlineCitation;
  source: {
    type: 'document' | 'web';
    index: number;
    title: string;
    url?: string;
    documentId?: string;
    snippet?: string;
  };
  confidence: number; // Confidence score (0-1) for the link
}

/**
 * Inline citation formatting options
 */
export interface InlineCitationFormatOptions {
  format: 'markdown' | 'html' | 'plain' | 'structured'; // Output format
  includeSourceMetadata?: boolean; // Include source metadata in output
  linkCitations?: boolean; // Make citations clickable links
  citationStyle?: 'inline' | 'footnote' | 'numbered'; // Citation style
}
