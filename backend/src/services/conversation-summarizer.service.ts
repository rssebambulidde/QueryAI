/**
 * Conversation Summarizer Service
 * Summarizes conversation history using LLM to preserve key information and context
 */

import { openai } from '../config/openai';
import logger from '../config/logger';
import { TokenCountService } from './token-count.service';
import { Database } from '../types/database';

/**
 * Conversation summarization options
 */
export interface ConversationSummarizationOptions {
  maxHistoryMessages?: number; // Maximum messages before summarization (default: 20)
  maxSummaryTokens?: number; // Maximum tokens for summary (default: 500)
  preserveRecentMessages?: number; // Number of recent messages to preserve (default: 5)
  model?: string; // Model for summarization (default: 'gpt-3.5-turbo')
  temperature?: number; // Temperature for summarization (default: 0.3)
  maxSummarizationTimeMs?: number; // Maximum time for summarization (default: 2000ms)
}

/**
 * Conversation summary result
 */
export interface ConversationSummary {
  summary: string; // Summarized conversation history
  preservedMessages: Array<{ role: 'user' | 'assistant'; content: string }>; // Recent messages preserved
  originalMessageCount: number; // Original number of messages
  summarizedMessageCount: number; // Number of messages summarized
  preservedMessageCount: number; // Number of messages preserved
  summaryTokens: number; // Token count of summary
}

/**
 * Default summarization options
 */
const DEFAULT_SUMMARIZATION_OPTIONS: Required<ConversationSummarizationOptions> = {
  maxHistoryMessages: 20,
  maxSummaryTokens: 500,
  preserveRecentMessages: 5,
  model: 'gpt-3.5-turbo',
  temperature: 0.3,
  maxSummarizationTimeMs: 2000,
};

/**
 * Conversation Summarizer Service
 */
export class ConversationSummarizerService {
  /**
   * Summarize conversation history
   */
  static async summarizeConversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: ConversationSummarizationOptions = {}
  ): Promise<ConversationSummary> {
    const opts = { ...DEFAULT_SUMMARIZATION_OPTIONS, ...options };
    const startTime = Date.now();

    try {
      // Check if summarization is needed
      if (messages.length <= opts.maxHistoryMessages) {
        return {
          summary: '',
          preservedMessages: messages,
          originalMessageCount: messages.length,
          summarizedMessageCount: 0,
          preservedMessageCount: messages.length,
          summaryTokens: 0,
        };
      }

      // Separate messages to preserve and summarize
      const messagesToPreserve = messages.slice(-opts.preserveRecentMessages);
      const messagesToSummarize = messages.slice(0, messages.length - opts.preserveRecentMessages);

      // Build conversation text for summarization
      const conversationText = messagesToSummarize
        .map((msg, idx) => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          // Remove citations and formatting for cleaner summary
          const content = msg.content
            .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
            .replace(/\[Document \d+\]/g, '') // Remove document citations
            .replace(/\[Web Source \d+\]/g, '') // Remove web citations
            .trim();
          return `${role}: ${content}`;
        })
        .join('\n\n');

      // Count tokens in conversation text
      const encodingType = TokenCountService.getEncodingForModel(opts.model);
      const conversationTokens = TokenCountService.countTokens(conversationText, encodingType);

      // If conversation is already short enough, don't summarize
      if (conversationTokens <= opts.maxSummaryTokens) {
        return {
          summary: conversationText,
          preservedMessages: messagesToPreserve,
          originalMessageCount: messages.length,
          summarizedMessageCount: messagesToSummarize.length,
          preservedMessageCount: messagesToPreserve.length,
          summaryTokens: conversationTokens,
        };
      }

      // Create summarization prompt
      const summarizationPrompt = `Summarize the following conversation history, preserving:
1. Key topics and themes discussed
2. Important facts, decisions, or conclusions
3. User preferences or context mentioned
4. Any critical information that would be needed for future responses

Keep the summary concise (under ${opts.maxSummaryTokens} tokens) but comprehensive enough to maintain context.

Conversation History:
${conversationText}

Provide a clear, structured summary that captures the essential information:`;

      // Perform summarization with timeout
      const summarizationPromise = openai.chat.completions.create({
        model: opts.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, informative summaries of conversations while preserving key context and information.',
          },
          {
            role: 'user',
            content: summarizationPrompt,
          },
        ],
        temperature: opts.temperature,
        max_tokens: opts.maxSummaryTokens,
      });

      // Add timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Summarization timeout')), opts.maxSummarizationTimeMs);
      });

      const completion = await Promise.race([summarizationPromise, timeoutPromise]);
      const summary = completion.choices[0]?.message?.content || '';

      // Count summary tokens
      const summaryTokens = TokenCountService.countTokens(summary, encodingType);

      const elapsedTime = Date.now() - startTime;

      logger.info('Conversation summarized', {
        originalMessageCount: messages.length,
        summarizedMessageCount: messagesToSummarize.length,
        preservedMessageCount: messagesToPreserve.length,
        summaryTokens,
        elapsedTimeMs: elapsedTime,
      });

      return {
        summary,
        preservedMessages: messagesToPreserve,
        originalMessageCount: messages.length,
        summarizedMessageCount: messagesToSummarize.length,
        preservedMessageCount: messagesToPreserve.length,
        summaryTokens,
      };
    } catch (error: any) {
      const elapsedTime = Date.now() - startTime;

      // If summarization fails, preserve recent messages and return empty summary
      logger.warn('Conversation summarization failed, preserving recent messages', {
        error: error.message,
        elapsedTimeMs: elapsedTime,
        messageCount: messages.length,
      });

      const messagesToPreserve = messages.slice(-opts.preserveRecentMessages);

      return {
        summary: '',
        preservedMessages: messagesToPreserve,
        originalMessageCount: messages.length,
        summarizedMessageCount: 0,
        preservedMessageCount: messagesToPreserve.length,
        summaryTokens: 0,
      };
    }
  }

  /**
   * Check if conversation needs summarization
   */
  static shouldSummarize(
    messageCount: number,
    options: ConversationSummarizationOptions = {}
  ): boolean {
    const opts = { ...DEFAULT_SUMMARIZATION_OPTIONS, ...options };
    return messageCount > opts.maxHistoryMessages;
  }

  /**
   * Format summary for use in conversation history
   */
  static formatSummaryForHistory(summary: ConversationSummary): Array<{ role: 'user' | 'assistant'; content: string }> {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add summary as a system-like message (using user role with special marker)
    if (summary.summary) {
      history.push({
        role: 'user',
        content: `[CONVERSATION SUMMARY] ${summary.summary}`,
      });
    }

    // Add preserved messages
    history.push(...summary.preservedMessages);

    return history;
  }

  /**
   * Quick summarization for very long conversations
   */
  static async quickSummarize(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: ConversationSummarizationOptions = {}
  ): Promise<ConversationSummary> {
    const opts = { ...DEFAULT_SUMMARIZATION_OPTIONS, ...options };
    
    // For quick summarization, preserve fewer messages and use smaller summary
    return this.summarizeConversation(messages, {
      ...opts,
      preserveRecentMessages: Math.min(opts.preserveRecentMessages, 3),
      maxSummaryTokens: Math.min(opts.maxSummaryTokens, 300),
      maxSummarizationTimeMs: Math.min(opts.maxSummarizationTimeMs, 1500),
    });
  }

  /**
   * Get conversation history with summarization applied
   */
  static async getSummarizedHistory(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: ConversationSummarizationOptions = {}
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const opts = { ...DEFAULT_SUMMARIZATION_OPTIONS, ...options };

    // Check if summarization is needed
    if (!this.shouldSummarize(messages.length, opts)) {
      return messages;
    }

    // Summarize conversation
    const summary = await this.summarizeConversation(messages, opts);

    // Format for history
    return this.formatSummaryForHistory(summary);
  }
}
