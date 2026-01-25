import logger from '../config/logger';

export interface TextChunk {
  content: string;
  startChar: number;
  endChar: number;
  tokenCount: number;
  chunkIndex: number;
}

export interface ChunkingOptions {
  maxChunkSize?: number; // Maximum tokens per chunk (default: 800)
  overlapSize?: number; // Overlap tokens between chunks (default: 100)
  minChunkSize?: number; // Minimum tokens per chunk (default: 100)
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 800, // ~600 words
  overlapSize: 100, // ~75 words overlap
  minChunkSize: 100, // ~75 words minimum
};

/**
 * Chunking Service
 * Splits text into manageable chunks for embedding generation
 */
export class ChunkingService {
  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   * For more accurate counting, we'd use tiktoken, but this is sufficient
   */
  private static estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // This is a conservative estimate
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into sentences (preserving sentence boundaries)
   */
  private static splitIntoSentences(text: string): string[] {
    // Split by sentence endings, but preserve the punctuation
    const sentences: string[] = [];
    const sentenceRegex = /([.!?]+)\s+/g;
    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[1].length);
      if (sentence.trim().length > 0) {
        sentences.push(sentence.trim());
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push(remaining);
      }
    }

    // If no sentences found (no punctuation), split by paragraphs
    if (sentences.length === 0) {
      return text.split(/\n\n+/).filter(s => s.trim().length > 0);
    }

    return sentences;
  }

  /**
   * Split text into chunks with overlap
   */
  static chunkText(text: string, options: ChunkingOptions = {}): TextChunk[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const chunks: TextChunk[] = [];

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    // If text is small enough, return as single chunk
    const totalTokens = this.estimateTokens(text);
    if (totalTokens <= opts.maxChunkSize) {
      chunks.push({
        content: text.trim(),
        startChar: 0,
        endChar: text.length,
        tokenCount: totalTokens,
        chunkIndex: 0,
      });
      return chunks;
    }

    // Split into sentences for better chunking
    const sentences = this.splitIntoSentences(text);
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let currentStartChar = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokens(sentence);

      // If adding this sentence would exceed max size, finalize current chunk
      if (currentTokens + sentenceTokens > opts.maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        const chunkContent = currentChunk.join(' ').trim();
        const chunkEndChar = currentStartChar + chunkContent.length;

        chunks.push({
          content: chunkContent,
          startChar: currentStartChar,
          endChar: chunkEndChar,
          tokenCount: currentTokens,
          chunkIndex: chunkIndex++,
        });

        // Start new chunk with overlap
        // Include last few sentences for overlap
        const overlapSentences: string[] = [];
        let overlapTokens = 0;
        let overlapStart = currentChunk.length - 1;

        // Build overlap from end of previous chunk
        while (overlapStart >= 0 && overlapTokens < opts.overlapSize) {
          const sentenceToAdd = currentChunk[overlapStart];
          const sentenceTokenCount = this.estimateTokens(sentenceToAdd);
          if (overlapTokens + sentenceTokenCount <= opts.overlapSize) {
            overlapSentences.unshift(sentenceToAdd);
            overlapTokens += sentenceTokenCount;
            overlapStart--;
          } else {
            break;
          }
        }

        // Start new chunk with overlap
        currentChunk = [...overlapSentences, sentence];
        currentTokens = overlapTokens + sentenceTokens;
        currentStartChar = chunkEndChar - overlapSentences.join(' ').length;
      } else {
        // Add sentence to current chunk
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join(' ').trim();
      const chunkEndChar = currentStartChar + chunkContent.length;
      const finalTokens = this.estimateTokens(chunkContent);

      // Only add if it meets minimum size requirement
      if (finalTokens >= opts.minChunkSize || chunks.length === 0) {
        chunks.push({
          content: chunkContent,
          startChar: currentStartChar,
          endChar: chunkEndChar,
          tokenCount: finalTokens,
          chunkIndex: chunkIndex,
        });
      } else if (chunks.length > 0) {
        // Merge small final chunk with previous chunk
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content = (lastChunk.content + ' ' + chunkContent).trim();
        lastChunk.endChar = chunkEndChar;
        lastChunk.tokenCount = this.estimateTokens(lastChunk.content);
      }
    }

    logger.info('Text chunking completed', {
      totalChunks: chunks.length,
      totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      avgChunkSize: Math.round(
        chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length
      ),
    });

    return chunks;
  }

  /**
   * Count tokens in text (approximation)
   */
  static countTokens(text: string): number {
    return this.estimateTokens(text);
  }
}
