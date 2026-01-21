import OpenAI from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { ChunkingService, ChunkingOptions, TextChunk } from './chunking.service';
import { PineconeService } from './pinecone.service';

/**
 * Embedding Service
 * Handles document embedding generation and processing
 */
export class EmbeddingService {
  private static openai: OpenAI | null = null;

  /**
   * Get OpenAI client instance
   */
  private static getOpenAIClient(): OpenAI {
    if (!this.openai) {
      if (!config.OPENAI_API_KEY) {
        throw new AppError('OpenAI API key is not configured', 500, 'OPENAI_NOT_CONFIGURED');
      }
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * Generate embedding for a text
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const client = this.getOpenAIClient();
      
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      if (!response.data || response.data.length === 0) {
        throw new AppError('Failed to generate embedding', 500, 'EMBEDDING_GENERATION_ERROR');
      }

      return response.data[0].embedding;
    } catch (error: any) {
      logger.error('Error generating embedding:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate embedding', 500, 'EMBEDDING_GENERATION_ERROR');
    }
  }

  /**
   * Process document: chunk, generate embeddings, and store in Pinecone
   */
  static async processDocument(
    documentId: string,
    userId: string,
    text: string,
    chunkingOptions?: ChunkingOptions,
    topicId?: string
  ): Promise<{
    chunks: TextChunk[];
    embeddings: number[][];
    metadata: {
      totalChunks: number;
      totalTokens: number;
    };
  }> {
    try {
      // Chunk the text
      const chunks = ChunkingService.chunkText(text, chunkingOptions);

      logger.info('Document chunked', {
        documentId,
        chunkCount: chunks.length,
      });

      // Generate embeddings for all chunks
      const embeddings: number[][] = [];
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.content);
        embeddings.push(embedding);
      }

      logger.info('Embeddings generated', {
        documentId,
        embeddingCount: embeddings.length,
      });

      // Store embeddings in Pinecone
      // Generate chunk IDs for Pinecone
      const chunksWithIds = chunks.map((chunk, index) => ({
        id: `${documentId}_chunk_${index}`,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      }));

      await PineconeService.upsertVectors(
        documentId,
        chunksWithIds,
        embeddings,
        userId,
        topicId
      );

      logger.info('Vectors stored in Pinecone', {
        documentId,
        vectorCount: embeddings.length,
      });

      return {
        chunks: chunks, // chunks is already TextChunk[]
        embeddings,
        metadata: {
          totalChunks: chunks.length,
          totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        },
      };
    } catch (error: any) {
      logger.error('Error processing document:', {
        documentId,
        error: error.message,
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to process document', 500, 'DOCUMENT_PROCESSING_ERROR');
    }
  }
}
