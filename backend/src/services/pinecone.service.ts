import { getPineconeIndex, isPineconeConfigured } from '../config/pinecone';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { ChunkService } from './chunk.service';

export interface VectorMetadata {
  userId: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  topicId?: string;
  content: string;
  createdAt: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  score: number;
  metadata: VectorMetadata;
}

const EMBEDDING_DIMENSIONS = 1536; // OpenAI text-embedding-3-small

/**
 * Pinecone Service
 * Handles vector storage and semantic search operations
 */
export class PineconeService {
  /**
   * Generate unique vector ID
   */
  private static generateVectorId(documentId: string, chunkId: string): string {
    return `${documentId}:${chunkId}`;
  }

  /**
   * Parse vector ID to get document and chunk IDs
   */
  private static parseVectorId(vectorId: string): { documentId: string; chunkId: string } {
    const parts = vectorId.split(':');
    if (parts.length !== 2) {
      throw new AppError('Invalid vector ID format', 400, 'INVALID_VECTOR_ID');
    }
    return {
      documentId: parts[0],
      chunkId: parts[1],
    };
  }

  /**
   * Upsert vectors to Pinecone
   */
  static async upsertVectors(
    documentId: string,
    chunks: Array<{ id: string; chunkIndex: number; content: string }>,
    embeddings: number[][],
    userId: string,
    topicId?: string
  ): Promise<string[]> {
    if (!isPineconeConfigured()) {
      throw new AppError('Pinecone is not configured', 500, 'PINECONE_NOT_CONFIGURED');
    }

    if (chunks.length !== embeddings.length) {
      throw new AppError(
        `Mismatch: ${chunks.length} chunks but ${embeddings.length} embeddings`,
        400,
        'CHUNK_EMBEDDING_MISMATCH'
      );
    }

    try {
      const index = await getPineconeIndex();
      const vectors = chunks.map((chunk, i) => {
        const vectorId = this.generateVectorId(documentId, chunk.id);
        const embedding = embeddings[i];

        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new AppError(
            `Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
            400,
            'INVALID_EMBEDDING_DIMENSIONS'
          );
        }

        const metadata: VectorMetadata = {
          userId,
          documentId,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.substring(0, 1000), // Limit metadata size
          createdAt: new Date().toISOString(),
        };

        if (topicId) {
          metadata.topicId = topicId;
        }

        return {
          id: vectorId,
          values: embedding,
          metadata: metadata as any, // Pinecone accepts any for metadata
        };
      });

      logger.info('Upserting vectors to Pinecone', {
        documentId,
        vectorCount: vectors.length,
      });

      // Upsert in batches of 100 (Pinecone limit)
      const batchSize = 100;
      const vectorIds: string[] = [];

      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        
        try {
          // New Pinecone SDK uses upsert with records array
          await index.upsert(batch);
          
          logger.info(`Upserted batch ${Math.floor(i / batchSize) + 1}`, {
            documentId,
            batchSize: batch.length,
            total: vectors.length,
          });
          
          vectorIds.push(...batch.map(v => v.id));
        } catch (batchError: any) {
          logger.error(`Failed to upsert batch ${Math.floor(i / batchSize) + 1}`, {
            documentId,
            batchSize: batch.length,
            error: batchError.message,
            errorDetails: batchError,
          });
          throw batchError; // Re-throw to fail the entire operation
        }
      }

      logger.info('Vectors upserted successfully', {
        documentId,
        vectorCount: vectorIds.length,
      });

      // Update chunk records with Pinecone IDs
      for (let i = 0; i < chunks.length; i++) {
        const vectorId = vectorIds[i];
        try {
          await ChunkService.updateChunkEmbeddingId(chunks[i].id, vectorId);
        } catch (error: any) {
          logger.warn('Failed to update chunk embedding ID', {
            chunkId: chunks[i].id,
            vectorId,
            error: error.message,
          });
        }
      }

      return vectorIds;
    } catch (error: any) {
      logger.error('Failed to upsert vectors to Pinecone', {
        documentId,
        error: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        errorStatus: error.status,
        chunksCount: chunks.length,
        embeddingsCount: embeddings.length,
      });

      if (error instanceof AppError) {
        throw error;
      }

      // Provide more detailed error information
      const errorMessage = error.message || 'Unknown error';
      const errorDetails = error.response?.data || error.body || {};
      
      logger.error('Pinecone upsert error details', {
        documentId,
        errorMessage,
        errorDetails,
      });

      throw new AppError(
        `Failed to upsert vectors to Pinecone: ${errorMessage}. Details: ${JSON.stringify(errorDetails)}`,
        500,
        'PINECONE_ERROR'
      );
    }
  }

  /**
   * Delete vectors from Pinecone
   */
  static async deleteVectors(documentId: string, vectorIds: string[]): Promise<void> {
    if (!isPineconeConfigured()) {
      logger.warn('Pinecone not configured, skipping vector deletion');
      return;
    }

    if (vectorIds.length === 0) {
      return;
    }

    try {
      const index = await getPineconeIndex();
      await index.deleteMany(vectorIds);

      logger.info('Vectors deleted from Pinecone', {
        documentId,
        vectorCount: vectorIds.length,
      });
    } catch (error: any) {
      logger.error('Failed to delete vectors from Pinecone', {
        documentId,
        error: error.message,
      });
      // Don't throw - deletion failure shouldn't break the flow
    }
  }

  /**
   * Delete all vectors for a document
   */
  static async deleteDocumentVectors(documentId: string): Promise<void> {
    if (!isPineconeConfigured()) {
      logger.warn('Pinecone not configured, skipping vector deletion');
      return;
    }

    try {
      const index = await getPineconeIndex();
      
      // Delete by metadata filter
      await index.deleteMany({
        filter: {
          documentId: { $eq: documentId },
        },
      });

      logger.info('Document vectors deleted from Pinecone', {
        documentId,
      });
    } catch (error: any) {
      logger.error('Failed to delete document vectors from Pinecone', {
        documentId,
        error: error.message,
      });
      // Don't throw - deletion failure shouldn't break the flow
    }
  }

  /**
   * Semantic search - find similar vectors
   */
  static async search(
    queryEmbedding: number[],
    options: {
      userId: string;
      topK?: number;
      topicId?: string;
      documentIds?: string[];
      minScore?: number;
    }
  ): Promise<SearchResult[]> {
    if (!isPineconeConfigured()) {
      throw new AppError('Pinecone is not configured', 500, 'PINECONE_NOT_CONFIGURED');
    }

    if (queryEmbedding.length !== EMBEDDING_DIMENSIONS) {
      throw new AppError(
        `Invalid query embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${queryEmbedding.length}`,
        400,
        'INVALID_EMBEDDING_DIMENSIONS'
      );
    }

    try {
      const index = await getPineconeIndex();
      const topK = options.topK || 10;
      const minScore = options.minScore || 0.7;

      // Build filter
      const filter: any = {
        userId: { $eq: options.userId },
      };

      if (options.topicId) {
        filter.topicId = { $eq: options.topicId };
      }

      if (options.documentIds && options.documentIds.length > 0) {
        filter.documentId = { $in: options.documentIds };
      }

      logger.debug('Performing semantic search', {
        topK,
        filter,
      });

      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });

      const results: SearchResult[] = [];

      for (const match of queryResponse.matches || []) {
        // Filter by minimum score
        if (match.score && match.score < minScore) {
          continue;
        }

        const metadata = (match.metadata || {}) as unknown as VectorMetadata;
        const { documentId, chunkId } = this.parseVectorId(match.id);

        results.push({
          chunkId: metadata.chunkId || chunkId,
          documentId: metadata.documentId || documentId,
          content: metadata.content || '',
          chunkIndex: metadata.chunkIndex || 0,
          score: match.score || 0,
          metadata,
        });
      }

      logger.info('Semantic search completed', {
        queryTopK: topK,
        resultsCount: results.length,
        userId: options.userId,
      });

      return results;
    } catch (error: any) {
      logger.error('Failed to perform semantic search', {
        error: error.message,
        userId: options.userId,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(`Semantic search failed: ${error.message}`, 500, 'PINECONE_SEARCH_ERROR');
    }
  }

  /**
   * Get index stats
   */
  static async getIndexStats(): Promise<{ totalVectors: number }> {
    if (!isPineconeConfigured()) {
      throw new AppError('Pinecone is not configured', 500, 'PINECONE_NOT_CONFIGURED');
    }

    try {
      const index = await getPineconeIndex();
      const stats = await index.describeIndexStats();

      return {
        totalVectors: stats.totalRecordCount || 0,
      };
    } catch (error: any) {
      logger.error('Failed to get index stats', {
        error: error.message,
      });
      throw new AppError(`Failed to get index stats: ${error.message}`, 500, 'PINECONE_ERROR');
    }
  }
}
