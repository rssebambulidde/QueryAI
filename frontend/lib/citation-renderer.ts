import { Source } from './api';
import { CitationMatch } from '@/components/chat/inline-citation';
import { CitationStyle, CitationFormat } from './store/citation-preferences-store';

/**
 * Renders citations based on style and format preferences
 */
export class CitationRenderer {
  /**
   * Render citation in inline style
   */
  static renderInline(
    citation: CitationMatch,
    source: Source,
    citationNumber: number,
    format: CitationFormat = 'markdown'
  ): string {
    const number = citationNumber.toString();
    
    switch (format) {
      case 'html':
        return `<sup><a href="${source.url || '#'}" class="citation-inline" data-citation="${citation.sourceIndex}">${number}</a></sup>`;
      case 'plain':
        return `[${number}]`;
      case 'markdown':
      default:
        return `[${number}](${source.url || '#'} "citation:${citation.sourceIndex}")`;
    }
  }

  /**
   * Render citation in footnote style
   */
  static renderFootnote(
    citation: CitationMatch,
    source: Source,
    citationNumber: number,
    format: CitationFormat = 'markdown'
  ): string {
    const number = citationNumber.toString();
    
    switch (format) {
      case 'html':
        return `<sup><a href="#fn-${citation.sourceIndex}" id="ref-${citation.sourceIndex}" class="citation-footnote">${number}</a></sup>`;
      case 'plain':
        return `[${number}]`;
      case 'markdown':
      default:
        return `[^${number}]`;
    }
  }

  /**
   * Render citation in numbered style
   */
  static renderNumbered(
    citation: CitationMatch,
    source: Source,
    citationNumber: number,
    format: CitationFormat = 'markdown'
  ): string {
    const number = citationNumber.toString();
    
    switch (format) {
      case 'html':
        return `<span class="citation-numbered">[<a href="${source.url || '#'}" data-citation="${citation.sourceIndex}">${number}</a>]</span>`;
      case 'plain':
        return `[${number}]`;
      case 'markdown':
      default:
        return `[${number}](${source.url || '#'} "citation:${citation.sourceIndex}")`;
    }
  }

  /**
   * Render footnote content for footnote style
   */
  static renderFootnoteContent(
    citation: CitationMatch,
    source: Source,
    citationNumber: number,
    format: CitationFormat = 'markdown'
  ): string {
    const number = citationNumber.toString();
    const title = source.title || `Source ${number}`;
    const url = source.url || '#';
    
    switch (format) {
      case 'html':
        return `<li id="fn-${citation.sourceIndex}">${number}. <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a> <a href="#ref-${citation.sourceIndex}" class="reversefootnote" aria-label="Back to content">↩</a></li>`;
      case 'plain':
        return `${number}. ${title} - ${url}`;
      case 'markdown':
      default:
        return `[^${number}]: [${title}](${url})`;
    }
  }

  /**
   * Render citation based on style preference
   */
  static render(
    citation: CitationMatch,
    source: Source,
    citationNumber: number,
    style: CitationStyle,
    format: CitationFormat = 'markdown'
  ): string {
    switch (style) {
      case 'footnote':
        return this.renderFootnote(citation, source, citationNumber, format);
      case 'numbered':
        return this.renderNumbered(citation, source, citationNumber, format);
      case 'inline':
      default:
        return this.renderInline(citation, source, citationNumber, format);
    }
  }

  /**
   * Render all footnotes for footnote style
   */
  static renderFootnotes(
    citations: CitationMatch[],
    sources: Source[],
    citationNumbers: number[],
    format: CitationFormat = 'markdown'
  ): string {
    const footnoteItems: string[] = [];
    
    citationNumbers.forEach((num) => {
      // Find citation by matching the number
      const citation = citations.find(c => {
        const idx = citationNumbers.indexOf(c.number);
        return idx >= 0 && idx + 1 === num;
      });
      
      if (!citation) return;
      const source = sources[citation.sourceIndex];
      if (!source) return;
      
      footnoteItems.push(this.renderFootnoteContent(citation, source, num, format));
    });
    
    if (format === 'html') {
      return `<ol class="footnotes list-decimal list-inside space-y-2 text-sm text-gray-600">${footnoteItems.join('')}</ol>`;
    }
    
    if (format === 'plain') {
      return footnoteItems.join('\n');
    }
    
    // Markdown
    return footnoteItems.join('\n\n');
  }
}
