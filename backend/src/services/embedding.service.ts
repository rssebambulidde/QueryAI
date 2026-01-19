import { openai } from '../config/openai';
import config from '../config/env';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { ChunkingService, TextChunk } from './chunking.service';
import { DocumentService } from './document.service';

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  tokenCount: number;
}

export interface EmbeddingMetadata {
  model: string;
  dimensions: number;
  chunkCount: number;
  totalTokens: number;
  completedAt: string;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100; // Process up to 100 chunks at once
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Embedding Service
 * Generates vector embeddings for text chunks using OpenAI API
 */
export class EmbeddingService {
  /**
   * Generate embedding for a single text chunk
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!config.OPENAI_API_KEY) {
      throw new AppError('OpenAI API key not configured', 500, 'OPENAI_NOT_CONFIGURED');
    }

    if (!text || text.trim().length === 0) {
      throw new AppError('Text cannot be empty', 400, 'EMPTY_TEXT');
    }

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.trim(),
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError('No embedding returned from OpenAI', 500, 'EMBEDDING_ERROR');
      }

      return response.data[0].embedding;
    } catch (error: any) {
      logger.error('Failed to generate embedding', {
        error: error.message,
        code: error.code,
      });

      if (error.status === 401) {
        throw new AppError('Invalid OpenAI API key', 500, 'OPENAI_AUTH_ERROR');
      }
      if (error.status === 429) {
        throw new AppError('OpenAI API rate limit exceeded', 429, 'RATE_LIMIT_ERROR');
      }

      throw new AppError(`Failed to generate embedding: ${error.message}`, 500, 'EMBEDDING_ERROR');
    }
  }

  /**
   * Generate embeddings for multiple text chunks (batch processing)
   */
  static async generateEmbeddingsBatch(
    texts: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    if (!config.OPENAI_API_KEY) {
      throw new AppError('OpenAI API key not configured', 500, 'OPENAI_NOT_CONFIGURED');
    }

    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];
    const total = texts.length;

    logger.info('Starting batch embedding generation', {
      totalChunks: total,
      batchSize: BATCH_SIZE,
    });

    // Process in batches
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

      logger.debug(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length,
        startIndex: i,
      });

      try {
        // OpenAI supports batch requests
        const response = await this.retryWithBackoff(
          () =>
            openai.embeddings.create({
              model: EMBEDDING_MODEL,
              input: batch.map(t => t.trim()),
            }),
          MAX_RETRIES
        );

        if (!response.data || response.data.length !== batch.length) {
          throw new AppError(
            `Expected ${batch.length} embeddings, got ${response.data?.length || 0}`,
            500,
            'EMBEDDING_BATCH_ERROR'
          );
        }

        // Add embeddings in order
        for (const item of response.data) {
          embeddings.push(item.embedding);
        }

        const completed = Math.min(i + batch.length, total);
        if (onProgress) {
          onProgress(completed, total);
        }

        logger.debug(`Batch ${batchNumber} completed`, {
          completed,
          total,
          progress: `${Math.round((completed / total) * 100)}%`,
        });
      } catch (error: any) {
        logger.error(`Failed to process batch ${batchNumber}`, {
          error: error.message,
          batchSize: batch.length,
        });
        throw error;
      }
    }

    logger.info('Batch embedding generation completed', {
      totalEmbeddings: embeddings.length,
    });

    return embeddings;
  }

  /**
   * Process document: chunk text and generate embeddings
   */
  static async processDocument(
    documentId: string,
    userId: string,
    text: string,
    options?: {
      maxChunkSize?: number;
      overlapSize?: number;
    }
  ): Promise<{
    chunks: TextChunk[];
    embeddings: number[][];
    metadata: EmbeddingMetadata;
  }> {
    if (!text || text.trim().length === 0) {
      throw new AppError('Document text is empty', 400, 'EMPTY_TEXT');
    }

    logger.info('Starting document embedding process', {
      documentId,
      textLength: text.length,
    });

    // Step 1: Chunk the text
    const chunks = ChunkingService.chunkText(text, {
      maxChunkSize: options?.maxChunkSize,
      overlapSize: options?.overlapSize,
    });

    if (chunks.length === 0) {
      throw new AppError('No chunks created from text', 400, 'NO_CHUNKS');
    }

    logger.info('Text chunking completed', {
      documentId,
      chunkCount: chunks.length,
    });

    // Step 2: Generate embeddings for all chunks
    const chunkTexts = chunks.map(chunk => chunk.content);
    const embeddings = await this.generateEmbeddingsBatch(chunkTexts, (completed, total) => {
      logger.debug('Embedding progress', {
        documentId,
        completed,
        total,
        progress: `${Math.round((completed / total) * 100)}%`,
      });
    });

    if (embeddings.length !== chunks.length) {
      throw new AppError(
        `Mismatch: ${chunks.length} chunks but ${embeddings.length} embeddings`,
        500,
        'EMBEDDING_MISMATCH'
      );
    }

    // Step 3: Calculate metadata
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const metadata: EmbeddingMetadata = {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      chunkCount: chunks.length,
      totalTokens,
      completedAt: new Date().toISOString(),
    };

    logger.info('Document embedding process completed', {
      documentId,
      chunkCount: chunks.length,
      totalTokens,
    });

    return {
      chunks,
      embeddings,
      metadata,
    };
  }

  /**
   * Retry function with exponential backoff
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    delay: number = RETRY_DELAY
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on authentication errors
        if (error.status === 401) {
          throw error;
        }

        // Don't retry on client errors (4xx) except 429
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        if (attempt < maxRetries) {
          const backoffDelay = delay * Math.pow(2, attempt - 1);
          logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${backoffDelay}ms`, {
            error: error.message,
          });
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Get embedding model info
   */
  static getModelInfo(): { model: string; dimensions: number } {
    return {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}
