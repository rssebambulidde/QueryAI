import logger from '../config/logger';
import { SectionInfo, ParagraphInfo, DocumentStructure } from '../types/chunk';

/**
 * Boundary Detection Service
 * Detects paragraph and section boundaries in text documents
 */
export class BoundaryDetectionService {
  /**
   * Detect paragraph boundaries
   * Supports:
   * - Double newlines (common in plain text)
   * - HTML paragraph tags (<p>, </p>)
   * - Markdown paragraph breaks (double newlines)
   */
  static detectParagraphs(text: string): ParagraphInfo[] {
    const paragraphs: ParagraphInfo[] = [];
    let currentIndex = 0;
    let paragraphIndex = 0;

    // First, try to detect HTML paragraph tags
    const htmlParagraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let htmlMatch: RegExpExecArray | null;

    // Check if text contains HTML
    const hasHtml = /<[a-z][\s\S]*>/i.test(text);

    if (hasHtml) {
      // Extract paragraphs from HTML
      while ((htmlMatch = htmlParagraphRegex.exec(text)) !== null) {
        const paragraphText = htmlMatch[1].trim();
        if (paragraphText.length > 0) {
          const startChar = htmlMatch.index;
          const endChar = htmlMatch.index + htmlMatch[0].length;

          paragraphs.push({
            index: paragraphIndex++,
            startChar,
            endChar,
          });
        }
      }
    }

    // If no HTML paragraphs found, use double newline detection
    if (paragraphs.length === 0) {
      // Split by double newlines (paragraph breaks)
      const paragraphRegex = /\n\s*\n+/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = paragraphRegex.exec(text)) !== null) {
        // Paragraph from lastIndex to match.index
        const paragraphText = text.substring(lastIndex, match.index).trim();
        if (paragraphText.length > 0) {
          paragraphs.push({
            index: paragraphIndex++,
            startChar: lastIndex,
            endChar: match.index,
          });
        }
        lastIndex = match.index + match[0].length;
      }

      // Add final paragraph
      if (lastIndex < text.length) {
        const paragraphText = text.substring(lastIndex).trim();
        if (paragraphText.length > 0) {
          paragraphs.push({
            index: paragraphIndex++,
            startChar: lastIndex,
            endChar: text.length,
          });
        }
      }
    }

    // If still no paragraphs found, treat entire text as one paragraph
    if (paragraphs.length === 0 && text.trim().length > 0) {
      paragraphs.push({
        index: 0,
        startChar: 0,
        endChar: text.length,
      });
    }

    return paragraphs;
  }

  /**
   * Detect section headers
   * Supports:
   * - Markdown headers (# ## ### etc.)
   * - HTML headings (h1-h6)
   * - Numbered sections (1. 1.1 1.1.1 etc.)
   */
  static detectSections(text: string): SectionInfo[] {
    const sections: SectionInfo[] = [];
    let sectionIndex = 0;

    // Detect Markdown headers (# ## ### #### ##### ######)
    const markdownHeaderRegex = /^(#{1,6})\s+(.+)$/gm;
    let markdownMatch: RegExpExecArray | null;

    while ((markdownMatch = markdownHeaderRegex.exec(text)) !== null) {
      const level = markdownMatch[1].length;
      const title = markdownMatch[2].trim();
      const startChar = markdownMatch.index;

      sections.push({
        level,
        title,
        index: sectionIndex++,
        startChar,
      });
    }

    // Detect HTML headings (h1-h6)
    const htmlHeadingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let htmlMatch: RegExpExecArray | null;

    while ((htmlMatch = htmlHeadingRegex.exec(text)) !== null) {
      const level = parseInt(htmlMatch[1].substring(1)); // Extract number from h1, h2, etc.
      const title = htmlMatch[2].trim().replace(/<[^>]+>/g, ''); // Remove any nested HTML tags
      const startChar = htmlMatch.index;

      sections.push({
        level,
        title,
        index: sectionIndex++,
        startChar,
      });
    }

    // Detect numbered sections (1. 1.1 1.1.1 etc.)
    // This pattern matches numbered sections at the start of lines
    const numberedSectionRegex = /^(\d+(?:\.\d+)*)\s+(.+)$/gm;
    let numberedMatch: RegExpExecArray | null;

    while ((numberedMatch = numberedSectionRegex.exec(text)) !== null) {
      const numberParts = numberedMatch[1].split('.');
      const level = numberParts.length; // Level based on number of parts (1. = 1, 1.1 = 2, etc.)
      const title = numberedMatch[2].trim();
      const startChar = numberedMatch.index;

      // Only add if it's not already captured as markdown/HTML
      const isDuplicate = sections.some(
        (s) => Math.abs(s.startChar - startChar) < 10 && s.title === title
      );

      if (!isDuplicate) {
        sections.push({
          level,
          title,
          index: sectionIndex++,
          startChar,
        });
      }
    }

    // Sort sections by start position
    sections.sort((a, b) => a.startChar - b.startChar);

    // Set end positions (next section start or end of document)
    for (let i = 0; i < sections.length; i++) {
      if (i < sections.length - 1) {
        sections[i].endChar = sections[i + 1].startChar;
      } else {
        sections[i].endChar = text.length;
      }
    }

    return sections;
  }

  /**
   * Get complete document structure
   */
  static detectDocumentStructure(text: string): DocumentStructure {
    const paragraphs = this.detectParagraphs(text);
    const sections = this.detectSections(text);

    // Link paragraphs to sections
    const paragraphsWithSections = paragraphs.map((para) => {
      // Find the section this paragraph belongs to
      const parentSection = sections.find(
        (section) =>
          para.startChar >= section.startChar &&
          para.startChar < (section.endChar || text.length)
      );

      return {
        ...para,
        sectionIndex: parentSection?.index,
      };
    });

    // Detect structure type
    const hasMarkdownHeaders = /^#{1,6}\s+/m.test(text);
    const hasHtmlHeaders = /<h[1-6][^>]*>/i.test(text);
    const hasNumberedSections = /^\d+(?:\.\d+)*\s+/m.test(text);

    logger.debug('Document structure detected', {
      paragraphCount: paragraphs.length,
      sectionCount: sections.length,
      hasMarkdownHeaders,
      hasHtmlHeaders,
      hasNumberedSections,
    });

    return {
      sections,
      paragraphs: paragraphsWithSections,
      hasMarkdownHeaders,
      hasHtmlHeaders,
      hasNumberedSections,
    };
  }

  /**
   * Find which section a character position belongs to
   */
  static findSectionAtPosition(
    sections: SectionInfo[],
    charPosition: number
  ): SectionInfo | undefined {
    return sections.find(
      (section) =>
        charPosition >= section.startChar &&
        charPosition < (section.endChar || Infinity)
    );
  }

  /**
   * Find which paragraph(s) a character range belongs to
   */
  static findParagraphsInRange(
    paragraphs: ParagraphInfo[],
    startChar: number,
    endChar: number
  ): ParagraphInfo[] {
    return paragraphs.filter(
      (para) =>
        (para.startChar >= startChar && para.startChar < endChar) ||
        (para.endChar > startChar && para.endChar <= endChar) ||
        (para.startChar <= startChar && para.endChar >= endChar)
    );
  }

  /**
   * Check if a position is at a paragraph boundary
   */
  static isParagraphBoundary(
    paragraphs: ParagraphInfo[],
    charPosition: number
  ): boolean {
    return paragraphs.some(
      (para) => para.startChar === charPosition || para.endChar === charPosition
    );
  }

  /**
   * Check if a position is at a section boundary
   */
  static isSectionBoundary(
    sections: SectionInfo[],
    charPosition: number
  ): boolean {
    return sections.some(
      (section) =>
        section.startChar === charPosition ||
        section.endChar === charPosition
    );
  }
}
