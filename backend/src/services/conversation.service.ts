import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import { ConversationStateService, ConversationState, StateTrackingOptions } from './conversation-state.service';

export interface CreateConversationInput {
  userId: string;
  title?: string;
  topicId?: string;
  mode?: 'research' | 'chat';
}

export interface UpdateConversationInput {
  title?: string;
  topicId?: string;
  metadata?: Record<string, any>;
  mode?: 'research' | 'chat';
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
          mode: input.mode || 'research',
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
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      // Fast path: single RPC returns conversations + metadata in one round trip
      if (options?.includeMetadata) {
        const { data: rpcData, error: rpcError } = await supabaseAdmin
          .rpc('get_conversations_with_metadata', {
            p_user_id: userId,
            p_limit: limit,
            p_offset: offset,
          });

        if (rpcError) {
          // Fallback: if the RPC doesn't exist yet (pre-migration), use the old path
          logger.warn('get_conversations_with_metadata RPC failed, falling back to N+1', {
            error: rpcError.message,
          });
        } else if (rpcData && Array.isArray(rpcData)) {
          return (rpcData as any[]).map((row) => ({
            id: row.id,
            user_id: row.user_id,
            title: row.title ?? undefined,
            mode: row.mode ?? 'research',
            metadata: row.metadata ?? undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
            messageCount: Number(row.message_count) || 0,
            lastMessage: row.last_message
              ? row.last_message + (row.last_message.length >= 100 ? '...' : '')
              : undefined,
            lastMessageAt: row.last_message_at ?? undefined,
          }));
        }
      }

      // Standard path (no metadata) or RPC fallback
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

      // Fallback N+1 path — only reached if RPC failed above
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
      
      if (updates.metadata !== undefined) {
        // Merge with existing metadata
        const currentMetadata = (conversation as any).metadata || {};
        updateData.metadata = { ...currentMetadata, ...updates.metadata };
      }

      if (updates.mode !== undefined) {
        updateData.mode = updates.mode;
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

      // Clean up chat attachments BEFORE deleting the conversation row.
      // The chat_attachments FK is ON DELETE SET NULL, so after the conversation
      // row is gone the conversation_id becomes NULL — making cleanup impossible.
      // Attachments may have been uploaded before the conversation existed, so
      // conversation_id can still be NULL. We fall back to fileIds saved in
      // the conversation's metadata to catch those orphaned rows.
      try {
        const { ChatAttachmentService } = await import('./chat-attachment.service');

        // Extract fileIds from conversation metadata for fallback lookup
        const savedAttachments = (conversation as any)?.metadata?.savedAttachments || [];
        const metadataFileIds: string[] = savedAttachments
          .map((att: any) => att.fileId)
          .filter(Boolean);

        const removed = await ChatAttachmentService.deleteByConversation(
          conversationId,
          userId,
          metadataFileIds.length > 0 ? metadataFileIds : undefined,
        );
        if (removed > 0) {
          logger.info('Cleaned up chat attachments before conversation delete', {
            conversationId, userId, removed,
          });
        }
      } catch (attachErr: any) {
        // Non-fatal — proceed with conversation deletion even if attachment
        // cleanup fails (the rows become orphans but won't break anything).
        logger.warn('Attachment cleanup failed during conversation delete', {
          conversationId, error: attachErr.message,
        });
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
      const newState = await ConversationStateService.extractState(messages, options);

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
