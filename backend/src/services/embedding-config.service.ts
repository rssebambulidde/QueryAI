import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import { TopicService } from './topic.service';

export interface CreateEmbeddingConfigInput {
  userId: string;
  topicId: string;
  name: string;
  customization?: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    avatarUrl?: string;
    greetingMessage?: string;
    theme?: 'light' | 'dark';
    showBranding?: boolean;
    [key: string]: any;
  };
}

export interface UpdateEmbeddingConfigInput {
  name?: string;
  customization?: Record<string, any>;
  isActive?: boolean;
}

/**
 * Embedding Config Service
 * Handles embeddable chatbot configurations
 */
export class EmbeddingConfigService {
  /**
   * Generate embed code for a configuration
   */
  private static generateEmbedCode(configId: string, apiUrl: string): string {
    const embedUrl = `${apiUrl}/embed/${configId}`;
    
    return `<!-- QueryAI Embeddable Chatbot -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${apiUrl}/embed/script.js';
    script.setAttribute('data-config-id', '${configId}');
    script.setAttribute('data-api-url', '${apiUrl}');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
<!-- End QueryAI Embed -->`;
  }

  /**
   * Create embedding configuration
   */
  static async createEmbeddingConfig(
    input: CreateEmbeddingConfigInput
  ): Promise<Database.EmbeddingConfig> {
    try {
      if (!input.userId) {
        throw new ValidationError('User ID is required');
      }

      if (!input.topicId) {
        throw new ValidationError('Topic ID is required');
      }

      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError('Configuration name is required');
      }

      // Verify topic belongs to user
      const topic = await TopicService.getTopic(input.topicId, input.userId);
      if (!topic) {
        throw new ValidationError('Topic not found or access denied');
      }

      // Check if name already exists for user/topic combination
      const existing = await this.getEmbeddingConfigByName(
        input.userId,
        input.topicId,
        input.name
      );
      if (existing) {
        throw new ValidationError(
          `An embedding configuration with the name "${input.name}" already exists for this topic. Please choose a different name.`
        );
      }

      const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Insert without specifying id - let database generate UUID
      const { data, error } = await supabaseAdmin
        .from('embedding_configs')
        .insert({
          user_id: input.userId,
          topic_id: input.topicId,
          name: input.name.trim(),
          customization: input.customization || {},
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating embedding config:', error);
        throw new AppError(
          `Failed to create embedding configuration: ${error.message}`,
          500,
          'EMBEDDING_CREATE_ERROR'
        );
      }

      // Update with embed_code after getting the generated ID
      const configId = data.id;
      const embedCode = this.generateEmbedCode(configId, apiUrl);
      
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('embedding_configs')
        .update({ embed_code: embedCode })
        .eq('id', configId)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating embedding config with embed code:', updateError);
        // Don't fail - embed_code is optional, just log the error
      }

      const finalData = updatedData || data;

      logger.info('Embedding config created', {
        configId: finalData.id,
        userId: input.userId,
        topicId: input.topicId,
        name: input.name,
      });

      return finalData;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error creating embedding config:', error);
      throw new AppError(
        'Failed to create embedding configuration',
        500,
        'EMBEDDING_CREATE_ERROR'
      );
    }
  }

  /**
   * Get embedding config by ID
   */
  static async getEmbeddingConfig(
    configId: string,
    userId?: string
  ): Promise<Database.EmbeddingConfig | null> {
    try {
      let query = supabaseAdmin
        .from('embedding_configs')
        .select('*')
        .eq('id', configId)
        .eq('is_active', true);

      // If userId provided, verify ownership (for authenticated requests)
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching embedding config:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Unexpected error fetching embedding config:', error);
      return null;
    }
  }

  /**
   * Get embedding config by name
   */
  static async getEmbeddingConfigByName(
    userId: string,
    topicId: string,
    name: string
  ): Promise<Database.EmbeddingConfig | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('embedding_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('topic_id', topicId)
        .eq('name', name.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching embedding config by name:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Unexpected error fetching embedding config by name:', error);
      return null;
    }
  }

  /**
   * Get all embedding configs for a user
   */
  static async getUserEmbeddingConfigs(
    userId: string
  ): Promise<Database.EmbeddingConfig[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('embedding_configs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user embedding configs:', error);
        throw new AppError(
          `Failed to fetch embedding configurations: ${error.message}`,
          500,
          'EMBEDDING_FETCH_ERROR'
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching embedding configs:', error);
      throw new AppError(
        'Failed to fetch embedding configurations',
        500,
        'EMBEDDING_FETCH_ERROR'
      );
    }
  }

  /**
   * Update embedding config
   */
  static async updateEmbeddingConfig(
    configId: string,
    userId: string,
    updates: UpdateEmbeddingConfigInput
  ): Promise<Database.EmbeddingConfig> {
    try {
      // Verify config belongs to user
      const config = await this.getEmbeddingConfig(configId, userId);
      if (!config) {
        throw new AppError('Embedding configuration not found', 404, 'EMBEDDING_NOT_FOUND');
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name.trim();
      }

      if (updates.customization !== undefined) {
        // Merge with existing customization
        const currentCustomization = config.customization || {};
        updateData.customization = { ...currentCustomization, ...updates.customization };
      }

      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      const { data, error } = await supabaseAdmin
        .from('embedding_configs')
        .update(updateData)
        .eq('id', configId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating embedding config:', error);
        throw new AppError(
          `Failed to update embedding configuration: ${error.message}`,
          500,
          'EMBEDDING_UPDATE_ERROR'
        );
      }

      logger.info('Embedding config updated', {
        configId,
        userId,
        updates,
      });

      return data;
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error updating embedding config:', error);
      throw new AppError(
        'Failed to update embedding configuration',
        500,
        'EMBEDDING_UPDATE_ERROR'
      );
    }
  }

  /**
   * Delete embedding config
   */
  static async deleteEmbeddingConfig(configId: string, userId: string): Promise<void> {
    try {
      // Verify config belongs to user
      const config = await this.getEmbeddingConfig(configId, userId);
      if (!config) {
        throw new AppError('Embedding configuration not found', 404, 'EMBEDDING_NOT_FOUND');
      }

      const { error } = await supabaseAdmin
        .from('embedding_configs')
        .delete()
        .eq('id', configId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting embedding config:', error);
        throw new AppError(
          `Failed to delete embedding configuration: ${error.message}`,
          500,
          'EMBEDDING_DELETE_ERROR'
        );
      }

      logger.info('Embedding config deleted', {
        configId,
        userId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error deleting embedding config:', error);
      throw new AppError(
        'Failed to delete embedding configuration',
        500,
        'EMBEDDING_DELETE_ERROR'
      );
    }
  }
}
