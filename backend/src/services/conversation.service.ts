import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import { ConversationStateService, ConversationState, StateTrackingOptions } from './conversation-state.service';

export interface CreateConversationInput {
  userId: string;
  title?: string;
  topicId?: string;
}

export interface UpdateConversationInput {
  title?: string;
  topicId?: string;
  metadata?: Record<string, any>;
}

export interface ConversationWithMetadata extends Database.Conversation {
  messageCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

/**
 * Conversation Service
 * Handles conversation CRUD operations
 */
export class ConversationService {
  /**
   * Create a new conversation
   */
  static async createConversation(
    input: CreateConversationInput
  ): Promise<Database.Conversation> {
    try {
      if (!input.userId) {
        throw new ValidationError('User ID is required');
      }

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          user_id: input.userId,
          title: input.title || 'New Conversation',
          topic_id: input.topicId || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating conversation:', error);
        throw new AppError(
          `Failed to create conversation: ${error.message}`,
          500,
          'CONVERSATION_CREATE_ERROR'
        );
      }

      logger.info('Conversation created', {
        conversationId: data.id,
        userId: input.userId,
      });

      return data;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error creating conversation:', error);
      throw new AppError('Failed to create conversation', 500, 'CONVERSATION_CREATE_ERROR');
    }
  }

  /**
   * Get conversation by ID
   */
  static async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Database.Conversation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        logger.error('Error fetching conversation:', error);
        throw new AppError(
          `Failed to fetch conversation: ${error.message}`,
          500,
          'CONVERSATION_FETCH_ERROR'
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching conversation:', error);
      throw new AppError('Failed to fetch conversation', 500, 'CONVERSATION_FETCH_ERROR');
    }
  }

  /**
   * Get all conversations for a user
   */
  static async getUserConversations(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeMetadata?: boolean;
    }
  ): Promise<ConversationWithMetadata[]> {
    try {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      let query = supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching conversations:', error);
        throw new AppError(
          `Failed to fetch conversations: ${error.message}`,
          500,
          'CONVERSATIONS_FETCH_ERROR'
        );
      }

      if (!data || data.length === 0) {
        return [];
      }

      // If metadata is requested, fetch message counts and last messages
      if (options?.includeMetadata) {
        const conversationsWithMetadata = await Promise.all(
          data.map(async (conv) => {
            const metadata = await this.getConversationMetadata(conv.id);
            return {
              ...conv,
              messageCount: metadata.messageCount,
              lastMessage: metadata.lastMessage,
              lastMessageAt: metadata.lastMessageAt,
            };
          })
        );
        return conversationsWithMetadata;
      }

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching conversations:', error);
      throw new AppError('Failed to fetch conversations', 500, 'CONVERSATIONS_FETCH_ERROR');
    }
  }

  /**
   * Get conversation metadata (message count, last message)
   */
  static async getConversationMetadata(conversationId: string): Promise<{
    messageCount: number;
    lastMessage?: string;
    lastMessageAt?: string;
  }> {
    try {
      // Get message count
      const { count, error: countError } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);

      if (countError) {
        logger.warn('Error getting message count:', countError);
      }

      // Get last message
      const { data: lastMessage, error: messageError } = await supabaseAdmin
        .from('messages')
        .select('content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (messageError && messageError.code !== 'PGRST116') {
        logger.warn('Error getting last message:', messageError);
      }

      return {
        messageCount: count || 0,
        lastMessage: lastMessage?.content
          ? lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : '')
          : undefined,
        lastMessageAt: lastMessage?.created_at,
      };
    } catch (error) {
      logger.warn('Error getting conversation metadata:', error);
      return {
        messageCount: 0,
      };
    }
  }

  /**
   * Update conversation
   */
  static async updateConversation(
    conversationId: string,
    userId: string,
    updates: UpdateConversationInput
  ): Promise<Database.Conversation> {
    try {
      // Verify conversation belongs to user
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }
      
      if (updates.topicId !== undefined) {
        updateData.topic_id = updates.topicId;
      }
      
      if (updates.metadata !== undefined) {
        // Merge with existing metadata
        const currentMetadata = (conversation as any).metadata || {};
        updateData.metadata = { ...currentMetadata, ...updates.metadata };
      }

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating conversation:', error);
        throw new AppError(
          `Failed to update conversation: ${error.message}`,
          500,
          'CONVERSATION_UPDATE_ERROR'
        );
      }

      logger.info('Conversation updated', {
        conversationId,
        userId,
        updates,
      });

      return data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error updating conversation:', error);
      throw new AppError('Failed to update conversation', 500, 'CONVERSATION_UPDATE_ERROR');
    }
  }

  /**
   * Delete conversation and all its messages
   */
  static async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify conversation belongs to user
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      // Delete conversation (messages will be cascade deleted)
      const { error } = await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting conversation:', error);
        throw new AppError(
          `Failed to delete conversation: ${error.message}`,
          500,
          'CONVERSATION_DELETE_ERROR'
        );
      }

      logger.info('Conversation deleted', {
        conversationId,
        userId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error deleting conversation:', error);
      throw new AppError('Failed to delete conversation', 500, 'CONVERSATION_DELETE_ERROR');
    }
  }

  /**
   * Generate conversation title from first message
   */
  static generateTitleFromMessage(message: string): string {
    // Remove markdown formatting
    let title = message
      .replace(/[#*_`]/g, '') // Remove markdown chars
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // Truncate to 50 characters
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    // Fallback if empty
    return title || 'New Conversation';
  }

  /**
   * Update conversation's updated_at timestamp
   */
  static async updateConversationTimestamp(conversationId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        logger.warn('Error updating conversation timestamp:', error);
        // Don't throw - this is not critical
      }
    } catch (error) {
      logger.warn('Unexpected error updating conversation timestamp:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Update conversation state from messages
   */
  static async updateConversationState(
    conversationId: string,
    userId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: StateTrackingOptions = {}
  ): Promise<ConversationState | null> {
    try {
      // Get existing state
      const existingState = await ConversationStateService.getState(conversationId, userId);

      // Extract new state from messages
      const newState = await ConversationStateService.extractState(messages, {
        ...options,
        messageCount: messages.length,
      });

      // Merge with existing state
      const mergedState = ConversationStateService.mergeStates(existingState, newState);
      mergedState.messageCount = messages.length;

      // Update state in database
      await ConversationStateService.updateState(conversationId, userId, mergedState);

      return mergedState;
    } catch (error: any) {
      logger.warn('Failed to update conversation state', {
        error: error.message,
        conversationId,
      });
      return null;
    }
  }

  /**
   * Get conversation state
   */
  static async getConversationState(
    conversationId: string,
    userId: string
  ): Promise<ConversationState | null> {
    try {
      return await ConversationStateService.getState(conversationId, userId);
    } catch (error: any) {
      logger.warn('Failed to get conversation state', {
        error: error.message,
        conversationId,
      });
      return null;
    }
  }
}
