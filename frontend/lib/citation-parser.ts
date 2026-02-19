import { Source } from './api';
import { CitationMatch } from '@/components/chat/inline-citation';

/**
 * Single-pass citation parser.
 *
 * Patterns recognised:
 *   [Web Source 1], [Web Source 2](url)   → matched to the Nth web-type source
 *   [Document 1],   [Document 3](url)     → matched to the Nth document-type source
 *
 * Type-specific indexing: the LLM writes "[Web Source 2]" meaning "the 2nd
 * source whose type is 'web'", NOT the 2nd element of the flat sources array.
 *
 * Trailing "Sources: …" summary lines are stripped so they don't duplicate
 * the inline citations already rendered by the UI.
 */
export function parseCitations(content: string, sources: Source[]): {
  processedContent: string;
  citations: CitationMatch[];
} {
  const citations: CitationMatch[] = [];

  if (!sources || sources.length === 0) {
    return { processedContent: content, citations };
  }

  // Strip trailing "Sources:" summary lines to prevent duplicate rendering.
  // Require a leading newline so we don't accidentally match "web sources:" mid-sentence.
  const cleaned = content.replace(
    /\n+Sources:\s*(?:\[(?:Web Source|Document)\s+\d+\](?:\([^)]+\))?[\s,]*)+\s*$/gi,
    ''
  );

  // Pre-filter sources by type for correct N→source mapping
  const webSources = sources.filter(s => s.type === 'web');
  const docSources = sources.filter(s => s.type === 'document');

  const citationPattern = /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi;

  // Collect all matches
  const matches: Array<{ match: RegExpExecArray; index: number }> = [];
  let match;
  while ((match = citationPattern.exec(cleaned)) !== null) {
    matches.push({ match, index: match.index });
  }

  // Sort reverse for safe in-place string replacement
  matches.sort((a, b) => b.index - a.index);

  let processedContent = cleaned;

  matches.forEach(({ match: m, index }) => {
    const fullMatch = m[0];
    const type: 'web' | 'document' = m[1].toLowerCase().includes('web') ? 'web' : 'document';
    const number = parseInt(m[2], 10);
    const typeFiltered = type === 'web' ? webSources : docSources;
    const typeIndex = number - 1; // 1-based → 0-based within type

    if (typeIndex >= 0 && typeIndex < typeFiltered.length) {
      const source = typeFiltered[typeIndex];
      const globalIndex = sources.indexOf(source);

      const citation: CitationMatch = {
        type,
        number,
        index,
        sourceIndex: globalIndex,
        fullMatch,
      };

      const placeholder = `__CITATION_${citations.length}__`;
      citations.push(citation);

      processedContent =
        processedContent.substring(0, index) +
        placeholder +
        processedContent.substring(index + fullMatch.length);
    }
  });

  // Restore original order by position
  citations.sort((a, b) => a.index - b.index);

  return { processedContent, citations };
}

/**
 * Splits content into parts with citation placeholders
 * Returns array of { type: 'text' | 'citation', content: string, citation?: CitationMatch }
 */
export interface ContentPart {
  type: 'text' | 'citation';
  content: string;
  citation?: CitationMatch;
}

export function splitContentWithCitations(
  content: string,
  sources: Source[]
): ContentPart[] {
  if (!sources || sources.length === 0) {
    return [{ type: 'text', content }];
  }

  const { processedContent, citations } = parseCitations(content, sources);

  if (citations.length === 0) {
    return [{ type: 'text', content: processedContent }];
  }

  const parts: ContentPart[] = [];
  let lastIndex = 0;

  // Sort citations by position
  const sortedCitations = [...citations].sort((a, b) => a.index - b.index);

  sortedCitations.forEach((citation, idx) => {
    const placeholder = `__CITATION_${idx}__`;
    const placeholderIndex = processedContent.indexOf(placeholder, lastIndex);

    if (placeholderIndex !== -1) {
      // Add text before citation
      if (placeholderIndex > lastIndex) {
        const textBefore = processedContent.substring(lastIndex, placeholderIndex);
        if (textBefore) {
          parts.push({ type: 'text', content: textBefore });
        }
      }

      // Add citation placeholder
      const source = sources[citation.sourceIndex];
      if (source) {
        parts.push({ type: 'citation', content: placeholder, citation });
      }

      lastIndex = placeholderIndex + placeholder.length;
    }
  });

  // Add remaining text
  if (lastIndex < processedContent.length) {
    const remainingText = processedContent.substring(lastIndex);
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }
  }

  return parts;
}

/**
 * Groups citations by number for footnote-style rendering
 */
export function groupCitationsByNumber(citations: CitationMatch[]): Map<number, CitationMatch[]> {
  const grouped = new Map<number, CitationMatch[]>();

  citations.forEach((citation) => {
    if (!grouped.has(citation.number)) {
      grouped.set(citation.number, []);
    }
    grouped.get(citation.number)!.push(citation);
  });

  return grouped;
}

/**
 * Extracts unique citation numbers in order of appearance
 */
export function getCitationNumbers(citations: CitationMatch[]): number[] {
  const seen = new Set<number>();
  const numbers: number[] = [];

  citations.forEach((citation) => {
    if (!seen.has(citation.number)) {
      seen.add(citation.number);
      numbers.push(citation.number);
    }
  });

  return numbers;
}
