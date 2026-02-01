import logger from '../config/logger';
import { TokenCountService } from './token-count.service';
import { SemanticChunkingService, SemanticChunkingOptions, ChunkingStrategy } from './semantic-chunking.service';
import { BoundaryDetectionService } from './boundary-detection.service';
import { TextChunk, SectionInfo, ParagraphInfo } from '../types/chunk';
import { DocumentTypeDetectionService, DocumentType } from './document-type-detection.service';
import { getAdaptiveChunkingOptions, getChunkingConfig, calculateOverlapSize } from '../config/chunking.config';

// Re-export TextChunk for backward compatibility
export type { TextChunk } from '../types/chunk';

export interface ChunkingOptions {
  maxChunkSize?: number; // Maximum tokens per chunk (default: 800, or adaptive based on document type)
  overlapSize?: number; // Overlap tokens between chunks (default: 100, or adaptive)
  minChunkSize?: number; // Minimum tokens per chunk (default: 100, or adaptive)
  encodingType?: 'cl100k_base' | 'p50k_base' | 'r50k_base' | 'gpt2' | 'auto'; // Token encoding type
  model?: string; // OpenAI model name (for automatic encoding selection)
  strategy?: ChunkingStrategy; // Chunking strategy: 'sentence' | 'semantic' | 'hybrid' (default: 'sentence')
  similarityThreshold?: number; // Minimum similarity for semantic chunking (default: 0.7)
  enableSemanticChunking?: boolean; // Enable semantic chunking (default: false for backward compatibility)
  fallbackToSentence?: boolean; // Fallback to sentence-based if semantic fails (default: true)
  respectParagraphBoundaries?: boolean; // Respect paragraph boundaries when chunking (default: true)
  respectSectionBoundaries?: boolean; // Respect section boundaries when chunking (default: true)
  // Adaptive chunking options
  documentType?: DocumentType; // Document type for adaptive sizing (auto-detected if not provided)
  filename?: string; // Filename for document type detection
  fileType?: string; // File type/MIME type for document type detection
  useAdaptiveSizing?: boolean; // Enable adaptive chunk sizing (default: true)
}

const DEFAULT_OPTIONS: Required<Omit<ChunkingOptions, 'encodingType' | 'model' | 'strategy' | 'similarityThreshold' | 'enableSemanticChunking' | 'fallbackToSentence' | 'documentType' | 'filename' | 'fileType' | 'useAdaptiveSizing'>> & {
  encodingType: ChunkingOptions['encodingType'];
} = {
  maxChunkSize: 800, // ~600 words
  overlapSize: 100, // ~75 words overlap
  minChunkSize: 100, // ~75 words minimum
  encodingType: 'cl100k_base', // Default encoding for GPT-3.5/4 models
  respectParagraphBoundaries: true, // Default: respect paragraph boundaries
  respectSectionBoundaries: true, // Default: respect section boundaries
};

/**
 * Chunking Service
 * Splits text into manageable chunks for embedding generation
 */
export class ChunkingService {
  /**
   * Count tokens using tiktoken for accurate token counting
   * This replaces the old estimateTokens() method with exact token counting
   *
   * @param text - Text to count tokens for
   * @param encodingType - Encoding type (optional, uses default if not provided)
   * @param model - Model name (optional, for automatic encoding selection)
   * @returns Exact token count
   */
  private static countTokensInternal(
    text: string,
    encodingType?: ChunkingOptions['encodingType'],
    model?: string
  ): number {
    if (!text || text.length === 0) {
      return 0;
    }

    if (model) {
      return TokenCountService.countTokensForModel(text, model);
    }

    return TokenCountService.countTokens(text, encodingType || DEFAULT_OPTIONS.encodingType);
  }

  /**
   * Split text into sentences with position information
   */
  private static splitIntoSentencesWithPositions(text: string): Array<{ text: string; startChar: number; endChar: number }> {
    const sentences: Array<{ text: string; startChar: number; endChar: number }> = [];
    const sentenceRegex = /([.!?]+)\s+/g;
    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceStart = lastIndex;
      const sentenceEnd = match.index + match[1].length;
      const sentenceText = text.substring(sentenceStart, sentenceEnd).trim();
      
      if (sentenceText.length > 0) {
        sentences.push({
          text: sentenceText,
          startChar: sentenceStart,
          endChar: sentenceEnd,
        });
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push({
          text: remaining,
          startChar: lastIndex,
          endChar: text.length,
        });
      }
    }

    // If no sentences found (no punctuation), split by paragraphs
    if (sentences.length === 0) {
      const paragraphs = text.split(/\n\n+/);
      let paraStart = 0;
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed.length > 0) {
          const paraStartPos = text.indexOf(trimmed, paraStart);
          sentences.push({
            text: trimmed,
            startChar: paraStartPos,
            endChar: paraStartPos + trimmed.length,
          });
          paraStart = paraStartPos + trimmed.length;
        }
      }
    }

    return sentences;
  }

  /**
   * Get adaptive chunking options based on document type
   */
  private static getAdaptiveOptions(
    text: string,
    options: ChunkingOptions
  ): {
    maxChunkSize: number;
    minChunkSize: number;
    overlapSize: number;
    strategy?: ChunkingStrategy;
  } {
    const config = getChunkingConfig();
    const useAdaptive = options.useAdaptiveSizing !== false && config.adaptive.enabled;

    if (!useAdaptive) {
      // Use provided options or defaults
      return {
        maxChunkSize: options.maxChunkSize || DEFAULT_OPTIONS.maxChunkSize,
        minChunkSize: options.minChunkSize || DEFAULT_OPTIONS.minChunkSize,
        overlapSize: options.overlapSize || DEFAULT_OPTIONS.overlapSize,
        strategy: options.strategy,
      };
    }

    // Detect document type if not provided
    let documentType = options.documentType;
    if (!documentType) {
      documentType = DocumentTypeDetectionService.detectDocumentType(
        options.filename,
        options.fileType,
        text
      );
      
      logger.debug('Detected document type for adaptive chunking', {
        documentType,
        filename: options.filename,
        fileType: options.fileType,
      });
    }

    // Get adaptive options
    const adaptiveOptions = getAdaptiveChunkingOptions(documentType, config);

    // Override with explicit options if provided
    return {
      maxChunkSize: options.maxChunkSize ?? adaptiveOptions.maxChunkSize,
      minChunkSize: options.minChunkSize ?? adaptiveOptions.minChunkSize,
      overlapSize: options.overlapSize ?? adaptiveOptions.overlapSize,
      strategy: options.strategy ?? adaptiveOptions.strategy,
    };
  }

  /**
   * Split text into chunks with overlap
   * Supports both sentence-based (synchronous) and semantic (async) chunking strategies
   * 
   * For backward compatibility, defaults to synchronous sentence-based chunking.
   * Use strategy: 'semantic' or enableSemanticChunking: true for semantic chunking (returns Promise)
   * 
   * Adaptive chunk sizing is enabled by default and automatically detects document type
   * to use optimal chunk sizes for different document types (PDF, DOCX, code, etc.)
   */
  static chunkText(text: string, options?: ChunkingOptions & { strategy?: 'sentence' }): TextChunk[];
  static chunkText(text: string, options: ChunkingOptions & { strategy: 'semantic' | 'hybrid' }): Promise<TextChunk[]>;
  static chunkText(text: string, options: ChunkingOptions & { enableSemanticChunking: true }): Promise<TextChunk[]>;
  static chunkText(
    text: string,
    options: ChunkingOptions = {}
  ): TextChunk[] | Promise<TextChunk[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Get adaptive chunking options
    const adaptiveOpts = this.getAdaptiveOptions(text, options);

    // Merge options with adaptive sizing
    const opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      maxChunkSize: adaptiveOpts.maxChunkSize,
      minChunkSize: adaptiveOpts.minChunkSize,
      overlapSize: adaptiveOpts.overlapSize,
      encodingType: options.encodingType || DEFAULT_OPTIONS.encodingType,
      strategy: adaptiveOpts.strategy || options.strategy || (options.enableSemanticChunking ? 'semantic' : 'sentence'),
      respectParagraphBoundaries: options.respectParagraphBoundaries !== undefined 
        ? options.respectParagraphBoundaries 
        : DEFAULT_OPTIONS.respectParagraphBoundaries,
      respectSectionBoundaries: options.respectSectionBoundaries !== undefined 
        ? options.respectSectionBoundaries 
        : DEFAULT_OPTIONS.respectSectionBoundaries,
    };

    // Use semantic chunking if strategy is 'semantic' or 'hybrid' or enableSemanticChunking is true
    if (opts.strategy === 'semantic' || opts.strategy === 'hybrid' || options.enableSemanticChunking) {
      return this.chunkTextSemantic(text, opts);
    }

    // Default to sentence-based chunking (synchronous)
    return this.chunkTextSentenceBased(text, opts);
  }

  /**
   * Async version of chunkText for semantic chunking
   * Use this when you need semantic chunking and want explicit async handling
   * 
   * Adaptive chunk sizing is enabled by default
   */
  static async chunkTextAsync(
    text: string,
    options: ChunkingOptions = {}
  ): Promise<TextChunk[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Get adaptive chunking options
    const adaptiveOpts = this.getAdaptiveOptions(text, options);

    // Merge options with adaptive sizing
    const opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      maxChunkSize: adaptiveOpts.maxChunkSize,
      minChunkSize: adaptiveOpts.minChunkSize,
      overlapSize: adaptiveOpts.overlapSize,
      encodingType: options.encodingType || DEFAULT_OPTIONS.encodingType,
      strategy: adaptiveOpts.strategy || options.strategy || (options.enableSemanticChunking ? 'semantic' : 'sentence'),
      respectParagraphBoundaries: options.respectParagraphBoundaries !== undefined 
        ? options.respectParagraphBoundaries 
        : DEFAULT_OPTIONS.respectParagraphBoundaries,
      respectSectionBoundaries: options.respectSectionBoundaries !== undefined 
        ? options.respectSectionBoundaries 
        : DEFAULT_OPTIONS.respectSectionBoundaries,
    };

    // Use semantic chunking if strategy is 'semantic' or 'hybrid'
    if (opts.strategy === 'semantic' || opts.strategy === 'hybrid' || options.enableSemanticChunking) {
      return this.chunkTextSemantic(text, opts);
    }

    // For sentence-based, return as resolved promise for consistency
    return Promise.resolve(this.chunkTextSentenceBased(text, opts));
  }

  /**
   * Sentence-based chunking with paragraph and section boundary awareness
   */
  private static chunkTextSentenceBased(
    text: string,
    opts: Required<Omit<ChunkingOptions, 'encodingType' | 'model' | 'strategy' | 'similarityThreshold' | 'enableSemanticChunking' | 'fallbackToSentence' | 'documentType' | 'filename' | 'fileType' | 'useAdaptiveSizing'>> & {
      encodingType: ChunkingOptions['encodingType'];
      model?: string;
    }
  ): TextChunk[] {
    const chunks: TextChunk[] = [];

    // If text is small enough, return as single chunk
    const totalTokens = this.countTokensInternal(text, opts.encodingType, opts.model);
    if (totalTokens <= opts.maxChunkSize) {
      const structure = opts.respectParagraphBoundaries || opts.respectSectionBoundaries
        ? BoundaryDetectionService.detectDocumentStructure(text)
        : null;
      
      const section = structure?.sections.find(s => s.startChar === 0);
      const paragraphs = structure?.paragraphs.filter(p => p.startChar === 0 && p.endChar === text.length) || [];
      
      return [{
        content: text.trim(),
        startChar: 0,
        endChar: text.length,
        tokenCount: totalTokens,
        chunkIndex: 0,
        section: section,
        paragraphIndices: paragraphs.map(p => p.index),
        startsAtParagraphBoundary: true,
        endsAtParagraphBoundary: true,
      }];
    }

    // Detect document structure if boundary awareness is enabled
    const structure = opts.respectParagraphBoundaries || opts.respectSectionBoundaries
      ? BoundaryDetectionService.detectDocumentStructure(text)
      : null;
    const paragraphs = structure?.paragraphs || [];
    const sections = structure?.sections || [];

    // Split into sentences with position information
    const sentencesWithPositions = this.splitIntoSentencesWithPositions(text);
    
    // Build sentence metadata with paragraph/section info
    interface SentenceMetadata {
      text: string;
      startChar: number;
      endChar: number;
      paragraphIndex?: number;
      section?: SectionInfo;
    }
    
    const sentencesWithMetadata: SentenceMetadata[] = [];
    
    for (const sentencePos of sentencesWithPositions) {
      // Find paragraph and section for this sentence
      const paragraph = paragraphs.find(
        p => sentencePos.startChar >= p.startChar && sentencePos.startChar < p.endChar
      );
      const section = sections.find(
        s => sentencePos.startChar >= s.startChar && sentencePos.startChar < (s.endChar || text.length)
      );
      
      sentencesWithMetadata.push({
        text: sentencePos.text,
        startChar: sentencePos.startChar,
        endChar: sentencePos.endChar,
        paragraphIndex: paragraph?.index,
        section: section,
      });
    }

    let currentChunk: SentenceMetadata[] = [];
    let currentTokens = 0;
    let currentStartChar = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentencesWithMetadata.length; i++) {
      const sentenceMeta = sentencesWithMetadata[i];
      const sentenceTokens = this.countTokensInternal(sentenceMeta.text, opts.encodingType, opts.model);

      // Check if we should break at paragraph boundary
      const shouldBreakAtParagraph = opts.respectParagraphBoundaries && 
        currentChunk.length > 0 &&
        currentChunk[currentChunk.length - 1].paragraphIndex !== sentenceMeta.paragraphIndex &&
        currentTokens + sentenceTokens > opts.maxChunkSize * 0.7; // Break if we're 70% full and at paragraph boundary

      // Check if we should break at section boundary
      const shouldBreakAtSection = opts.respectSectionBoundaries &&
        currentChunk.length > 0 &&
        currentChunk[currentChunk.length - 1].section?.index !== sentenceMeta.section?.index &&
        currentTokens + sentenceTokens > opts.maxChunkSize * 0.7;

      // If adding this sentence would exceed max size, finalize current chunk
      // But try to avoid breaking within paragraphs unless absolutely necessary
      const wouldExceedMax = currentTokens + sentenceTokens > opts.maxChunkSize;
      const isNewParagraph = currentChunk.length > 0 && 
        currentChunk[currentChunk.length - 1].paragraphIndex !== sentenceMeta.paragraphIndex;
      
      // Only break if:
      // 1. We would exceed max size AND (we're at a paragraph boundary OR current chunk is large enough)
      // 2. OR we're explicitly at a section boundary
      const shouldBreak = (wouldExceedMax && (isNewParagraph || currentTokens >= opts.minChunkSize)) ||
        shouldBreakAtSection ||
        (shouldBreakAtParagraph && currentTokens >= opts.minChunkSize);

      if (shouldBreak && currentChunk.length > 0) {
        // Create chunk
        const chunkContent = currentChunk.map(s => s.text).join(' ').trim();
        const chunkEndChar = currentChunk[currentChunk.length - 1].endChar;

        // Get paragraph indices and section info
        const chunkParagraphIndices = Array.from(
          new Set(currentChunk.map(s => s.paragraphIndex).filter((idx): idx is number => idx !== undefined))
        );
        const chunkSection = currentChunk[0].section;
        const startsAtParaBoundary = opts.respectParagraphBoundaries && 
          paragraphs.some(p => p.startChar === currentStartChar);
        const endsAtParaBoundary = opts.respectParagraphBoundaries &&
          paragraphs.some(p => p.endChar === chunkEndChar);

        chunks.push({
          content: chunkContent,
          startChar: currentStartChar,
          endChar: chunkEndChar,
          tokenCount: currentTokens,
          chunkIndex: chunkIndex++,
          section: chunkSection,
          paragraphIndices: chunkParagraphIndices.length > 0 ? chunkParagraphIndices : undefined,
          startsAtParagraphBoundary: startsAtParaBoundary,
          endsAtParagraphBoundary: endsAtParaBoundary,
        });

        // Start new chunk with overlap
        // Include last few sentences for overlap, but prefer paragraph boundaries
        const overlapSentences: SentenceMetadata[] = [];
        let overlapTokens = 0;
        let overlapStart = currentChunk.length - 1;

        // Build overlap from end of previous chunk
        while (overlapStart >= 0 && overlapTokens < opts.overlapSize) {
          const sentenceToAdd = currentChunk[overlapStart];
          const sentenceTokenCount = this.countTokensInternal(sentenceToAdd.text, opts.encodingType, opts.model);
          if (overlapTokens + sentenceTokenCount <= opts.overlapSize) {
            overlapSentences.unshift(sentenceToAdd);
            overlapTokens += sentenceTokenCount;
            overlapStart--;
          } else {
            break;
          }
        }

        // Start new chunk with overlap
        currentChunk = [...overlapSentences, sentenceMeta];
        currentTokens = overlapTokens + sentenceTokens;
        currentStartChar = overlapSentences.length > 0 
          ? overlapSentences[0].startChar 
          : sentenceMeta.startChar;
      } else {
        // Add sentence to current chunk
        if (currentChunk.length === 0) {
          currentStartChar = sentenceMeta.startChar;
        }
        currentChunk.push(sentenceMeta);
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.map(s => s.text).join(' ').trim();
      const chunkEndChar = currentChunk[currentChunk.length - 1].endChar;
      const finalTokens = this.countTokensInternal(chunkContent, opts.encodingType, opts.model);

      // Get paragraph indices and section info for final chunk
      const chunkParagraphIndices = Array.from(
        new Set(currentChunk.map(s => s.paragraphIndex).filter((idx): idx is number => idx !== undefined))
      );
      const chunkSection = currentChunk[0].section;
      const startsAtParaBoundary = opts.respectParagraphBoundaries && 
        paragraphs.some(p => p.startChar === currentStartChar);
      const endsAtParaBoundary = opts.respectParagraphBoundaries &&
        paragraphs.some(p => p.endChar === chunkEndChar);

      // Only add if it meets minimum size requirement
      if (finalTokens >= opts.minChunkSize || chunks.length === 0) {
        chunks.push({
          content: chunkContent,
          startChar: currentStartChar,
          endChar: chunkEndChar,
          tokenCount: finalTokens,
          chunkIndex: chunkIndex,
          section: chunkSection,
          paragraphIndices: chunkParagraphIndices.length > 0 ? chunkParagraphIndices : undefined,
          startsAtParagraphBoundary: startsAtParaBoundary,
          endsAtParagraphBoundary: endsAtParaBoundary,
        });
      } else if (chunks.length > 0) {
        // Merge small final chunk with previous chunk
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content = (lastChunk.content + ' ' + chunkContent).trim();
        lastChunk.endChar = chunkEndChar;
        lastChunk.tokenCount = this.countTokensInternal(lastChunk.content, opts.encodingType, opts.model);
        
        // Merge metadata
        if (chunkParagraphIndices.length > 0) {
          const existingIndices = lastChunk.paragraphIndices || [];
          lastChunk.paragraphIndices = Array.from(new Set([...existingIndices, ...chunkParagraphIndices]));
        }
        lastChunk.endsAtParagraphBoundary = endsAtParaBoundary;
      }
    }

    logger.info('Text chunking completed (sentence-based with boundary awareness)', {
      totalChunks: chunks.length,
      totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      avgChunkSize: Math.round(
        chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length
      ),
      paragraphsRespected: opts.respectParagraphBoundaries,
      sectionsRespected: opts.respectSectionBoundaries,
    });

    return chunks;
  }

  /**
   * Semantic chunking using embeddings
   */
  private static async chunkTextSemantic(
    text: string,
    opts: Required<Omit<ChunkingOptions, 'encodingType' | 'model' | 'strategy' | 'similarityThreshold' | 'enableSemanticChunking' | 'fallbackToSentence' | 'documentType' | 'filename' | 'fileType' | 'useAdaptiveSizing'>> & {
      encodingType: ChunkingOptions['encodingType'];
      model?: string;
      strategy?: ChunkingStrategy;
      similarityThreshold?: number;
      enableSemanticChunking?: boolean;
      fallbackToSentence?: boolean;
      respectParagraphBoundaries?: boolean;
      respectSectionBoundaries?: boolean;
    }
  ): Promise<TextChunk[]> {
    try {
      const semanticOptions: SemanticChunkingOptions = {
        maxChunkSize: opts.maxChunkSize,
        overlapSize: opts.overlapSize,
        minChunkSize: opts.minChunkSize,
        encodingType: opts.encodingType,
        model: opts.model,
        similarityThreshold: opts.similarityThreshold || 0.7,
        enableSemanticChunking: opts.enableSemanticChunking !== false,
        fallbackToSentence: opts.fallbackToSentence !== false,
      };

      const semanticChunks = await SemanticChunkingService.chunkTextSemantically(
        text,
        semanticOptions
      );

      // Convert semantic chunks to TextChunk format (with boundary metadata)
      return semanticChunks.map((chunk) => ({
        content: chunk.content,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        tokenCount: chunk.tokenCount,
        chunkIndex: chunk.chunkIndex,
        section: chunk.section,
        paragraphIndices: chunk.paragraphIndices,
        startsAtParagraphBoundary: chunk.startsAtParagraphBoundary,
        endsAtParagraphBoundary: chunk.endsAtParagraphBoundary,
      }));
    } catch (error: any) {
      // If semantic chunking fails and fallback is enabled, use sentence-based
      if (opts.fallbackToSentence !== false) {
        logger.warn('Semantic chunking failed, falling back to sentence-based', {
          error: error.message,
        });
        return this.chunkTextSentenceBased(text, opts);
      }

      // Re-throw if fallback is disabled
      throw error;
    }
  }

  /**
   * Count tokens in text using tiktoken for accurate counting
   * This provides exact token counts matching OpenAI's tokenizer
   *
   * @param text - Text to count tokens for
   * @param encodingType - Encoding type (optional)
   * @param model - Model name (optional, for automatic encoding selection)
   * @returns Exact token count
   */
  static countTokens(
    text: string,
    encodingType?: ChunkingOptions['encodingType'],
    model?: string
  ): number {
    return this.countTokensInternal(text, encodingType, model);
  }
}
