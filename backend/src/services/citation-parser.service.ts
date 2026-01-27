/**
 * Citation Parser Service
 * Parses citations from LLM responses
 * Supports multiple citation formats
 */

import logger from '../config/logger';

/**
 * Parsed citation
 */
export interface ParsedCitation {
  type: 'document' | 'web' | 'reference' | 'unknown';
  format: string; // Original format string
  index?: number; // Citation index (e.g., 1, 2, 3)
  name?: string; // Document name or source title
  url?: string; // URL if present
  documentId?: string; // Document ID if present
  position: {
    start: number; // Start position in text
    end: number; // End position in text
  };
}

/**
 * Citation parsing result
 */
export interface CitationParseResult {
  citations: ParsedCitation[];
  textWithoutCitations: string; // Text with citations removed
  citationCount: number;
  documentCitations: ParsedCitation[];
  webCitations: ParsedCitation[];
  referenceCitations: ParsedCitation[];
  parsingTimeMs: number;
}

/**
 * Citation parsing options
 */
export interface CitationParseOptions {
  removeCitations?: boolean; // Remove citations from text (default: false)
  preserveFormat?: boolean; // Preserve original citation format (default: true)
  maxParsingTimeMs?: number; // Maximum parsing time (default: 100ms)
}

/**
 * Default parsing options
 */
const DEFAULT_PARSE_OPTIONS: Required<CitationParseOptions> = {
  removeCitations: false,
  preserveFormat: true,
  maxParsingTimeMs: 100,
};

/**
 * Citation Parser Service
 */
export class CitationParserService {
  /**
   * Parse citations from text
   */
  static parseCitations(
    text: string,
    options: CitationParseOptions = {}
  ): CitationParseResult {
    const startTime = Date.now();
    const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };
    const citations: ParsedCitation[] = [];

    try {
      // Parse different citation formats
      const documentCitations = this.parseDocumentCitations(text);
      const webCitations = this.parseWebCitations(text);
      const referenceCitations = this.parseReferenceCitations(text);

      // Combine all citations
      citations.push(...documentCitations, ...webCitations, ...referenceCitations);

      // Sort by position
      citations.sort((a, b) => a.position.start - b.position.start);

      // Remove duplicates (same position)
      const uniqueCitations = this.deduplicateCitations(citations);

      // Remove citations from text if requested
      let textWithoutCitations = text;
      if (opts.removeCitations) {
        textWithoutCitations = this.removeCitationsFromText(text, uniqueCitations);
      }

      const parsingTime = Date.now() - startTime;

      if (parsingTime > opts.maxParsingTimeMs) {
        logger.warn('Citation parsing exceeded target time', {
          parsingTimeMs: parsingTime,
          targetTimeMs: opts.maxParsingTimeMs,
          citationCount: uniqueCitations.length,
        });
      }

      logger.debug('Citations parsed', {
        totalCitations: uniqueCitations.length,
        documentCitations: documentCitations.length,
        webCitations: webCitations.length,
        referenceCitations: referenceCitations.length,
        parsingTimeMs: parsingTime,
      });

      return {
        citations: uniqueCitations,
        textWithoutCitations,
        citationCount: uniqueCitations.length,
        documentCitations: uniqueCitations.filter(c => c.type === 'document'),
        webCitations: uniqueCitations.filter(c => c.type === 'web'),
        referenceCitations: uniqueCitations.filter(c => c.type === 'reference'),
        parsingTimeMs: parsingTime,
      };
    } catch (error: any) {
      logger.error('Error parsing citations', {
        error: error.message,
        textLength: text.length,
      });

      // Return empty result on error
      return {
        citations: [],
        textWithoutCitations: text,
        citationCount: 0,
        documentCitations: [],
        webCitations: [],
        referenceCitations: [],
        parsingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse document citations: [Document N] or [Document Name](document://id)
   */
  private static parseDocumentCitations(text: string): ParsedCitation[] {
    const citations: ParsedCitation[] = [];

    // Pattern 1: [Document N] where N is a number
    const pattern1 = /\[Document\s+(\d+)\]/gi;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      citations.push({
        type: 'document',
        format: match[0],
        index: parseInt(match[1], 10),
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    // Pattern 2: [Document Name](document://id)
    const pattern2 = /\[Document\s+([^\]]+)\]\(document:\/\/([^)]+)\)/gi;
    while ((match = pattern2.exec(text)) !== null) {
      citations.push({
        type: 'document',
        format: match[0],
        name: match[1].trim(),
        documentId: match[2],
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    // Pattern 3: [Document Name] (without URL, but has a name)
    const pattern3 = /\[Document\s+([^\]]+)\](?!\()/gi;
    while ((match = pattern3.exec(text)) !== null) {
      // Skip if already matched by pattern1 (numeric)
      if (!/^\d+$/.test(match[1].trim())) {
        citations.push({
          type: 'document',
          format: match[0],
          name: match[1].trim(),
          position: {
            start: match.index,
            end: match.index + match[0].length,
          },
        });
      }
    }

    return citations;
  }

  /**
   * Parse web citations: [Web Source N](URL) or [Title](URL)
   */
  private static parseWebCitations(text: string): ParsedCitation[] {
    const citations: ParsedCitation[] = [];

    // Pattern 1: [Web Source N](URL)
    const pattern1 = /\[Web\s+Source\s+(\d+)\]\(([^)]+)\)/gi;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      citations.push({
        type: 'web',
        format: match[0],
        index: parseInt(match[1], 10),
        url: match[2],
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    // Pattern 2: [Title](URL) - generic markdown link (if not document://)
    const pattern2 = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi;
    while ((match = pattern2.exec(text)) !== null) {
      const url = match[2];
      const name = match[1].trim();

      // Skip if it's a document:// URL (already handled)
      if (url.startsWith('document://')) {
        continue;
      }

      // Skip if it matches "Web Source N" pattern (already handled)
      if (/^Web\s+Source\s+\d+$/i.test(name)) {
        continue;
      }

      // Check if it's likely a web citation (has http/https URL)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        citations.push({
          type: 'web',
          format: match[0],
          name,
          url,
          position: {
            start: match.index,
            end: match.index + match[0].length,
          },
        });
      }
    }

    return citations;
  }

  /**
   * Parse reference citations: [1], [2], [Source 1], etc.
   */
  private static parseReferenceCitations(text: string): ParsedCitation[] {
    const citations: ParsedCitation[] = [];

    // Pattern 1: [N] where N is a number (simple numeric reference)
    const pattern1 = /\[(\d+)\](?!\()/g;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      // Skip if it's part of a markdown link (e.g., [text](url))
      const before = text.substring(Math.max(0, match.index - 10), match.index);
      const after = text.substring(match.index + match[0].length, match.index + match[0].length + 1);
      
      // If followed by ( it's likely a markdown link, skip
      if (after === '(') {
        continue;
      }

      citations.push({
        type: 'reference',
        format: match[0],
        index: parseInt(match[1], 10),
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    // Pattern 2: [Source N] or [Ref N]
    const pattern2 = /\[(?:Source|Ref|Reference)\s+(\d+)\](?!\()/gi;
    while ((match = pattern2.exec(text)) !== null) {
      citations.push({
        type: 'reference',
        format: match[0],
        index: parseInt(match[1], 10),
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
      });
    }

    return citations;
  }

  /**
   * Remove duplicate citations (same position)
   */
  private static deduplicateCitations(citations: ParsedCitation[]): ParsedCitation[] {
    const seen = new Set<string>();
    const unique: ParsedCitation[] = [];

    for (const citation of citations) {
      const key = `${citation.position.start}-${citation.position.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(citation);
      }
    }

    return unique;
  }

  /**
   * Remove citations from text
   */
  private static removeCitationsFromText(
    text: string,
    citations: ParsedCitation[]
  ): string {
    // Sort citations by position (descending) to remove from end to start
    const sortedCitations = [...citations].sort((a, b) => b.position.start - a.position.start);

    let result = text;
    for (const citation of sortedCitations) {
      result =
        result.substring(0, citation.position.start) +
        result.substring(citation.position.end);
    }

    return result;
  }

  /**
   * Extract citation metadata
   */
  static extractCitationMetadata(citation: ParsedCitation): Record<string, any> {
    const metadata: Record<string, any> = {
      type: citation.type,
      format: citation.format,
    };

    if (citation.index !== undefined) {
      metadata.index = citation.index;
    }

    if (citation.name) {
      metadata.name = citation.name;
    }

    if (citation.url) {
      metadata.url = citation.url;
    }

    if (citation.documentId) {
      metadata.documentId = citation.documentId;
    }

    return metadata;
  }

  /**
   * Format citations for display
   */
  static formatCitationsForDisplay(citations: ParsedCitation[]): string {
    if (citations.length === 0) {
      return '';
    }

    const parts: string[] = [];
    parts.push('**Citations:**\n');

    const documentCitations = citations.filter(c => c.type === 'document');
    const webCitations = citations.filter(c => c.type === 'web');
    const referenceCitations = citations.filter(c => c.type === 'reference');

    if (documentCitations.length > 0) {
      parts.push('**Documents:**');
      documentCitations.forEach((citation, idx) => {
        const label = citation.index !== undefined
          ? `Document ${citation.index}`
          : citation.name || 'Document';
        parts.push(`${idx + 1}. ${label}${citation.documentId ? ` (ID: ${citation.documentId})` : ''}`);
      });
      parts.push('');
    }

    if (webCitations.length > 0) {
      parts.push('**Web Sources:**');
      webCitations.forEach((citation, idx) => {
        const label = citation.index !== undefined
          ? `Web Source ${citation.index}`
          : citation.name || 'Web Source';
        parts.push(`${idx + 1}. ${label}${citation.url ? ` - ${citation.url}` : ''}`);
      });
      parts.push('');
    }

    if (referenceCitations.length > 0) {
      parts.push('**References:**');
      referenceCitations.forEach((citation, idx) => {
        const label = citation.index !== undefined
          ? `Reference ${citation.index}`
          : 'Reference';
        parts.push(`${idx + 1}. ${label}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Validate citation format
   */
  static validateCitation(citation: ParsedCitation): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!citation.type || !['document', 'web', 'reference', 'unknown'].includes(citation.type)) {
      errors.push('Invalid citation type');
    }

    if (!citation.format || citation.format.trim().length === 0) {
      errors.push('Citation format is empty');
    }

    if (citation.type === 'web' && !citation.url) {
      errors.push('Web citation missing URL');
    }

    if (citation.type === 'document' && citation.documentId && !citation.documentId.match(/^[a-zA-Z0-9_-]+$/)) {
      errors.push('Invalid document ID format');
    }

    if (citation.url && !citation.url.match(/^(https?|document):\/\//)) {
      errors.push('Invalid URL format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Count citations by type
   */
  static countCitationsByType(citations: ParsedCitation[]): Record<string, number> {
    const counts: Record<string, number> = {
      document: 0,
      web: 0,
      reference: 0,
      unknown: 0,
      total: citations.length,
    };

    for (const citation of citations) {
      counts[citation.type] = (counts[citation.type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Build inline citation segments from text and citations
   * Note: Citation positions should be relative to the provided text
   */
  static buildInlineCitationSegments(
    text: string,
    citations: ParsedCitation[],
    sources?: Array<{ type: 'document' | 'web'; title: string; url?: string; documentId?: string; index?: number }>
  ): import('../types/citation').InlineCitationResult {
    const segments: import('../types/citation').InlineCitationSegment[] = [];
    const inlineCitations: import('../types/citation').InlineCitation[] = [];
    const sourceMap = new Map<number, string>();

    // Sort citations by position
    const sortedCitations = [...citations].sort((a, b) => a.position.start - b.position.start);

    // Build source map if sources provided
    if (sources) {
      sources.forEach((source, idx) => {
        const sourceId = source.documentId || source.url || `source-${idx + 1}`;
        sourceMap.set(idx, sourceId);
      });
    }

    let currentIndex = 0;
    let citationIndex = 0;

    // Process text and citations
    while (currentIndex < text.length) {
      // Find next citation
      const nextCitation = sortedCitations[citationIndex];

      if (!nextCitation || currentIndex < nextCitation.position.start) {
        // Text segment before citation
        const segmentEnd = nextCitation ? nextCitation.position.start : text.length;
        const segmentText = text.substring(currentIndex, segmentEnd);

        if (segmentText.trim().length > 0) {
          segments.push({
            text: segmentText,
            startIndex: currentIndex,
            endIndex: segmentEnd,
            citations: [],
            sourceIds: [],
          });
        }

        currentIndex = segmentEnd;
      } else {
        // Citation found - create segment with citation
        const citationStart = nextCitation.position.start;
        const citationEnd = nextCitation.position.end;

        // Text before citation
        if (currentIndex < citationStart) {
          const beforeText = text.substring(currentIndex, citationStart);
          if (beforeText.trim().length > 0) {
            segments.push({
              text: beforeText,
              startIndex: currentIndex,
              endIndex: citationStart,
              citations: [],
              sourceIds: [],
            });
          }
        }

        // Find source index for this citation
        let sourceIndex = -1;
        if (sources) {
          if (nextCitation.type === 'document' && nextCitation.index !== undefined) {
            // Find document source by index (1-based to 0-based)
            sourceIndex = sources.findIndex(
              (s, idx) => s.type === 'document' && (nextCitation.index === idx + 1 || s.index === nextCitation.index)
            );
            if (sourceIndex === -1 && nextCitation.documentId) {
              sourceIndex = sources.findIndex(s => s.type === 'document' && s.documentId === nextCitation.documentId);
            }
          } else if (nextCitation.type === 'web' && nextCitation.index !== undefined) {
            // Find web source by index
            sourceIndex = sources.findIndex(
              (s, idx) => s.type === 'web' && (nextCitation.index === idx + 1 || s.index === nextCitation.index)
            );
            if (sourceIndex === -1 && nextCitation.url) {
              sourceIndex = sources.findIndex(s => s.type === 'web' && s.url === nextCitation.url);
            }
          }
        }

        // Create inline citation
        const inlineCitation: import('../types/citation').InlineCitation = {
          citationId: `citation-${inlineCitations.length + 1}`,
          citationFormat: nextCitation.format,
          sourceIndex: sourceIndex >= 0 ? sourceIndex : -1,
          sourceId: sourceIndex >= 0 ? sourceMap.get(sourceIndex) : undefined,
          sourceType: nextCitation.type === 'document' ? 'document' : nextCitation.type === 'web' ? 'web' : 'reference',
          position: {
            start: citationStart,
            end: citationEnd,
          },
          metadata: {
            documentId: nextCitation.documentId,
            url: nextCitation.url,
            name: nextCitation.name,
          },
        };

        inlineCitations.push(inlineCitation);

        // Get text segment that includes this citation
        // Find the end of the sentence or paragraph containing the citation
        let segmentEnd = citationEnd;
        const nextCitationAfter = sortedCitations[citationIndex + 1];
        if (nextCitationAfter) {
          // End at next citation or end of sentence
          const sentenceEnd = text.indexOf('.', citationEnd);
          const paragraphEnd = text.indexOf('\n\n', citationEnd);
          segmentEnd = Math.min(
            nextCitationAfter.position.start,
            sentenceEnd > 0 ? sentenceEnd + 1 : text.length,
            paragraphEnd > 0 ? paragraphEnd : text.length
          );
        } else {
          // Last citation - end at sentence or paragraph
          const sentenceEnd = text.indexOf('.', citationEnd);
          const paragraphEnd = text.indexOf('\n\n', citationEnd);
          segmentEnd = sentenceEnd > 0 ? sentenceEnd + 1 : paragraphEnd > 0 ? paragraphEnd : text.length;
        }

        const segmentText = text.substring(citationStart, segmentEnd);

        // Get source IDs for this segment
        const segmentSourceIds: string[] = [];
        if (sourceIndex >= 0) {
          const sourceId = sourceMap.get(sourceIndex);
          if (sourceId) {
            segmentSourceIds.push(sourceId);
          }
        }

        segments.push({
          text: segmentText,
          startIndex: citationStart,
          endIndex: segmentEnd,
          citations: [inlineCitation],
          sourceIds: segmentSourceIds,
        });

        currentIndex = segmentEnd;
        citationIndex++;
      }
    }

    return {
      segments,
      citations: inlineCitations,
      sourceMap,
      citationCount: inlineCitations.length,
      segmentCount: segments.length,
    };
  }
}
