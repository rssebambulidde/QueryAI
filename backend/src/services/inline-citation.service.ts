/**
 * Inline Citation Service
 * Tracks which parts of answer cite which sources
 * Links answer segments to sources
 */

import { ParsedCitation } from './citation-parser.service';
import { Source } from './ai.service';
import {
  InlineCitationData,
  AnswerSegment,
  InlineCitation,
  CitationLinkingOptions,
  DEFAULT_CITATION_LINKING_OPTIONS,
} from '../types/citation';
import logger from '../config/logger';

/**
 * Inline Citation Service
 */
export class InlineCitationService {
  /**
   * Create inline citation data structure from answer and parsed citations
   */
  static createInlineCitationData(
    answer: string,
    parsedCitations: ParsedCitation[],
    sources?: Source[],
    options: CitationLinkingOptions = {}
  ): InlineCitationData {
    const startTime = Date.now();
    const opts = { ...DEFAULT_CITATION_LINKING_OPTIONS, ...options };

    try {
      // Build source index maps for fast lookup
      const sourceMap = this.buildSourceMap(sources || []);

      // Create inline citations with source matching
      const inlineCitations = this.createInlineCitations(parsedCitations, sourceMap);

      // Segment answer and link citations
      const segments = this.segmentAnswer(answer, inlineCitations, opts);

      // Build citation map
      const citationMap = this.buildCitationMap(inlineCitations);

      const segmentsWithCitations = segments.filter(s => s.hasCitation).length;
      const segmentsWithoutCitations = segments.length - segmentsWithCitations;

      const processingTime = Date.now() - startTime;

      logger.debug('Inline citation data created', {
        answerLength: answer.length,
        citationCount: inlineCitations.length,
        segmentCount: segments.length,
        segmentsWithCitations,
        segmentsWithoutCitations,
        processingTimeMs: processingTime,
      });

      return {
        answer,
        segments,
        citations: inlineCitations,
        citationMap,
        totalSegments: segments.length,
        segmentsWithCitations,
        segmentsWithoutCitations,
      };
    } catch (error: any) {
      logger.error('Error creating inline citation data', {
        error: error.message,
        answerLength: answer.length,
        citationCount: parsedCitations.length,
      });

      // Return empty structure on error
      return {
        answer,
        segments: [{ text: answer, startIndex: 0, endIndex: answer.length, citations: [], hasCitation: false }],
        citations: [],
        citationMap: new Map(),
        totalSegments: 1,
        segmentsWithCitations: 0,
        segmentsWithoutCitations: 1,
      };
    }
  }

  /**
   * Build source map for fast lookup
   */
  private static buildSourceMap(sources: Source[]): Map<string, { source: Source; index: number }> {
    const map = new Map<string, { source: Source; index: number }>();

    sources.forEach((source, idx) => {
      // Index by document ID
      if (source.documentId) {
        map.set(`doc:${source.documentId}`, { source, index: idx });
      }

      // Index by URL
      if (source.url) {
        map.set(`url:${source.url}`, { source, index: idx });
      }

      // Index by type and index (1-based)
      const sourceIndex = idx + 1;
      if (source.type === 'document') {
        map.set(`doc-index:${sourceIndex}`, { source, index: idx });
      } else if (source.type === 'web') {
        map.set(`web-index:${sourceIndex}`, { source, index: idx });
      }
    });

    return map;
  }

  /**
   * Create inline citations with source matching
   */
  private static createInlineCitations(
    parsedCitations: ParsedCitation[],
    sourceMap: Map<string, { source: Source; index: number }>
  ): InlineCitation[] {
    const inlineCitations: InlineCitation[] = [];

    for (const citation of parsedCitations) {
      let matchedSource: { source: Source; index: number } | undefined;
      let confidence: 'exact' | 'fuzzy' | 'unknown' = 'unknown';

      // Try to match citation to source
      if (citation.type === 'document') {
        // Try by document ID
        if (citation.documentId) {
          matchedSource = sourceMap.get(`doc:${citation.documentId}`);
          if (matchedSource) {
            confidence = 'exact';
          }
        }

        // Try by index
        if (!matchedSource && citation.index !== undefined) {
          matchedSource = sourceMap.get(`doc-index:${citation.index}`);
          if (matchedSource) {
            confidence = 'exact';
          }
        }

        // Try fuzzy match by name
        if (!matchedSource && citation.name) {
          for (const [key, value] of sourceMap.entries()) {
            if (key.startsWith('doc:') || key.startsWith('doc-index:')) {
              const sourceTitle = value.source.title?.toLowerCase() || '';
              const citationName = citation.name.toLowerCase();
              if (sourceTitle.includes(citationName) || citationName.includes(sourceTitle)) {
                matchedSource = value;
                confidence = 'fuzzy';
                break;
              }
            }
          }
        }
      } else if (citation.type === 'web') {
        // Try by URL
        if (citation.url) {
          matchedSource = sourceMap.get(`url:${citation.url}`);
          if (matchedSource) {
            confidence = 'exact';
          }
        }

        // Try by index
        if (!matchedSource && citation.index !== undefined) {
          matchedSource = sourceMap.get(`web-index:${citation.index}`);
          if (matchedSource) {
            confidence = 'exact';
          }
        }

        // Try fuzzy match by name/URL
        if (!matchedSource && citation.name) {
          for (const [key, value] of sourceMap.entries()) {
            if (key.startsWith('url:') || key.startsWith('web-index:')) {
              const sourceTitle = value.source.title?.toLowerCase() || '';
              const sourceUrl = value.source.url?.toLowerCase() || '';
              const citationName = citation.name.toLowerCase();
              if (
                sourceTitle.includes(citationName) ||
                citationName.includes(sourceTitle) ||
                sourceUrl.includes(citationName)
              ) {
                matchedSource = value;
                confidence = 'fuzzy';
                break;
              }
            }
          }
        }
      }

      inlineCitations.push({
        citation,
        source: matchedSource?.source,
        sourceIndex: matchedSource?.index,
        confidence,
        position: citation.position,
      });
    }

    return inlineCitations;
  }

  /**
   * Segment answer and link citations to segments
   */
  private static segmentAnswer(
    answer: string,
    inlineCitations: InlineCitation[],
    options: Required<CitationLinkingOptions>
  ): AnswerSegment[] {
    const segments: AnswerSegment[] = [];

    if (options.segmentByParagraphs) {
      // Segment by paragraphs
      const paragraphs = answer.split(/\n\n+/).filter(p => p.trim().length > 0);
      let currentIndex = 0;

      for (const paragraph of paragraphs) {
        const startIndex = answer.indexOf(paragraph, currentIndex);
        const endIndex = startIndex + paragraph.length;

        // Find citations in this paragraph
        const segmentCitations = inlineCitations.filter(
          citation =>
            citation.position.start >= startIndex &&
            citation.position.end <= endIndex
        );

        // Include adjacent citations if enabled
        const allCitations = options.includeAdjacentCitations
          ? [
              ...segmentCitations,
              ...inlineCitations.filter(
                citation =>
                  (citation.position.start >= startIndex - options.citationRange &&
                    citation.position.start < startIndex) ||
                  (citation.position.end > endIndex &&
                    citation.position.end <= endIndex + options.citationRange)
              ),
            ]
          : segmentCitations;

        // Remove duplicates
        const uniqueCitations = this.deduplicateCitations(allCitations);

        segments.push({
          text: paragraph.trim(),
          startIndex,
          endIndex,
          citations: uniqueCitations,
          hasCitation: uniqueCitations.length > 0,
        });

        currentIndex = endIndex;
      }
    } else if (options.segmentBySentences) {
      // Segment by sentences
      const sentences = answer.split(/([.!?]+[\s\n]+)/).filter(s => s.trim().length > 0);
      let currentIndex = 0;

      for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const punctuation = sentences[i + 1] || '';
        const fullSentence = sentence + punctuation;

        const startIndex = answer.indexOf(fullSentence, currentIndex);
        const endIndex = startIndex + fullSentence.length;

        // Find citations in this sentence
        const segmentCitations = inlineCitations.filter(
          citation =>
            citation.position.start >= startIndex &&
            citation.position.end <= endIndex
        );

        // Include adjacent citations if enabled
        const allCitations = options.includeAdjacentCitations
          ? [
              ...segmentCitations,
              ...inlineCitations.filter(
                citation =>
                  (citation.position.start >= startIndex - options.citationRange &&
                    citation.position.start < startIndex) ||
                  (citation.position.end > endIndex &&
                    citation.position.end <= endIndex + options.citationRange)
              ),
            ]
          : segmentCitations;

        // Remove duplicates
        const uniqueCitations = this.deduplicateCitations(allCitations);

        // Filter by segment length
        if (fullSentence.trim().length >= options.minSegmentLength) {
          segments.push({
            text: fullSentence.trim(),
            startIndex,
            endIndex,
            citations: uniqueCitations,
            hasCitation: uniqueCitations.length > 0,
          });
        }

        currentIndex = endIndex;
      }
    } else {
      // Single segment (entire answer)
      segments.push({
        text: answer,
        startIndex: 0,
        endIndex: answer.length,
        citations: inlineCitations,
        hasCitation: inlineCitations.length > 0,
      });
    }

    return segments;
  }

  /**
   * Build citation map for fast lookup
   */
  private static buildCitationMap(
    inlineCitations: InlineCitation[]
  ): Map<number, InlineCitation[]> {
    const map = new Map<number, InlineCitation[]>();

    for (const citation of inlineCitations) {
      const position = citation.position.start;
      if (!map.has(position)) {
        map.set(position, []);
      }
      map.get(position)!.push(citation);
    }

    return map;
  }

  /**
   * Remove duplicate citations
   */
  private static deduplicateCitations(citations: InlineCitation[]): InlineCitation[] {
    const seen = new Set<string>();
    const unique: InlineCitation[] = [];

    for (const citation of citations) {
      const key = `${citation.citation.position.start}-${citation.citation.position.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(citation);
      }
    }

    return unique;
  }

  /**
   * Format answer with inline citations
   */
  static formatAnswerWithInlineCitations(data: InlineCitationData): string {
    const parts: string[] = [];

    for (const segment of data.segments) {
      let segmentText = segment.text;

      // Add citation markers if segment has citations
      if (segment.hasCitation && segment.citations.length > 0) {
        const citationMarkers = segment.citations
          .map((citation, idx) => {
            const citationText = citation.citation.format;
            return `[${idx + 1}]${citationText}`;
          })
          .join(' ');

        segmentText += ` ${citationMarkers}`;
      }

      parts.push(segmentText);
    }

    return parts.join(' ');
  }

  /**
   * Get citations for a specific position in answer
   */
  static getCitationsAtPosition(
    data: InlineCitationData,
    position: number
  ): InlineCitation[] {
    // Find exact match
    const exactMatch = data.citationMap.get(position);
    if (exactMatch) {
      return exactMatch;
    }

    // Find nearest citation
    let nearestCitation: InlineCitation | null = null;
    let minDistance = Infinity;

    for (const citation of data.citations) {
      const distance = Math.abs(citation.position.start - position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCitation = citation;
      }
    }

    return nearestCitation ? [nearestCitation] : [];
  }

  /**
   * Get all sources cited in answer
   */
  static getCitedSources(data: InlineCitationData): Source[] {
    const sourceSet = new Set<Source>();
    const sourceArray: Source[] = [];

    for (const citation of data.citations) {
      if (citation.source && !sourceSet.has(citation.source)) {
        sourceSet.add(citation.source);
        sourceArray.push(citation.source);
      }
    }

    return sourceArray;
  }

  /**
   * Get citation statistics
   */
  static getCitationStatistics(data: InlineCitationData): {
    totalCitations: number;
    uniqueSources: number;
    segmentsWithCitations: number;
    segmentsWithoutCitations: number;
    citationCoverage: number; // Percentage of answer covered by citations
  } {
    const citedSources = this.getCitedSources(data);
    const totalLength = data.answer.length;
    let citedLength = 0;

    for (const segment of data.segments) {
      if (segment.hasCitation) {
        citedLength += segment.endIndex - segment.startIndex;
      }
    }

    const citationCoverage = totalLength > 0 ? (citedLength / totalLength) * 100 : 0;

    return {
      totalCitations: data.citations.length,
      uniqueSources: citedSources.length,
      segmentsWithCitations: data.segmentsWithCitations,
      segmentsWithoutCitations: data.segmentsWithoutCitations,
      citationCoverage: Math.round(citationCoverage * 100) / 100,
    };
  }
}
