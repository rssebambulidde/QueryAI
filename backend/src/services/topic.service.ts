import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

export interface CreateTopicInput {
  userId: string;
  name: string;
  description?: string;
  scopeConfig?: Record<string, any>;
}

export interface UpdateTopicInput {
  name?: string;
  description?: string;
  scopeConfig?: Record<string, any>;
}

/**
 * Topic Service
 * Handles topic management operations
 */
export class TopicService {
  /**
   * Create a new topic
   */
  static async createTopic(input: CreateTopicInput): Promise<Database.Topic> {
    try {
      if (!input.userId) {
        throw new ValidationError('User ID is required');
      }

      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError('Topic name is required');
      }

      // Check if topic with same name already exists for user
      const existing = await this.getTopicByName(input.userId, input.name);
      if (existing) {
        throw new ValidationError(`Topic "${input.name}" already exists`);
      }

      const { data, error } = await supabaseAdmin
        .from('topics')
        .insert({
          user_id: input.userId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          scope_config: input.scopeConfig || {},
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating topic:', error);
        throw new AppError(
          `Failed to create topic: ${error.message}`,
          500,
          'TOPIC_CREATE_ERROR'
        );
      }

      logger.info('Topic created', {
        topicId: data.id,
        userId: input.userId,
        name: input.name,
      });

      return data;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error creating topic:', error);
      throw new AppError('Failed to create topic', 500, 'TOPIC_CREATE_ERROR');
    }
  }

  /**
   * Get topic by ID
   */
  static async getTopic(
    topicId: string,
    userId: string
  ): Promise<Database.Topic | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('topics')
        .select('*')
        .eq('id', topicId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        logger.error('Error fetching topic:', error);
        throw new AppError(
          `Failed to fetch topic: ${error.message}`,
          500,
          'TOPIC_FETCH_ERROR'
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching topic:', error);
      throw new AppError('Failed to fetch topic', 500, 'TOPIC_FETCH_ERROR');
    }
  }

  /**
   * Get topic by name for a user
   */
  static async getTopicByName(
    userId: string,
    name: string
  ): Promise<Database.Topic | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('topics')
        .select('*')
        .eq('user_id', userId)
        .eq('name', name.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching topic by name:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Unexpected error fetching topic by name:', error);
      return null;
    }
  }

  /**
   * Get all topics for a user
   */
  static async getUserTopics(userId: string): Promise<Database.Topic[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('topics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user topics:', error);
        throw new AppError(
          `Failed to fetch topics: ${error.message}`,
          500,
          'TOPIC_FETCH_ERROR'
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching topics:', error);
      throw new AppError('Failed to fetch topics', 500, 'TOPIC_FETCH_ERROR');
    }
  }

  /**
   * Update topic
   */
  static async updateTopic(
    topicId: string,
    userId: string,
    updates: UpdateTopicInput
  ): Promise<Database.Topic> {
    try {
      // Verify topic belongs to user
      const topic = await this.getTopic(topicId, userId);
      if (!topic) {
        throw new AppError('Topic not found', 404, 'TOPIC_NOT_FOUND');
      }

      // If name is being updated, check for conflicts
      if (updates.name && updates.name.trim() !== topic.name) {
        const existing = await this.getTopicByName(userId, updates.name);
        if (existing && existing.id !== topicId) {
          throw new ValidationError(`Topic "${updates.name}" already exists`);
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

      if (updates.scopeConfig !== undefined) {
        // Merge with existing scope_config
        const currentScopeConfig = topic.scope_config || {};
        updateData.scope_config = { ...currentScopeConfig, ...updates.scopeConfig };
      }

      const { data, error } = await supabaseAdmin
        .from('topics')
        .update(updateData)
        .eq('id', topicId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating topic:', error);
        throw new AppError(
          `Failed to update topic: ${error.message}`,
          500,
          'TOPIC_UPDATE_ERROR'
        );
      }

      logger.info('Topic updated', {
        topicId,
        userId,
        updates,
      });

      return data;
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error updating topic:', error);
      throw new AppError('Failed to update topic', 500, 'TOPIC_UPDATE_ERROR');
    }
  }

  /**
   * Delete topic
   */
  static async deleteTopic(topicId: string, userId: string): Promise<void> {
    try {
      // Verify topic belongs to user
      const topic = await this.getTopic(topicId, userId);
      if (!topic) {
        throw new AppError('Topic not found', 404, 'TOPIC_NOT_FOUND');
      }

      const { error } = await supabaseAdmin
        .from('topics')
        .delete()
        .eq('id', topicId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting topic:', error);
        throw new AppError(
          `Failed to delete topic: ${error.message}`,
          500,
          'TOPIC_DELETE_ERROR'
        );
      }

      logger.info('Topic deleted', {
        topicId,
        userId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error deleting topic:', error);
      throw new AppError('Failed to delete topic', 500, 'TOPIC_DELETE_ERROR');
    }
  }
}
