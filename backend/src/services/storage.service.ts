import path from 'path';
import { supabaseAdmin } from '../config/database';
import config from '../config/env';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

const BUCKET_NAME = config.SUPABASE_STORAGE_BUCKET;

export class StorageService {
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

  /**
   * Upload avatar image for user profile
   * Stores in avatars/{userId}/avatar.{ext}
   */
  static async uploadAvatar(userId: string, file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new ValidationError('File is required');
    }

    // Validate file type (images only)
    if (!file.mimetype.startsWith('image/')) {
      throw new ValidationError('File must be an image');
    }

    // Validate file size (max 5MB)
    const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_AVATAR_SIZE) {
      throw new ValidationError('Avatar image must be less than 5MB');
    }

    await this.ensureBucket();

    // Get file extension
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    const avatarPath = `avatars/${userId}/avatar${extension}`;

    // Delete old avatar if exists
    try {
      const { data: existingFiles } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .list(`avatars/${userId}`);
      
      if (existingFiles && existingFiles.length > 0) {
        const oldPaths = existingFiles.map(f => `avatars/${userId}/${f.name}`);
        await supabaseAdmin.storage.from(BUCKET_NAME).remove(oldPaths);
      }
    } catch (err) {
      // Ignore errors when deleting old avatar (might not exist)
      logger.warn('Failed to delete old avatar', { userId, error: err });
    }

    // Upload new avatar
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(avatarPath, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Replace if exists
      });

    if (error) {
      logger.error('Failed to upload avatar', { error: error.message, userId });
      throw new AppError('Avatar upload failed', 500, 'UPLOAD_FAILED');
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(avatarPath);

    return urlData.publicUrl;
  }
}
