import crypto from 'crypto';
import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

export interface CreateApiKeyInput {
  userId: string;
  topicId?: string;
  name: string;
  description?: string;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  expiresAt?: string;
}

export interface UpdateApiKeyInput {
  name?: string;
  description?: string;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  isActive?: boolean;
  expiresAt?: string;
}

/**
 * API Key Service
 * Handles API key generation, validation, and management
 */
export class ApiKeyService {
  /**
   * Generate a secure API key
   */
  private static generateApiKey(): { key: string; hash: string; prefix: string } {
    // Generate a secure random key
    const key = `qai_${crypto.randomBytes(32).toString('hex')}`;
    
    // Hash the key for storage (SHA-256)
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    
    // Store prefix for display (first 8 chars after prefix)
    const prefix = key.substring(0, 11); // "qai_" + 7 chars
    
    return { key, hash, prefix };
  }

  /**
   * Hash an API key
   */
  static hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create a new API key
   * Returns the plain key (only shown once) and the database record
   */
  static async createApiKey(input: CreateApiKeyInput): Promise<{
    apiKey: Database.ApiKey;
    plainKey: string; // Only returned once on creation
  }> {
    try {
      if (!input.userId) {
        throw new ValidationError('User ID is required');
      }

      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError('API key name is required');
      }

      // Verify topic belongs to user if provided
      if (input.topicId) {
        const { TopicService } = await import('./topic.service');
        const topic = await TopicService.getTopic(input.topicId, input.userId);
        if (!topic) {
          throw new ValidationError('Topic not found or access denied');
        }
      }

      // Check if name already exists for user
      const existing = await this.getApiKeyByName(input.userId, input.name);
      if (existing) {
        throw new ValidationError(`API key with name "${input.name}" already exists`);
      }

      // Generate API key
      const { key, hash, prefix } = this.generateApiKey();

      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .insert({
          user_id: input.userId,
          topic_id: input.topicId || null,
          key_hash: hash,
          key_prefix: prefix,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          rate_limit_per_hour: input.rateLimitPerHour || 100,
          rate_limit_per_day: input.rateLimitPerDay || 1000,
          expires_at: input.expiresAt || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating API key:', error);
        throw new AppError(
          `Failed to create API key: ${error.message}`,
          500,
          'API_KEY_CREATE_ERROR'
        );
      }

      logger.info('API key created', {
        apiKeyId: data.id,
        userId: input.userId,
        topicId: input.topicId,
        name: input.name,
      });

      return {
        apiKey: data,
        plainKey: key, // Return plain key only once
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error creating API key:', error);
      throw new AppError('Failed to create API key', 500, 'API_KEY_CREATE_ERROR');
    }
  }

  /**
   * Get API key by ID
   */
  static async getApiKey(
    apiKeyId: string,
    userId: string
  ): Promise<Database.ApiKey | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('id', apiKeyId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching API key:', error);
        throw new AppError(
          `Failed to fetch API key: ${error.message}`,
          500,
          'API_KEY_FETCH_ERROR'
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching API key:', error);
      throw new AppError('Failed to fetch API key', 500, 'API_KEY_FETCH_ERROR');
    }
  }

  /**
   * Get API key by name for a user
   */
  static async getApiKeyByName(
    userId: string,
    name: string
  ): Promise<Database.ApiKey | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('name', name.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching API key by name:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Unexpected error fetching API key by name:', error);
      return null;
    }
  }

  /**
   * Validate API key and return the key record
   */
  static async validateApiKey(apiKey: string): Promise<Database.ApiKey | null> {
    try {
      const hash = this.hashApiKey(apiKey);
      
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('key_hash', hash)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Key not found
        }
        logger.error('Error validating API key:', error);
        return null;
      }

      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        logger.warn('API key expired', { apiKeyId: data.id });
        return null;
      }

      // Update last_used_at
      await supabaseAdmin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);

      return data;
    } catch (error) {
      logger.error('Unexpected error validating API key:', error);
      return null;
    }
  }

  /**
   * Get all API keys for a user
   */
  static async getUserApiKeys(userId: string): Promise<Database.ApiKey[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user API keys:', error);
        throw new AppError(
          `Failed to fetch API keys: ${error.message}`,
          500,
          'API_KEY_FETCH_ERROR'
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching API keys:', error);
      throw new AppError('Failed to fetch API keys', 500, 'API_KEY_FETCH_ERROR');
    }
  }

  /**
   * Update API key
   */
  static async updateApiKey(
    apiKeyId: string,
    userId: string,
    updates: UpdateApiKeyInput
  ): Promise<Database.ApiKey> {
    try {
      // Verify API key belongs to user
      const apiKey = await this.getApiKey(apiKeyId, userId);
      if (!apiKey) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
      }

      // If name is being updated, check for conflicts
      if (updates.name && updates.name.trim() !== apiKey.name) {
        const existing = await this.getApiKeyByName(userId, updates.name);
        if (existing && existing.id !== apiKeyId) {
          throw new ValidationError(`API key with name "${updates.name}" already exists`);
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name.trim();
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description.trim() || null;
      }

      if (updates.rateLimitPerHour !== undefined) {
        updateData.rate_limit_per_hour = updates.rateLimitPerHour;
      }

      if (updates.rateLimitPerDay !== undefined) {
        updateData.rate_limit_per_day = updates.rateLimitPerDay;
      }

      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      if (updates.expiresAt !== undefined) {
        updateData.expires_at = updates.expiresAt || null;
      }

      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .update(updateData)
        .eq('id', apiKeyId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating API key:', error);
        throw new AppError(
          `Failed to update API key: ${error.message}`,
          500,
          'API_KEY_UPDATE_ERROR'
        );
      }

      logger.info('API key updated', {
        apiKeyId,
        userId,
        updates,
      });

      return data;
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error updating API key:', error);
      throw new AppError('Failed to update API key', 500, 'API_KEY_UPDATE_ERROR');
    }
  }

  /**
   * Delete API key
   */
  static async deleteApiKey(apiKeyId: string, userId: string): Promise<void> {
    try {
      // Verify API key belongs to user
      const apiKey = await this.getApiKey(apiKeyId, userId);
      if (!apiKey) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
      }

      const { error } = await supabaseAdmin
        .from('api_keys')
        .delete()
        .eq('id', apiKeyId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting API key:', error);
        throw new AppError(
          `Failed to delete API key: ${error.message}`,
          500,
          'API_KEY_DELETE_ERROR'
        );
      }

      logger.info('API key deleted', {
        apiKeyId,
        userId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error deleting API key:', error);
      throw new AppError('Failed to delete API key', 500, 'API_KEY_DELETE_ERROR');
    }
  }

  /**
   * Check rate limits for an API key
   */
  static async checkRateLimit(apiKeyId: string): Promise<{
    allowed: boolean;
    remainingPerHour?: number;
    remainingPerDay?: number;
  }> {
    try {
      const apiKey = await supabaseAdmin
        .from('api_keys')
        .select('rate_limit_per_hour, rate_limit_per_day')
        .eq('id', apiKeyId)
        .single();

      if (!apiKey.data) {
        return { allowed: false };
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count usage in last hour
      const { count: hourCount } = await supabaseAdmin
        .from('api_key_usage')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId)
        .gte('created_at', oneHourAgo.toISOString());

      // Count usage in last day
      const { count: dayCount } = await supabaseAdmin
        .from('api_key_usage')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId)
        .gte('created_at', oneDayAgo.toISOString());

      const hourLimit = apiKey.data.rate_limit_per_hour;
      const dayLimit = apiKey.data.rate_limit_per_day;

      const allowed = (hourCount || 0) < hourLimit && (dayCount || 0) < dayLimit;

      return {
        allowed,
        remainingPerHour: Math.max(0, hourLimit - (hourCount || 0)),
        remainingPerDay: Math.max(0, dayLimit - (dayCount || 0)),
      };
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return { allowed: false };
    }
  }

  /**
   * Log API key usage
   */
  static async logUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode?: number,
    responseTimeMs?: number
  ): Promise<void> {
    try {
      await supabaseAdmin.from('api_key_usage').insert({
        api_key_id: apiKeyId,
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
      });
    } catch (error) {
      logger.error('Error logging API key usage:', error);
      // Don't throw - logging is non-critical
    }
  }
}
