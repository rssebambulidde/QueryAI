import logger from '../config/logger';
import { EmbeddingService } from './embedding.service';
import { TokenCountService } from './token-count.service';
import { AppError } from '../types/error';
import { BoundaryDetectionService } from './boundary-detection.service';
import { SectionInfo, ParagraphInfo } from '../types/chunk';

/**
 * Chunking strategy type
 */
export type ChunkingStrategy = 'sentence' | 'semantic' | 'hybrid';

/**
 * Semantic chunking options
 */
export interface SemanticChunkingOptions {
  maxChunkSize?: number; // Maximum tokens per chunk (default: 800)
  overlapSize?: number; // Overlap tokens between chunks (default: 100)
  minChunkSize?: number; // Minimum tokens per chunk (default: 100)
  similarityThreshold?: number; // Minimum similarity to group sentences (default: 0.7)
  encodingType?: 'cl100k_base' | 'p50k_base' | 'r50k_base' | 'gpt2' | 'auto';
  model?: string; // OpenAI model name (for automatic encoding selection)
  enableSemanticChunking?: boolean; // Enable semantic chunking (default: true)
  fallbackToSentence?: boolean; // Fallback to sentence-based if semantic fails (default: true)
}

/**
 * Sentence with metadata for semantic chunking
 */
interface SentenceWithMetadata {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  tokenCount: number;
  embedding?: number[];
}

/**
 * Similarity between two sentences
 */
interface SentenceSimilarity {
  sentence1Index: number;
  sentence2Index: number;
  similarity: number;
}

const DEFAULT_OPTIONS: Required<Omit<SemanticChunkingOptions, 'encodingType' | 'model' | 'enableSemanticChunking' | 'fallbackToSentence'>> & {
  encodingType: SemanticChunkingOptions['encodingType'];
  enableSemanticChunking: boolean;
  fallbackToSentence: boolean;
} = {
  maxChunkSize: 800,
  overlapSize: 100,
  minChunkSize: 100,
  similarityThreshold: 0.7,
  encodingType: 'cl100k_base',
  enableSemanticChunking: true,
  fallbackToSentence: true,
};

/**
 * Semantic Chunking Service
 * Groups sentences based on semantic similarity using embeddings
 */
export class SemanticChunkingService {
  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Generate embeddings for sentences in batch
   * Uses batch processing for efficiency
   */
  private static async generateSentenceEmbeddings(
    sentences: string[]
  ): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Generate embeddings in parallel for better performance
    // OpenAI API supports batch requests, but we'll do parallel requests for simplicity
    const embeddingPromises = sentences.map((sentence) =>
      EmbeddingService.generateEmbedding(sentence).catch((error) => {
        logger.warn('Failed to generate embedding for sentence', {
          error: error.message,
          sentenceLength: sentence.length,
        });
        return null;
      })
    );

    const results = await Promise.all(embeddingPromises);

    for (const embedding of results) {
      if (embedding) {
        embeddings.push(embedding);
      } else {
        // If embedding generation fails, we can't do semantic chunking
        throw new AppError(
          'Failed to generate embeddings for semantic chunking',
          500,
          'EMBEDDING_GENERATION_FAILED'
        );
      }
    }

    return embeddings;
  }

  /**
   * Calculate similarity matrix for sentences
   */
  private static calculateSimilarityMatrix(
    embeddings: number[][]
  ): SentenceSimilarity[] {
    const similarities: SentenceSimilarity[] = [];

    for (let i = 0; i < embeddings.length - 1; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
        similarities.push({
          sentence1Index: i,
          sentence2Index: j,
          similarity,
        });
      }
    }

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities;
  }

  /**
   * Group sentences into semantic clusters
   * Uses a greedy algorithm to group similar sentences
   */
  private static groupSentencesSemantically(
    sentences: SentenceWithMetadata[],
    similarities: SentenceSimilarity[],
    threshold: number
  ): number[][] {
    // Initialize: each sentence is in its own group
    const groups: number[][] = sentences.map((_, index) => [index]);
    const sentenceToGroup = new Map<number, number>();
    groups.forEach((group, groupIndex) => {
      group.forEach((sentenceIndex) => {
        sentenceToGroup.set(sentenceIndex, groupIndex);
      });
    });

    // Merge groups based on similarity
    for (const sim of similarities) {
      if (sim.similarity < threshold) {
        break; // Similarities are sorted, so we can stop here
      }

      const group1 = sentenceToGroup.get(sim.sentence1Index);
      const group2 = sentenceToGroup.get(sim.sentence2Index);

      if (group1 !== undefined && group2 !== undefined && group1 !== group2) {
        // Merge groups
        const mergedGroup = [...groups[group1], ...groups[group2]];
        groups[group1] = mergedGroup;
        groups[group2] = [];

        // Update mapping
        mergedGroup.forEach((sentenceIndex) => {
          sentenceToGroup.set(sentenceIndex, group1);
        });
      }
    }

    // Filter out empty groups and sort by first sentence index
    return groups
      .filter((group) => group.length > 0)
      .sort((a, b) => a[0] - b[0]);
  }

  /**
   * Create chunks from semantic groups while respecting token limits
   */
  private static createChunksFromGroups(
    sentences: SentenceWithMetadata[],
    groups: number[][],
    options: Required<Omit<SemanticChunkingOptions, 'encodingType' | 'model'>> & {
      encodingType: SemanticChunkingOptions['encodingType'];
      model?: string;
    },
    text: string,
    structure?: { paragraphs: ParagraphInfo[]; sections: SectionInfo[] }
  ): Array<{
    content: string;
    startChar: number;
    endChar: number;
    tokenCount: number;
    chunkIndex: number;
    sentenceIndices: number[];
    section?: SectionInfo;
    paragraphIndices?: number[];
    startsAtParagraphBoundary?: boolean;
    endsAtParagraphBoundary?: boolean;
  }> {
    const chunks: Array<{
      content: string;
      startChar: number;
      endChar: number;
      tokenCount: number;
      chunkIndex: number;
      sentenceIndices: number[];
      section?: SectionInfo;
      paragraphIndices?: number[];
      startsAtParagraphBoundary?: boolean;
      endsAtParagraphBoundary?: boolean;
    }> = [];

    let chunkIndex = 0;
    let currentChunk: SentenceWithMetadata[] = [];
    let currentTokens = 0;

    for (const group of groups) {
      // Calculate total tokens for this group
      const groupSentences = group.map((idx) => sentences[idx]);
      const groupTokens = groupSentences.reduce(
        (sum, s) => sum + s.tokenCount,
        0
      );

      // If adding this group would exceed max size, finalize current chunk
      if (
        currentTokens + groupTokens > options.maxChunkSize &&
        currentChunk.length > 0
      ) {
        // Create chunk
        const chunkContent = currentChunk
          .map((s) => s.text)
          .join(' ')
          .trim();
        // Use actual sentence positions for accurate character positions
        const chunkStartChar = currentChunk[0].startChar;
        const chunkEndChar = currentChunk[currentChunk.length - 1].endChar;

        // Get boundary metadata
        const chunkSection = structure?.sections.find(
          s => chunkStartChar >= s.startChar && chunkStartChar < (s.endChar || text.length)
        );
        const chunkParagraphs = structure?.paragraphs.filter(
          p => (chunkStartChar >= p.startChar && chunkStartChar < p.endChar) ||
               (chunkEndChar > p.startChar && chunkEndChar <= p.endChar) ||
               (chunkStartChar <= p.startChar && chunkEndChar >= p.endChar)
        ) || [];
        const chunkParagraphIndices = chunkParagraphs.map(p => p.index);
        const startsAtParaBoundary = structure?.paragraphs.some(p => p.startChar === chunkStartChar);
        const endsAtParaBoundary = structure?.paragraphs.some(p => p.endChar === chunkEndChar);

        chunks.push({
          content: chunkContent,
          startChar: chunkStartChar,
          endChar: chunkEndChar,
          tokenCount: currentTokens,
          chunkIndex: chunkIndex++,
          sentenceIndices: currentChunk.map((s) => s.index),
          section: chunkSection,
          paragraphIndices: chunkParagraphIndices.length > 0 ? chunkParagraphIndices : undefined,
          startsAtParagraphBoundary: startsAtParaBoundary,
          endsAtParagraphBoundary: endsAtParaBoundary,
        });

        // Start new chunk with overlap
        const overlapSentences: SentenceWithMetadata[] = [];
        let overlapTokens = 0;
        let overlapStart = currentChunk.length - 1;

        while (
          overlapStart >= 0 &&
          overlapTokens < options.overlapSize
        ) {
          const sentenceToAdd = currentChunk[overlapStart];
          if (overlapTokens + sentenceToAdd.tokenCount <= options.overlapSize) {
            overlapSentences.unshift(sentenceToAdd);
            overlapTokens += sentenceToAdd.tokenCount;
            overlapStart--;
          } else {
            break;
          }
        }

        // Start new chunk with overlap + current group
        currentChunk = [...overlapSentences, ...groupSentences];
        currentTokens = overlapTokens + groupTokens;
      } else {
        // Add group to current chunk
        currentChunk.push(...groupSentences);
        currentTokens += groupTokens;
      }
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.map((s) => s.text).join(' ').trim();
      // Use actual sentence positions
      const chunkStartChar = currentChunk[0].startChar;
      const chunkEndChar = currentChunk[currentChunk.length - 1].endChar;
      const finalTokens = TokenCountService.countTokens(
        chunkContent,
        options.encodingType
      );

      // Get boundary metadata for final chunk
      const finalChunkSection = structure?.sections.find(
        s => chunkStartChar >= s.startChar && chunkStartChar < (s.endChar || text.length)
      );
      const finalChunkParagraphs = structure?.paragraphs.filter(
        p => (chunkStartChar >= p.startChar && chunkStartChar < p.endChar) ||
             (chunkEndChar > p.startChar && chunkEndChar <= p.endChar) ||
             (chunkStartChar <= p.startChar && chunkEndChar >= p.endChar)
      ) || [];
      const finalChunkParagraphIndices = finalChunkParagraphs.map(p => p.index);
      const finalStartsAtParaBoundary = structure?.paragraphs.some(p => p.startChar === chunkStartChar);
      const finalEndsAtParaBoundary = structure?.paragraphs.some(p => p.endChar === chunkEndChar);

      if (finalTokens >= options.minChunkSize || chunks.length === 0) {
        chunks.push({
          content: chunkContent,
          startChar: chunkStartChar,
          endChar: chunkEndChar,
          tokenCount: finalTokens,
          chunkIndex: chunkIndex,
          sentenceIndices: currentChunk.map((s) => s.index),
          section: finalChunkSection,
          paragraphIndices: finalChunkParagraphIndices.length > 0 ? finalChunkParagraphIndices : undefined,
          startsAtParagraphBoundary: finalStartsAtParaBoundary,
          endsAtParagraphBoundary: finalEndsAtParaBoundary,
        });
      } else if (chunks.length > 0) {
        // Merge small final chunk with previous chunk
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content = (lastChunk.content + ' ' + chunkContent).trim();
        lastChunk.endChar = chunkEndChar;
        lastChunk.tokenCount = TokenCountService.countTokens(
          lastChunk.content,
          options.encodingType
        );
        lastChunk.sentenceIndices.push(...currentChunk.map((s) => s.index));
      }
    }

    return chunks;
  }

  /**
   * Split text into sentences with metadata
   */
  private static splitIntoSentencesWithMetadata(
    text: string,
    encodingType?: SemanticChunkingOptions['encodingType'],
    model?: string
  ): SentenceWithMetadata[] {
    const sentences: SentenceWithMetadata[] = [];
    const sentenceRegex = /([.!?]+)\s+/g;
    let lastIndex = 0;
    let match;
    let charIndex = 0;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceText = text.substring(lastIndex, match.index + match[1].length);
      if (sentenceText.trim().length > 0) {
        const startChar = charIndex;
        const endChar = charIndex + sentenceText.length;
        const tokenCount = model
          ? TokenCountService.countTokensForModel(sentenceText.trim(), model)
          : TokenCountService.countTokens(
              sentenceText.trim(),
              encodingType || 'cl100k_base'
            );

        sentences.push({
          text: sentenceText.trim(),
          index: sentences.length,
          startChar,
          endChar,
          tokenCount,
        });
        charIndex = endChar + match[0].length - match[1].length;
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining.length > 0) {
        const startChar = charIndex;
        const endChar = charIndex + remaining.length;
        const tokenCount = model
          ? TokenCountService.countTokensForModel(remaining, model)
          : TokenCountService.countTokens(
              remaining,
              encodingType || 'cl100k_base'
            );

        sentences.push({
          text: remaining,
          index: sentences.length,
          startChar,
          endChar,
          tokenCount,
        });
      }
    }

    // If no sentences found, split by paragraphs
    if (sentences.length === 0) {
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
      paragraphs.forEach((paragraph, index) => {
        const startChar = text.indexOf(paragraph);
        const endChar = startChar + paragraph.length;
        const tokenCount = model
          ? TokenCountService.countTokensForModel(paragraph.trim(), model)
          : TokenCountService.countTokens(
              paragraph.trim(),
              encodingType || 'cl100k_base'
            );

        sentences.push({
          text: paragraph.trim(),
          index,
          startChar,
          endChar,
          tokenCount,
        });
      });
    }

    return sentences;
  }

  /**
   * Perform semantic chunking on text
   * Groups sentences based on semantic similarity
   */
  static async chunkTextSemantically(
    text: string,
    options: SemanticChunkingOptions = {}
  ): Promise<Array<{
    content: string;
    startChar: number;
    endChar: number;
    tokenCount: number;
    chunkIndex: number;
    sentenceIndices: number[];
    section?: SectionInfo;
    paragraphIndices?: number[];
    startsAtParagraphBoundary?: boolean;
    endsAtParagraphBoundary?: boolean;
  }>> {
    const opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      encodingType: options.encodingType || DEFAULT_OPTIONS.encodingType,
    };

    if (!text || text.trim().length === 0) {
      return [];
    }

    // If text is small enough, return as single chunk
    const totalTokens = options.model
      ? TokenCountService.countTokensForModel(text, options.model)
      : TokenCountService.countTokens(text, opts.encodingType);

    if (totalTokens <= opts.maxChunkSize) {
      return [
        {
          content: text.trim(),
          startChar: 0,
          endChar: text.length,
          tokenCount: totalTokens,
          chunkIndex: 0,
          sentenceIndices: [0],
        },
      ];
    }

    try {
      // Split into sentences with metadata
      const sentences = this.splitIntoSentencesWithMetadata(
        text,
        opts.encodingType,
        options.model
      );

      if (sentences.length === 0) {
        return [];
      }

      // If only one sentence, return as single chunk
      if (sentences.length === 1) {
        return [
          {
            content: sentences[0].text,
            startChar: sentences[0].startChar,
            endChar: sentences[0].endChar,
            tokenCount: sentences[0].tokenCount,
            chunkIndex: 0,
            sentenceIndices: [0],
          },
        ];
      }

      logger.info('Generating embeddings for semantic chunking', {
        sentenceCount: sentences.length,
      });

      // Generate embeddings for all sentences
      const sentenceTexts = sentences.map((s) => s.text);
      const embeddings = await this.generateSentenceEmbeddings(sentenceTexts);

      // Store embeddings in sentence metadata
      sentences.forEach((sentence, index) => {
        sentence.embedding = embeddings[index];
      });

      // Calculate similarity matrix
      logger.info('Calculating semantic similarities', {
        sentenceCount: sentences.length,
      });

      const similarities = this.calculateSimilarityMatrix(embeddings);

      // Group sentences semantically
      const groups = this.groupSentencesSemantically(
        sentences,
        similarities,
        opts.similarityThreshold
      );

      logger.info('Grouped sentences semantically', {
        originalSentences: sentences.length,
        semanticGroups: groups.length,
        avgGroupSize: Math.round(
          groups.reduce((sum, g) => sum + g.length, 0) / groups.length
        ),
      });

      // Detect document structure for boundary metadata
      const structure = BoundaryDetectionService.detectDocumentStructure(text);

      // Create chunks from groups
      const chunks = this.createChunksFromGroups(sentences, groups, opts, text, structure);

      logger.info('Semantic chunking completed', {
        totalChunks: chunks.length,
        totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        avgChunkSize: Math.round(
          chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length
        ),
      });

      return chunks;
    } catch (error: any) {
      logger.error('Semantic chunking failed', {
        error: error.message,
        fallbackEnabled: opts.fallbackToSentence,
      });

      // Fallback to sentence-based chunking if enabled
      if (opts.fallbackToSentence) {
        logger.info('Falling back to sentence-based chunking');
        // Return empty array to signal fallback - the caller will handle it
        throw new AppError(
          'Semantic chunking failed, falling back to sentence-based',
          500,
          'SEMANTIC_CHUNKING_FAILED'
        );
      }

      throw error;
    }
  }

  /**
   * Compare semantic vs sentence-based chunking
   * Returns metrics for both approaches
   */
  static async compareChunkingStrategies(
    text: string,
    options: SemanticChunkingOptions = {}
  ): Promise<{
    semantic: {
      chunkCount: number;
      avgChunkSize: number;
      totalTokens: number;
      avgSimilarity: number;
    };
    sentence: {
      chunkCount: number;
      avgChunkSize: number;
      totalTokens: number;
    };
    improvement: {
      chunkCountDiff: number;
      avgChunkSizeDiff: number;
    };
  }> {
    // Get semantic chunks
    let semanticChunks: Array<{
      content: string;
      startChar: number;
      endChar: number;
      tokenCount: number;
      chunkIndex: number;
      sentenceIndices: number[];
    }> = [];

    try {
      semanticChunks = await this.chunkTextSemantically(text, options);
    } catch (error: any) {
      logger.warn('Semantic chunking failed in comparison', {
        error: error.message,
      });
    }

    // Get sentence-based chunks (using ChunkingService)
    const { ChunkingService } = await import('./chunking.service');
    // Use sentence-based strategy explicitly to get synchronous result
    const sentenceChunks = ChunkingService.chunkText(text, {
      maxChunkSize: options.maxChunkSize || 800,
      overlapSize: options.overlapSize || 100,
      minChunkSize: options.minChunkSize || 100,
      encodingType: options.encodingType,
      model: options.model,
      strategy: 'sentence' as const, // Explicitly use sentence-based for comparison
    });

    // Calculate metrics
    const semanticMetrics = {
      chunkCount: semanticChunks.length,
      avgChunkSize:
        semanticChunks.length > 0
          ? semanticChunks.reduce((sum, c) => sum + c.tokenCount, 0) /
            semanticChunks.length
          : 0,
      totalTokens: semanticChunks.reduce((sum, c) => sum + c.tokenCount, 0),
      avgSimilarity: 0, // Would need to calculate from similarity matrix
    };

    const sentenceMetrics = {
      chunkCount: sentenceChunks.length,
      avgChunkSize:
        sentenceChunks.length > 0
          ? sentenceChunks.reduce((sum, c) => sum + c.tokenCount, 0) /
            sentenceChunks.length
          : 0,
      totalTokens: sentenceChunks.reduce((sum, c) => sum + c.tokenCount, 0),
    };

    const improvement = {
      chunkCountDiff: semanticMetrics.chunkCount - sentenceMetrics.chunkCount,
      avgChunkSizeDiff:
        semanticMetrics.avgChunkSize - sentenceMetrics.avgChunkSize,
    };

    return {
      semantic: semanticMetrics,
      sentence: sentenceMetrics,
      improvement,
    };
  }
}
