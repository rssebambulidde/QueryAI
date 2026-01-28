import { Source } from './api';
import { CitationMatch } from '@/components/chat/inline-citation';

/**
 * Parses citations from markdown/text content
 * Supports patterns like:
 * - [Web Source 1]
 * - [Document 2]
 * - [Web Source 1](url)
 * - [Document 3](url)
 */
export function parseCitations(content: string, sources: Source[]): {
  processedContent: string;
  citations: CitationMatch[];
} {
  const citations: CitationMatch[] = [];
  const citationPattern = /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi;
  
  // Find all citations and their positions
  const matches: Array<{
    match: RegExpMatchArray;
    index: number;
  }> = [];
  
  let match;
  while ((match = citationPattern.exec(content)) !== null) {
    matches.push({
      match,
      index: match.index,
    });
  }

  // Sort matches by position (reverse order for safe replacement)
  matches.sort((a, b) => b.index - a.index);

  // Replace citations with placeholders
  let processedContent = content;
  const placeholders: Map<string, CitationMatch> = new Map();

  matches.forEach(({ match, index }) => {
    const fullMatch = match[0];
    const type = match[1].toLowerCase().includes('web') ? 'web' : 'document';
    const number = parseInt(match[2], 10);
    const sourceIndex = number - 1;

    // Validate source exists
    if (sourceIndex >= 0 && sourceIndex < sources.length) {
      const source = sources[sourceIndex];
      if (source && source.type === type) {
        const citation: CitationMatch = {
          type,
          number,
          index,
          sourceIndex,
          fullMatch,
        };

        const placeholder = `__CITATION_${citations.length}__`;
        placeholders.set(placeholder, citation);
        citations.push(citation);

        // Replace in reverse order to maintain indices
        processedContent =
          processedContent.substring(0, index) +
          placeholder +
          processedContent.substring(index + fullMatch.length);
      }
    }
  });

  // Sort citations by original position
  citations.sort((a, b) => a.index - b.index);

  return {
    processedContent,
    citations,
  };
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
