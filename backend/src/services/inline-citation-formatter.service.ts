/**
 * Inline Citation Formatter Service
 * Formats inline citations for display
 */

import { InlineCitationSegment, InlineCitation, InlineCitationFormatOptions } from '../types/citation';
import logger from '../config/logger';

/**
 * Inline Citation Formatter Service
 */
export class InlineCitationFormatterService {
  /**
   * Format inline citations for display
   */
  static formatInlineCitations(
    segments: InlineCitationSegment[],
    options: InlineCitationFormatOptions = { format: 'markdown' }
  ): string {
    try {
      switch (options.format) {
        case 'markdown':
          return this.formatMarkdown(segments, options);
        case 'html':
          return this.formatHTML(segments, options);
        case 'plain':
          return this.formatPlain(segments, options);
        case 'structured':
          return this.formatStructured(segments, options);
        default:
          return this.formatMarkdown(segments, options);
      }
    } catch (error: any) {
      logger.error('Error formatting inline citations', {
        error: error.message,
      });
      // Fallback to plain text
      return segments.map(s => s.text).join('');
    }
  }

  /**
   * Format as markdown
   */
  private static formatMarkdown(
    segments: InlineCitationSegment[],
    options: InlineCitationFormatOptions
  ): string {
    const parts: string[] = [];

    for (const segment of segments) {
      let segmentText = segment.text;

      // Add citations to segment text
      if (segment.citations.length > 0 && options.linkCitations !== false) {
        const citationLinks = segment.citations.map(citation => {
          if (citation.sourceIndex >= 0) {
            // Create clickable citation link
            const citationText = citation.citationFormat;
            if (citation.metadata?.url) {
              return `[${citationText}](${citation.metadata.url})`;
            } else if (citation.metadata?.documentId) {
              return `[${citationText}](document://${citation.metadata.documentId})`;
            }
            return citationText;
          }
          return citation.citationFormat;
        });

        // Append citations to segment
        segmentText += ' ' + citationLinks.join(' ');
      } else if (segment.citations.length > 0) {
        // Just append citation format
        const citationTexts = segment.citations.map(c => c.citationFormat);
        segmentText += ' ' + citationTexts.join(' ');
      }

      parts.push(segmentText);
    }

    return parts.join('');
  }

  /**
   * Format as HTML
   */
  private static formatHTML(
    segments: InlineCitationSegment[],
    options: InlineCitationFormatOptions
  ): string {
    const parts: string[] = [];

    for (const segment of segments) {
      let segmentText = this.escapeHTML(segment.text);

      // Add citations as HTML links
      if (segment.citations.length > 0) {
        const citationLinks = segment.citations.map(citation => {
          const citationText = this.escapeHTML(citation.citationFormat);
          
          if (options.linkCitations !== false) {
            if (citation.metadata?.url) {
              return `<a href="${this.escapeHTML(citation.metadata.url)}" class="citation-link" data-source-index="${citation.sourceIndex}">${citationText}</a>`;
            } else if (citation.metadata?.documentId) {
              return `<a href="document://${this.escapeHTML(citation.metadata.documentId)}" class="citation-link citation-document" data-source-index="${citation.sourceIndex}">${citationText}</a>`;
            }
          }
          
          return `<span class="citation" data-source-index="${citation.sourceIndex}">${citationText}</span>`;
        });

        segmentText += ' ' + citationLinks.join(' ');
      }

      parts.push(segmentText);
    }

    return parts.join('');
  }

  /**
   * Format as plain text
   */
  private static formatPlain(
    segments: InlineCitationSegment[],
    options: InlineCitationFormatOptions
  ): string {
    return segments.map(segment => {
      let text = segment.text;
      if (segment.citations.length > 0) {
        const citations = segment.citations.map(c => c.citationFormat).join(' ');
        text += ' ' + citations;
      }
      return text;
    }).join('');
  }

  /**
   * Format as structured JSON
   */
  private static formatStructured(
    segments: InlineCitationSegment[],
    options: InlineCitationFormatOptions
  ): string {
    return JSON.stringify({
      segments: segments.map(segment => ({
        text: segment.text,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        citations: segment.citations.map(citation => ({
          citationId: citation.citationId,
          citationFormat: citation.citationFormat,
          sourceIndex: citation.sourceIndex,
          sourceId: citation.sourceId,
          sourceType: citation.sourceType,
          metadata: citation.metadata,
        })),
        sourceIds: segment.sourceIds,
      })),
    }, null, 2);
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format citation links for display
   */
  static formatCitationLinks(
    citations: InlineCitation[],
    sources?: Array<{ type: 'document' | 'web'; title: string; url?: string; documentId?: string; index?: number }>
  ): Array<{ citation: InlineCitation; source?: any; link: string }> {
    return citations.map(citation => {
      let source = undefined;
      if (citation.sourceIndex >= 0 && sources && sources[citation.sourceIndex]) {
        source = sources[citation.sourceIndex];
      }

      let link = citation.citationFormat;
      if (citation.metadata?.url) {
        link = `[${citation.citationFormat}](${citation.metadata.url})`;
      } else if (citation.metadata?.documentId) {
        link = `[${citation.citationFormat}](document://${citation.metadata.documentId})`;
      }

      return {
        citation,
        source,
        link,
      };
    });
  }

  /**
   * Get citation coverage (percentage of answer with citations)
   */
  static getCitationCoverage(
    segments: InlineCitationSegment[],
    totalLength: number
  ): number {
    if (totalLength === 0) {
      return 0;
    }

    let citedLength = 0;
    for (const segment of segments) {
      if (segment.citations.length > 0) {
        citedLength += segment.endIndex - segment.startIndex;
      }
    }

    return (citedLength / totalLength) * 100;
  }

  /**
   * Get segments by source
   */
  static getSegmentsBySource(
    segments: InlineCitationSegment[],
    sourceIndex: number
  ): InlineCitationSegment[] {
    return segments.filter(segment =>
      segment.citations.some(citation => citation.sourceIndex === sourceIndex)
    );
  }
}
