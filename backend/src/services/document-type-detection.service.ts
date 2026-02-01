import logger from '../config/logger';

/**
 * Document type classification
 */
export type DocumentType = 'pdf' | 'docx' | 'text' | 'code' | 'markdown' | 'html' | 'unknown';

/**
 * Document type detection service
 * Analyzes text content and file metadata to determine document type
 */
export class DocumentTypeDetectionService {
  /**
   * Detect document type from file extension and content
   */
  static detectDocumentType(
    filename?: string,
    fileType?: string,
    content?: string
  ): DocumentType {
    // First, try to detect from file extension/type
    if (filename || fileType) {
      const extension = this.getFileExtension(filename || fileType || '');
      const typeFromExtension = this.detectFromExtension(extension);
      
      if (typeFromExtension !== 'unknown') {
        return typeFromExtension;
      }
    }

    // If we have content, analyze it
    if (content) {
      return this.detectFromContent(content);
    }

    return 'unknown';
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
    return '';
  }

  /**
   * Detect document type from file extension
   */
  private static detectFromExtension(extension: string): DocumentType {
    const extensionMap: Record<string, DocumentType> = {
      // PDF
      'pdf': 'pdf',
      
      // Word documents
      'docx': 'docx',
      'doc': 'docx',
      
      // Text files
      'txt': 'text',
      'text': 'text',
      
      // Code files
      'js': 'code',
      'ts': 'code',
      'jsx': 'code',
      'tsx': 'code',
      'py': 'code',
      'java': 'code',
      'cpp': 'code',
      'c': 'code',
      'cs': 'code',
      'go': 'code',
      'rs': 'code',
      'rb': 'code',
      'php': 'code',
      'swift': 'code',
      'kt': 'code',
      'scala': 'code',
      'sh': 'code',
      'bash': 'code',
      'zsh': 'code',
      'fish': 'code',
      'sql': 'code',
      'html': 'html',
      'htm': 'html',
      'xml': 'html',
      'css': 'code',
      'scss': 'code',
      'sass': 'code',
      'less': 'code',
      'json': 'code',
      'yaml': 'code',
      'yml': 'code',
      'toml': 'code',
      'ini': 'code',
      'conf': 'code',
      'config': 'code',
      'md': 'markdown',
      'markdown': 'markdown',
      'mdown': 'markdown',
      'mkd': 'markdown',
    };

    return extensionMap[extension] || 'unknown';
  }

  /**
   * Detect document type from content analysis
   */
  private static detectFromContent(content: string): DocumentType {
    const text = content.trim();
    
    if (text.length === 0) {
      return 'unknown';
    }

    // Check for code patterns
    if (this.isCodeContent(text)) {
      return 'code';
    }

    // Check for HTML
    if (this.isHtmlContent(text)) {
      return 'html';
    }

    // Check for Markdown
    if (this.isMarkdownContent(text)) {
      return 'markdown';
    }

    // Default to text
    return 'text';
  }

  /**
   * Check if content appears to be code
   */
  private static isCodeContent(text: string): boolean {
    // Code indicators:
    // - High density of special characters (brackets, operators)
    // - Function definitions
    // - Variable declarations
    // - Import/require statements
    // - Comments (//, /*, #, --)
    
    const codePatterns = [
      /\b(function|def|class|interface|import|export|require|const|let|var)\s+/,
      /[{}[\]]{2,}/, // Multiple brackets
      /\/\/|\/\*|#\s|--\s/, // Comments
      /=>|->|::/, // Operators
      /;\s*$/, // Semicolons at end of lines
    ];

    const matches = codePatterns.filter(pattern => pattern.test(text));
    
    // If multiple code patterns match, likely code
    if (matches.length >= 2) {
      return true;
    }

    // Check for high density of operators/brackets
    const specialCharCount = (text.match(/[{}[\](),;=+\-*/%<>!&|]/g) || []).length;
    const specialCharRatio = specialCharCount / text.length;
    
    // Code typically has > 5% special characters
    if (specialCharRatio > 0.05 && text.length > 100) {
      return true;
    }

    return false;
  }

  /**
   * Check if content appears to be HTML
   */
  private static isHtmlContent(text: string): boolean {
    // HTML indicators:
    // - HTML tags
    // - DOCTYPE declaration
    // - HTML structure
    
    const htmlPatterns = [
      /<!DOCTYPE\s+html/i,
      /<html[\s>]/i,
      /<head[\s>]/i,
      /<body[\s>]/i,
      /<[a-z][\s\S]*>/i, // HTML tags
    ];

    return htmlPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if content appears to be Markdown
   */
  private static isMarkdownContent(text: string): boolean {
    // Markdown indicators:
    // - Headers (# ## ###)
    // - Lists (-, *, 1.)
    // - Links [text](url)
    // - Images ![alt](url)
    // - Code blocks ```
    // - Bold/italic **text** or *text*
    
    const markdownPatterns = [
      /^#{1,6}\s+.+$/m, // Headers
      /^\s*[-*+]\s+/m, // Unordered lists
      /^\s*\d+\.\s+/m, // Ordered lists
      /\[.+\]\(.+\)/, // Links
      /!\[.+\]\(.+\)/, // Images
      /```[\s\S]*```/, // Code blocks
      /\*\*.*\*\*|__.*__/, // Bold
      /\*.*\*|_.*_/, // Italic
    ];

    const matches = markdownPatterns.filter(pattern => pattern.test(text));
    
    // If multiple markdown patterns match, likely markdown
    return matches.length >= 2;
  }

  /**
   * Get document characteristics for chunking optimization
   */
  static getDocumentCharacteristics(
    documentType: DocumentType,
    content?: string
  ): {
    averageSentenceLength: number;
    averageParagraphLength: number;
    codeDensity: number;
    structureComplexity: 'low' | 'medium' | 'high';
  } {
    if (!content) {
      // Return defaults based on document type
      return this.getDefaultCharacteristics(documentType);
    }

    const sentences = content.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
      : 0;
    
    const avgParagraphLength = paragraphs.length > 0
      ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
      : 0;

    // Calculate code density (for code files)
    const codeDensity = documentType === 'code'
      ? (content.match(/[{}[\](),;=+\-*/%<>!&|]/g) || []).length / content.length
      : 0;

    // Determine structure complexity
    let structureComplexity: 'low' | 'medium' | 'high' = 'low';
    if (documentType === 'code') {
      structureComplexity = codeDensity > 0.1 ? 'high' : codeDensity > 0.05 ? 'medium' : 'low';
    } else if (documentType === 'html' || documentType === 'markdown') {
      const headerCount = (content.match(/^#{1,6}\s+|<h[1-6]/gim) || []).length;
      structureComplexity = headerCount > 10 ? 'high' : headerCount > 5 ? 'medium' : 'low';
    } else {
      const paragraphCount = paragraphs.length;
      structureComplexity = paragraphCount > 20 ? 'high' : paragraphCount > 10 ? 'medium' : 'low';
    }

    return {
      averageSentenceLength: avgSentenceLength,
      averageParagraphLength: avgParagraphLength,
      codeDensity,
      structureComplexity,
    };
  }

  /**
   * Get default characteristics for document type
   */
  private static getDefaultCharacteristics(documentType: DocumentType): {
    averageSentenceLength: number;
    averageParagraphLength: number;
    codeDensity: number;
    structureComplexity: 'low' | 'medium' | 'high';
  } {
    const defaults: Record<DocumentType, {
      averageSentenceLength: number;
      averageParagraphLength: number;
      codeDensity: number;
      structureComplexity: 'low' | 'medium' | 'high';
    }> = {
      pdf: { averageSentenceLength: 120, averageParagraphLength: 500, codeDensity: 0, structureComplexity: 'medium' },
      docx: { averageSentenceLength: 100, averageParagraphLength: 400, codeDensity: 0, structureComplexity: 'medium' },
      text: { averageSentenceLength: 80, averageParagraphLength: 300, codeDensity: 0, structureComplexity: 'low' },
      code: { averageSentenceLength: 60, averageParagraphLength: 200, codeDensity: 0.08, structureComplexity: 'high' },
      markdown: { averageSentenceLength: 90, averageParagraphLength: 350, codeDensity: 0, structureComplexity: 'medium' },
      html: { averageSentenceLength: 70, averageParagraphLength: 250, codeDensity: 0.02, structureComplexity: 'high' },
      unknown: { averageSentenceLength: 100, averageParagraphLength: 400, codeDensity: 0, structureComplexity: 'medium' },
    };

    return defaults[documentType];
  }
}
