import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import { ConversationService } from './conversation.service';
import { ConversationSummarizerService, ConversationSummarizationOptions } from './conversation-summarizer.service';
import { SlidingWindowService, SlidingWindowOptions } from './sliding-window.service';
import { CitedSourceService } from './cited-source.service';

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

      // Fire-and-forget: track cited sources for assistant messages
      if (input.role === 'assistant' && input.sources?.length) {
        this._trackCitationsAsync(input.conversationId, data.id, input.sources as Record<string, any>[]).catch(() => {});
      }

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
   * Save a message pair (user message + assistant response) atomically.
   *
   * Uses the `save_message_pair` Supabase RPC function so both rows are
   * inserted inside a single database transaction.  If anything fails
   * the whole transaction is rolled back — no dangling user messages.
   */
  static async saveMessagePair(
    conversationId: string,
    userContent: string,
    assistantContent: string,
    assistantSources?: CreateMessageInput['sources'],
    assistantMetadata?: Record<string, any>
  ): Promise<MessagePair> {
    try {
      if (!conversationId) {
        throw new ValidationError('Conversation ID is required');
      }
      if (!userContent || userContent.trim().length === 0) {
        throw new ValidationError('User message content is required');
      }
      if (!assistantContent || assistantContent.trim().length === 0) {
        throw new ValidationError('Assistant message content is required');
      }

      const { data, error } = await supabaseAdmin.schema('private').rpc('save_message_pair', {
        p_conversation_id: conversationId,
        p_user_content: userContent.trim(),
        p_assistant_content: assistantContent.trim(),
        p_sources: (assistantSources as any) ?? null,
        p_metadata: (assistantMetadata as any) ?? null,
      });

      if (error) {
        logger.warn('save_message_pair RPC failed, falling back to sequential save', {
          conversationId,
          error: error.message,
        });

        const userMessage = await this.saveMessage({
          conversationId,
          role: 'user',
          content: userContent.trim(),
        });

        try {
          const assistantMessage = await this.saveMessage({
            conversationId,
            role: 'assistant',
            content: assistantContent.trim(),
            sources: assistantSources,
            metadata: assistantMetadata,
          });

          return { userMessage, assistantMessage };
        } catch (assistantSaveError) {
          const { error: rollbackError } = await supabaseAdmin
            .from('messages')
            .delete()
            .eq('id', userMessage.id);

          if (rollbackError) {
            logger.warn('Failed to rollback user message after assistant save failure', {
              conversationId,
              messageId: userMessage.id,
              error: rollbackError.message,
            });
          }

          throw assistantSaveError;
        }
      }

      // The RPC returns a JSONB object with userMessage / assistantMessage
      const userMessage: Database.Message = data.userMessage;
      const assistantMessage: Database.Message = data.assistantMessage;

      logger.info('Message pair saved atomically', {
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });

      // Fire-and-forget: track cited sources on the assistant message
      if (assistantSources?.length) {
        this._trackCitationsAsync(conversationId, assistantMessage.id, assistantSources as Record<string, any>[]).catch(() => {});
      }

      return { userMessage, assistantMessage };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error saving message pair:', error);
      throw new AppError('Failed to save message pair', 500, 'MESSAGE_PAIR_SAVE_ERROR');
    }
  }

  /**
   * Fire-and-forget helper: look up conversation owner + topic, then
   * track all cited sources via CitedSourceService.
   */
  private static async _trackCitationsAsync(
    conversationId: string,
    messageId: string,
    sources: Record<string, any>[]
  ): Promise<void> {
    try {
      // Look up conversation to get user_id and topic_id
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('user_id, topic_id')
        .eq('id', conversationId)
        .single();

      if (!conv) return;

      await CitedSourceService.trackMessageSources(
        conv.user_id,
        conversationId,
        messageId,
        conv.topic_id || null,
        sources
      );
    } catch (err) {
      logger.warn('Citation tracking failed (non-blocking)', { error: (err as Error).message });
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

      const limit = options?.limit ?? 100;
      const offset = options?.offset ?? 0;

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

  /** Default number of most-recent messages to fetch. */
  private static readonly DEFAULT_MESSAGE_LIMIT = 200;

  /**
   * Get messages for a conversation.
   *
   * By default fetches at most the **last 200 messages** (most recent) to
   * avoid loading potentially huge histories.  The rows are returned in
   * chronological (ascending) order.
   *
   * Pass `{ unlimited: true }` for admin / export use-cases that need every
   * message, or a custom `{ limit: N }` to override the default cap.
   */
  static async getAllMessages(
    conversationId: string,
    userId: string,
    options?: { limit?: number; unlimited?: boolean }
  ): Promise<Database.Message[]> {
    try {
      // Verify conversation belongs to user
      const conversation = await ConversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
      }

      const unlimited = options?.unlimited === true;
      const limit = unlimited ? undefined : (options?.limit ?? this.DEFAULT_MESSAGE_LIMIT);

      let query = supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId);

      if (limit) {
        // Fetch the last N rows efficiently: order DESC, limit, then
        // reverse in-memory so callers always receive chronological order.
        query = query.order('created_at', { ascending: false }).limit(limit);
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching all messages:', error);
        throw new AppError(
          `Failed to fetch messages: ${error.message}`,
          500,
          'MESSAGES_FETCH_ERROR'
        );
      }

      const messages = data || [];

      // Reverse when we fetched DESC so output is always chronological.
      if (limit) {
        messages.reverse();
      }

      return messages;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error fetching messages:', error);
      throw new AppError('Failed to fetch messages', 500, 'MESSAGES_FETCH_ERROR');
    }
  }

  /**
   * Get conversation history with summarization applied
   */
  static async getSummarizedHistory(
    conversationId: string,
    userId: string,
    options: ConversationSummarizationOptions = {}
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      // Get recent messages (default-limited to avoid loading huge histories)
      const messages = await this.getAllMessages(conversationId, userId);

      // Convert to format expected by summarizer
      const history = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content || '',
      }));

      // Get summarized history
      return await ConversationSummarizerService.getSummarizedHistory(history, options);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error getting summarized history:', error);
      throw new AppError('Failed to get summarized history', 500, 'HISTORY_SUMMARIZATION_ERROR');
    }
  }

  /**
   * Get conversation history with sliding window applied
   */
  static async getSlidingWindowHistory(
    conversationId: string,
    userId: string,
    options: SlidingWindowOptions = {}
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    try {
      // Get recent messages (default-limited to avoid loading huge histories)
      const messages = await this.getAllMessages(conversationId, userId);

      // Convert to format expected by sliding window service
      const history = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content || '',
      }));

      return this.applyHistoryStrategy(history, options);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Unexpected error getting sliding window history:', error);
      throw new AppError('Failed to get sliding window history', 500, 'HISTORY_SLIDING_WINDOW_ERROR');
    }
  }

  /**
   * Apply the unified conversation-history strategy to a raw message array.
   *
   * **Strategy: sliding window with summarization fallback.**
   *
   * 1. Keep the most recent N messages (default: 10, from SlidingWindowConfig.windowSize).
   * 2. When older messages exist beyond the window, summarize them into a compact
   *    representation (capped at SlidingWindowConfig.maxSummaryTokens = 1 000 tokens).
   * 3. Total token budget for window + summary: SlidingWindowConfig.maxTotalTokens (2 000).
   *
   * Both /ask (non-streaming) and /ask/stream (streaming) pipelines funnel through
   * this method so the LLM always receives identical conversation context.
   *
   * @param history  Raw array of {role, content} pairs (DB-loaded or client-provided).
   * @param options  Override window size, token budget, model, etc.
   * @returns        Windowed (and possibly summarized) history ready for prompt building.
   */
  static async applyHistoryStrategy(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: SlidingWindowOptions = {}
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    if (!history || history.length === 0) return [];

    const windowResult = await SlidingWindowService.applySlidingWindow(history, options);
    return SlidingWindowService.formatWindowForHistory(windowResult);
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

  // ─── Version history helpers ────────────────────────────────────────────

  /**
   * Create a new version of an existing message.
   *
   * The new row is inserted with `parent_message_id` pointing at the root
   * message (the original v1, or the parent of the current message) and
   * `version` = max existing version + 1.
   *
   * Returns the newly-created message row.
   */
  static async createMessageVersion(
    originalMessageId: string,
    updates: {
      content: string;
      sources?: CreateMessageInput['sources'];
      metadata?: Record<string, any>;
    },
  ): Promise<Database.Message> {
    try {
      // Fetch the original message to resolve the root parent
      const { data: original, error: fetchErr } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('id', originalMessageId)
        .single();

      if (fetchErr || !original) {
        throw new AppError('Original message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      // The root is either the original itself (if it has no parent) or its parent
      const rootId: string = original.parent_message_id ?? original.id;

      // Find the current max version among siblings + root
      const { data: siblings, error: sibErr } = await supabaseAdmin
        .from('messages')
        .select('version')
        .or(`id.eq.${rootId},parent_message_id.eq.${rootId}`)
        .order('version', { ascending: false })
        .limit(1);

      if (sibErr) {
        throw new AppError(`Failed to query versions: ${sibErr.message}`, 500, 'VERSION_QUERY_ERROR');
      }

      const maxVersion = siblings?.[0]?.version ?? 1;
      const newVersion = maxVersion + 1;

      const { data: newMsg, error: insertErr } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: original.conversation_id,
          role: original.role,
          content: updates.content.trim(),
          sources: (updates.sources as any) ?? original.sources ?? null,
          metadata: {
            ...updates.metadata,
            regenerated_from: originalMessageId,
            regenerated_at: new Date().toISOString(),
          },
          version: newVersion,
          parent_message_id: rootId,
        })
        .select()
        .single();

      if (insertErr || !newMsg) {
        throw new AppError(`Failed to create message version: ${insertErr?.message}`, 500, 'VERSION_CREATE_ERROR');
      }

      logger.info('Message version created', {
        rootId,
        newMessageId: newMsg.id,
        version: newVersion,
        conversationId: original.conversation_id,
      });

      return newMsg;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Unexpected error creating message version:', error);
      throw new AppError('Failed to create message version', 500, 'VERSION_CREATE_ERROR');
    }
  }

  /**
   * Get all versions of a message (root + children), ordered by version ASC.
   * Accepts any version's ID — resolves to root automatically via RPC.
   */
  static async getMessageVersions(
    messageId: string,
    userId: string,
  ): Promise<Database.Message[]> {
    try {
      // First verify the message belongs to a conversation the user owns
      const { data: msg, error: fetchErr } = await supabaseAdmin
        .from('messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single();

      if (fetchErr || !msg) {
        throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      const conversation = await ConversationService.getConversation(msg.conversation_id, userId);
      if (!conversation) {
        throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
      }

      const { data, error } = await supabaseAdmin
        .schema('private' as any)
        .rpc('get_message_versions', { p_message_id: messageId });

      if (error) {
        throw new AppError(`Failed to fetch versions: ${error.message}`, 500, 'VERSIONS_FETCH_ERROR');
      }

      return (data as Database.Message[]) || [];
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Unexpected error fetching message versions:', error);
      throw new AppError('Failed to fetch message versions', 500, 'VERSIONS_FETCH_ERROR');
    }
  }
}
