import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import { Database } from '../types/database';

export interface CreateDocumentInput {
  user_id: string;
  topic_id?: string;
  filename: string;
  file_path: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'md';
  file_size: number;
}

export interface UpdateDocumentInput {
  status?: 'processing' | 'extracted' | 'failed' | 'embedding' | 'embedded' | 'embedding_failed' | 'processed';
  extracted_text?: string;
  text_length?: number;
  extraction_error?: string;
  embedding_error?: string;
  metadata?: Record<string, any>;
}

export class DocumentService {
  /**
   * Create a new document record
   */
  static async createDocument(input: CreateDocumentInput): Promise<Database.Document> {
    try {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .insert({
          user_id: input.user_id,
          topic_id: input.topic_id || null,
          filename: input.filename,
          file_path: input.file_path,
          file_type: input.file_type,
          file_size: input.file_size,
          status: 'processing',
          metadata: {},
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create document record', {
          error: error.message,
          userId: input.user_id,
          filename: input.filename,
        });
        throw new AppError('Failed to create document record', 500, 'DB_ERROR');
      }

      logger.info('Document record created', {
        documentId: data.id,
        userId: input.user_id,
        filename: input.filename,
      });

      return data as Database.Document;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error creating document', { error: error.message });
      throw new AppError('Failed to create document', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Update document record
   */
  static async updateDocument(
    documentId: string,
    userId: string,
    updates: UpdateDocumentInput
  ): Promise<Database.Document> {
    try {
      // Verify document belongs to user
      const existing = await this.getDocument(documentId, userId);
      if (!existing) {
        throw new ValidationError('Document not found');
      }

      const { data, error } = await supabaseAdmin
        .from('documents')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update document', {
          error: error.message,
          documentId,
          userId,
        });
        throw new AppError('Failed to update document', 500, 'DB_ERROR');
      }

      logger.info('Document updated', {
        documentId,
        userId,
        updates: Object.keys(updates),
      });

      return data as Database.Document;
    } catch (error: any) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error updating document', { error: error.message });
      throw new AppError('Failed to update document', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Get document by ID
   */
  static async getDocument(
    documentId: string,
    userId: string
  ): Promise<Database.Document | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        logger.error('Failed to get document', {
          error: error.message,
          documentId,
          userId,
        });
        throw new AppError('Failed to get document', 500, 'DB_ERROR');
      }

      return data as Database.Document;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error getting document', { error: error.message });
      throw new AppError('Failed to get document', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Get document by file path
   */
  static async getDocumentByPath(
    filePath: string,
    userId: string
  ): Promise<Database.Document | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('file_path', filePath)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Failed to get document by path', {
          error: error.message,
          filePath,
          userId,
        });
        throw new AppError('Failed to get document', 500, 'DB_ERROR');
      }

      return data as Database.Document;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error getting document by path', { error: error.message });
      throw new AppError('Failed to get document', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * List documents for a user
   */
  static async listDocuments(
    userId: string,
    options?: {
      status?: 'processing' | 'extracted' | 'failed';
      topic_id?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Database.Document[]> {
    try {
      let query = supabaseAdmin
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.topic_id) {
        query = query.eq('topic_id', options.topic_id);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        // Check if table doesn't exist (PostgreSQL error code 42P01 or PGRST error)
        if (error.code === '42P01' || error.code === 'PGRST116' || 
            error.message?.includes('relation') && error.message?.includes('does not exist')) {
          // Re-throw with a specific error that the route can catch
          const tableNotFoundError = new Error('TABLE_NOT_FOUND');
          (tableNotFoundError as any).code = 'TABLE_NOT_FOUND';
          throw tableNotFoundError;
        }
        
        logger.error('Failed to list documents', {
          error: error.message,
          errorCode: error.code,
          userId,
        });
        throw new AppError('Failed to list documents', 500, 'DB_ERROR');
      }

      return (data || []) as Database.Document[];
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      // Re-throw table not found error
      if (error.code === 'TABLE_NOT_FOUND' || error.message === 'TABLE_NOT_FOUND') {
        throw error;
      }
      logger.error('Unexpected error listing documents', { error: error.message });
      throw new AppError('Failed to list documents', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Get extracted text for a document
   */
  static async getDocumentText(
    documentId: string,
    userId: string
  ): Promise<{ text: string; stats: any; extractedAt: string } | null> {
    try {
      const document = await this.getDocument(documentId, userId);

      if (!document) {
        return null;
      }

      if (document.status !== 'extracted' || !document.extracted_text) {
        throw new ValidationError('Document text not yet extracted');
      }

      return {
        text: document.extracted_text,
        stats: {
          length: document.text_length || 0,
          wordCount: document.metadata?.wordCount || 0,
          pageCount: document.metadata?.pageCount,
          paragraphCount: document.metadata?.paragraphCount,
        },
        extractedAt: document.updated_at,
      };
    } catch (error: any) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error getting document text', { error: error.message });
      throw new AppError('Failed to get document text', 500, 'UNKNOWN_ERROR');
    }
  }

  /**
   * Delete document record
   */
  static async deleteDocument(documentId: string, userId: string): Promise<void> {
    try {
      // Verify document belongs to user
      const existing = await this.getDocument(documentId, userId);
      if (!existing) {
        throw new ValidationError('Document not found');
      }

      const { error } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to delete document', {
          error: error.message,
          documentId,
          userId,
        });
        throw new AppError('Failed to delete document', 500, 'DB_ERROR');
      }

      logger.info('Document deleted', { documentId, userId });
    } catch (error: any) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error deleting document', { error: error.message });
      throw new AppError('Failed to delete document', 500, 'UNKNOWN_ERROR');
    }
  }
}
