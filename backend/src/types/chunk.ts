/**
 * Enhanced chunk type definitions with paragraph and section boundary awareness
 */

/**
 * Section information extracted from document structure
 */
export interface SectionInfo {
  level: number; // Heading level (1-6 for HTML/markdown, or numeric for numbered sections)
  title: string; // Section title/header text
  index: number; // Section index within document
  startChar: number; // Character position where section starts
  endChar?: number; // Character position where section ends (if known)
}

/**
 * Paragraph information
 */
export interface ParagraphInfo {
  index: number; // Paragraph index within document
  startChar: number; // Character position where paragraph starts
  endChar: number; // Character position where paragraph ends
  sectionIndex?: number; // Index of parent section (if applicable)
}

/**
 * Enhanced text chunk with paragraph and section metadata
 */
export interface TextChunk {
  content: string;
  startChar: number;
  endChar: number;
  tokenCount: number;
  chunkIndex: number;
  // Enhanced metadata for boundary awareness
  section?: SectionInfo; // Section this chunk belongs to
  paragraphIndices?: number[]; // Indices of paragraphs included in this chunk
  startsAtParagraphBoundary?: boolean; // Whether chunk starts at paragraph boundary
  endsAtParagraphBoundary?: boolean; // Whether chunk ends at paragraph boundary
}

/**
 * Document structure information
 */
export interface DocumentStructure {
  sections: SectionInfo[];
  paragraphs: ParagraphInfo[];
  hasMarkdownHeaders: boolean;
  hasHtmlHeaders: boolean;
  hasNumberedSections: boolean;
}
