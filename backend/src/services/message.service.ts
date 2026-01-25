import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import { ConversationService } from './conversation.service';

export interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    type?: 'document' | 'web';
    title: string;
    url?: string;
    documentId?: string;
    snippet?: string;
    score?: number;
  }>;
  metadata?: Record<string, any>;
}

export interface MessagePair {
  userMessage: Database.Message;
  assistantMessage: Database.Message;
}

/**
 * Message Service
 * Handles message CRUD operations
 */
export class MessageService {
  /**
   * Save a single message to a conversation
   */
  static async saveMessage(
    input: CreateMessageInput
  ): Promise<Database.Message> {
    try {
      if (!input.conversationId) {
        throw new ValidationError('Conversation ID is required');
      }

      if (!input.role || !['user', 'assistant'].includes(input.role)) {
        throw new ValidationError('Valid role (user or assistant) is required');
      }

      if (!input.content || input.content.trim().length === 0) {
        throw new ValidationError('Message content is required');
      }

      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          role: input.role,
          content: input.content.trim(),
          sources: input.sources || null,
          metadata: input.metadata || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error saving message:', error);
        throw new AppError(
          `Failed to save message: ${error.message}`,
          500,
          'MESSAGE_SAVE_ERROR'
        );
      }

      // Update conversation timestamp
      await ConversationService.updateConversationTimestamp(input.conversationId);

      logger.info('Message saved', {
        messageId: data.id,
        conversationId: input.conversationId,
        role: input.role,
      });

      return data;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error saving message:', error);
      throw new AppError('Failed to save message', 500, 'MESSAGE_SAVE_ERROR');
    }
  }

  /**
   * Save a message pair (user message + assistant response) atomically
   */
  static async saveMessagePair(
    conversationId: string,
    userContent: string,
    assistantContent: string,
    assistantSources?: CreateMessageInput['sources'],
    assistantMetadata?: Record<string, any>
  ): Promise<MessagePair> {
    try {
      // Save user message
      const userMessage = await this.saveMessage({
        conversationId,
        role: 'user',
        content: userContent,
      });

      // Save assistant message
      const assistantMessage = await this.saveMessage({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        sources: assistantSources,
        metadata: assistantMetadata,
      });

      logger.info('Message pair saved', {
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });

      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      logger.error('Error saving message pair:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  static async getMessages(
    conversationId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Database.Message[]> {
    try {
      // Verify conversation belongs to user
      const conversation = await ConversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching messages:', error);
        throw new AppError(
          `Failed to fetch messages: ${error.message}`,
          500,
          'MESSAGES_FETCH_ERROR'
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching messages:', error);
      throw new AppError('Failed to fetch messages', 500, 'MESSAGES_FETCH_ERROR');
    }
  }

  /**
   * Get all messages for a conversation (no pagination)
   */
  static async getAllMessages(
    conversationId: string,
    userId: string
  ): Promise<Database.Message[]> {
    try {
      // Verify conversation belongs to user
      const conversation = await ConversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching all messages:', error);
        throw new AppError(
          `Failed to fetch messages: ${error.message}`,
          500,
          'MESSAGES_FETCH_ERROR'
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching messages:', error);
      throw new AppError('Failed to fetch messages', 500, 'MESSAGES_FETCH_ERROR');
    }
  }

  /**
   * Update a message's content (e.g. when user edits their question)
   */
  static async updateMessage(
    messageId: string,
    userId: string,
    updates: { content: string }
  ): Promise<Database.Message | null> {
    try {
      const { data: message, error: fetchError } = await supabaseAdmin
        .from('messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) {
        throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      const conversation = await ConversationService.getConversation(
        message.conversation_id,
        userId
      );
      if (!conversation) {
        throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      const { data, error } = await supabaseAdmin
        .from('messages')
        .update({ content: updates.content.trim() })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating message:', error);
        throw new AppError(`Failed to update message: ${error.message}`, 500, 'MESSAGE_UPDATE_ERROR');
      }

      await ConversationService.updateConversationTimestamp(message.conversation_id);
      return data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Unexpected error updating message:', error);
      throw new AppError('Failed to update message', 500, 'MESSAGE_UPDATE_ERROR');
    }
  }

  /**
   * Delete a single message
   */
  static async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get message to verify conversation ownership
      const { data: message, error: fetchError } = await supabaseAdmin
        .from('messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) {
        throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      // Verify conversation belongs to user
      const conversation = await ConversationService.getConversation(
        message.conversation_id,
        userId
      );
      if (!conversation) {
        throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      // Delete message
      const { error } = await supabaseAdmin
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        logger.error('Error deleting message:', error);
        throw new AppError(
          `Failed to delete message: ${error.message}`,
          500,
          'MESSAGE_DELETE_ERROR'
        );
      }

      // Update conversation timestamp
      await ConversationService.updateConversationTimestamp(message.conversation_id);

      logger.info('Message deleted', {
        messageId,
        userId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error deleting message:', error);
      throw new AppError('Failed to delete message', 500, 'MESSAGE_DELETE_ERROR');
    }
  }

  /**
   * Delete all messages in a conversation
   */
  static async deleteConversationMessages(
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify conversation belongs to user
      const conversation = await ConversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      const { error } = await supabaseAdmin
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (error) {
        logger.error('Error deleting conversation messages:', error);
        throw new AppError(
          `Failed to delete messages: ${error.message}`,
          500,
          'MESSAGES_DELETE_ERROR'
        );
      }

      logger.info('Conversation messages deleted', {
        conversationId,
        userId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error deleting conversation messages:', error);
      throw new AppError('Failed to delete messages', 500, 'MESSAGES_DELETE_ERROR');
    }
  }
}
