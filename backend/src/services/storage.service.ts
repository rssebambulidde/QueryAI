import path from 'path';
import { supabaseAdmin } from '../config/database';
import config from '../config/env';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

export interface StoredDocument {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt?: string;
  updatedAt?: string;
}

const BUCKET_NAME = config.SUPABASE_STORAGE_BUCKET;

export class StorageService {
  private static sanitizeFileName(originalName: string): string {
    const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base.length > 120 ? base.slice(0, 120) : base;
  }

  private static async ensureBucket(): Promise<void> {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      logger.error('Failed to list storage buckets', { error: error.message });
      throw new AppError('Storage initialization failed', 500, 'STORAGE_ERROR');
    }

    const exists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);
    if (!exists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: false,
      });
      if (createError) {
        logger.error('Failed to create storage bucket', { error: createError.message });
        throw new AppError('Storage bucket creation failed', 500, 'STORAGE_ERROR');
      }
    }
  }

  static async uploadDocument(userId: string, file: Express.Multer.File): Promise<StoredDocument> {
    if (!file) {
      throw new ValidationError('File is required');
    }

    await this.ensureBucket();

    const safeName = this.sanitizeFileName(file.originalname);
    const filePath = `${userId}/${Date.now()}-${safeName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      logger.error('Failed to upload document', { error: error.message, userId });
      throw new AppError('Document upload failed', 500, 'UPLOAD_FAILED');
    }

    return {
      path: data?.path || filePath,
      name: safeName,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  static async listDocuments(userId: string): Promise<StoredDocument[]> {
    await this.ensureBucket();

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(userId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      logger.error('Failed to list documents', { error: error.message, userId });
      throw new AppError('Failed to list documents', 500, 'LIST_FAILED');
    }

    return (data || [])
      .filter((item) => item.name)
      .map((item) => ({
        path: `${userId}/${item.name}`,
        name: item.name,
        size: item.metadata?.size || 0,
        mimeType: item.metadata?.mimetype || 'application/octet-stream',
        createdAt: item.created_at || undefined,
        updatedAt: item.updated_at || undefined,
      }));
  }

  static async deleteDocument(userId: string, filePath: string): Promise<void> {
    if (!filePath) {
      throw new ValidationError('File path is required');
    }

    if (!filePath.startsWith(`${userId}/`)) {
      throw new ValidationError('Invalid file path');
    }

    await this.ensureBucket();

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      logger.error('Failed to delete document', { error: error.message, userId });
      throw new AppError('Failed to delete document', 500, 'DELETE_FAILED');
    }
  }
}
