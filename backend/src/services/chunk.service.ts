import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';
import { Database } from '../types/database';
import { AppError, ValidationError } from '../types/error';
import { TextChunk } from './chunking.service';

/**
 * Chunk Service
 * Handles database operations for document chunks
 */
export class ChunkService {
  /**
   * Create chunks for a document
   */
  static async createChunks(
    documentId: string,
    chunks: TextChunk[]
  ): Promise<Database.DocumentChunk[]> {
    try {
      const chunkRecords = chunks.map(chunk => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        start_char: chunk.startChar,
        end_char: chunk.endChar,
        token_count: chunk.tokenCount,
      }));

      const { data, error } = await supabaseAdmin
        .from('document_chunks')
        .insert(chunkRecords)
        .select('*');

      if (error) {
        logger.error('Failed to create chunks', {
          error: error.message,
          documentId,
          chunkCount: chunks.length,
        });
        throw new AppError('Failed to create chunks', 500, 'DB_ERROR');
      }

      logger.info('Chunks created successfully', {
        documentId,
        chunkCount: data.length,
      });

      return data as Database.DocumentChunk[];
    } catch (error: any) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error creating chunks', { error: error.message });
      throw new AppError('Failed to create chunks', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Get all chunks for a document
   */
  static async getChunksByDocument(
    documentId: string,
    userId: string
  ): Promise<Database.DocumentChunk[]> {
    try {
      // Verify document belongs to user
      const { data: document, error: docError } = await supabaseAdmin
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (docError || !document) {
        throw new ValidationError('Document not found or access denied');
      }

      const { data, error } = await supabaseAdmin
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });

      if (error) {
        logger.error('Failed to get chunks', {
          error: error.message,
          documentId,
        });
        throw new AppError('Failed to get chunks', 500, 'DB_ERROR');
      }

      return (data || []) as Database.DocumentChunk[];
    } catch (error: any) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error getting chunks', { error: error.message });
      throw new AppError('Failed to get chunks', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Update chunk with embedding ID (for Pinecone reference)
   */
  static async updateChunkEmbeddingId(
    chunkId: string,
    embeddingId: string
  ): Promise<Database.DocumentChunk> {
    try {
      const { data, error } = await supabaseAdmin
        .from('document_chunks')
        .update({ embedding_id: embeddingId })
        .eq('id', chunkId)
        .select('*')
        .single();

      if (error) {
        logger.error('Failed to update chunk embedding ID', {
          error: error.message,
          chunkId,
        });
        throw new AppError('Failed to update chunk embedding ID', 500, 'DB_ERROR');
      }

      return data as Database.DocumentChunk;
    } catch (error: any) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error updating chunk', { error: error.message });
      throw new AppError('Failed to update chunk', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Delete all chunks for a document
   */
  static async deleteChunksByDocument(documentId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      if (error) {
        logger.error('Failed to delete chunks', {
          error: error.message,
          documentId,
        });
        throw new AppError('Failed to delete chunks', 500, 'DB_ERROR');
      }

      logger.info('Chunks deleted successfully', { documentId });
    } catch (error: any) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error deleting chunks', { error: error.message });
      throw new AppError('Failed to delete chunks', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Get chunk count for a document
   */
  static async getChunkCount(documentId: string): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (error) {
        logger.error('Failed to get chunk count', {
          error: error.message,
          documentId,
        });
        return 0;
      }

      return count || 0;
    } catch (error: any) {
      logger.error('Unexpected error getting chunk count', { error: error.message });
      return 0;
    }
  }
}
