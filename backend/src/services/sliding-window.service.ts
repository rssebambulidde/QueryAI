/**
 * Sliding Window Service
 * Implements sliding window algorithm for long conversations
 * Keeps most recent N messages and summarizes older messages
 */

import { ConversationSummarizerService, ConversationSummarizationOptions } from './conversation-summarizer.service';
import { TokenCountService } from './token-count.service';
import logger from '../config/logger';

/**
 * Sliding window options
 */
export interface SlidingWindowOptions {
  windowSize?: number; // Number of recent messages to keep (default: 10)
  maxTotalTokens?: number; // Maximum total tokens for window + summary (default: 2000)
  maxSummaryTokens?: number; // Maximum tokens for summary (default: 1000)
  enableSummarization?: boolean; // Enable summarization of older messages (default: true)
  summarizationOptions?: ConversationSummarizationOptions; // Options for summarization
  model?: string; // Model for token counting (default: 'gpt-3.5-turbo')
}

/**
 * Sliding window result
 */
export interface SlidingWindowResult {
  windowMessages: Array<{ role: 'user' | 'assistant'; content: string }>; // Recent messages in window
  summary?: string; // Summary of older messages (if any)
  originalMessageCount: number; // Original number of messages
  windowMessageCount: number; // Number of messages in window
  summarizedMessageCount: number; // Number of messages summarized
  totalTokens: number; // Total tokens (window + summary)
  windowTokens: number; // Tokens in window
  summaryTokens: number; // Tokens in summary
}

/**
 * Default sliding window options
 */
const DEFAULT_SLIDING_WINDOW_OPTIONS: Required<Omit<SlidingWindowOptions, 'summarizationOptions'>> = {
  windowSize: 10,
  maxTotalTokens: 2000,
  maxSummaryTokens: 1000,
  enableSummarization: true,
  model: 'gpt-3.5-turbo',
};

/**
 * Sliding Window Service
 */
export class SlidingWindowService {
  /**
   * Apply sliding window to conversation history
   */
  static async applySlidingWindow(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: SlidingWindowOptions = {}
  ): Promise<SlidingWindowResult> {
    const opts: Required<Omit<SlidingWindowOptions, 'summarizationOptions'>> = {
      ...DEFAULT_SLIDING_WINDOW_OPTIONS,
      ...options,
    };

    const startTime = Date.now();
    const encodingType = TokenCountService.getEncodingForModel(opts.model);

    try {
      // If messages fit in window, return as-is
      if (messages.length <= opts.windowSize) {
        const windowTokens = this.countMessageTokens(messages, encodingType);
        
        return {
          windowMessages: messages,
          originalMessageCount: messages.length,
          windowMessageCount: messages.length,
          summarizedMessageCount: 0,
          totalTokens: windowTokens,
          windowTokens,
          summaryTokens: 0,
        };
      }

      // Extract window (most recent N messages)
      const windowMessages = messages.slice(-opts.windowSize);
      const olderMessages = messages.slice(0, messages.length - opts.windowSize);

      // Count tokens in window
      const windowTokens = this.countMessageTokens(windowMessages, encodingType);

      // If window alone exceeds token budget, trim it
      let finalWindowMessages = windowMessages;
      let finalWindowTokens = windowTokens;
      
      if (windowTokens > opts.maxTotalTokens) {
        logger.warn('Window exceeds token budget, trimming window', {
          windowTokens,
          maxTotalTokens: opts.maxTotalTokens,
        });
        
        // Trim window from oldest messages
        finalWindowMessages = this.trimToTokenBudget(windowMessages, opts.maxTotalTokens, encodingType);
        finalWindowTokens = this.countMessageTokens(finalWindowMessages, encodingType);
      }

      // Calculate available tokens for summary
      const availableSummaryTokens = opts.maxTotalTokens - finalWindowTokens;
      const maxSummaryTokens = Math.min(availableSummaryTokens, opts.maxSummaryTokens);

      let summary: string | undefined;
      let summaryTokens = 0;
      let summarizedMessageCount = 0;

      // Summarize older messages if enabled and there are older messages
      if (opts.enableSummarization && olderMessages.length > 0 && maxSummaryTokens > 0) {
        try {
          // Use summarization service with adjusted token budget
          const summarizationOptions: ConversationSummarizationOptions = {
            maxSummaryTokens: maxSummaryTokens,
            preserveRecentMessages: 0, // Don't preserve any, we already have the window
            model: opts.model,
            ...options.summarizationOptions,
          };

          const summaryResult = await ConversationSummarizerService.summarizeConversation(
            olderMessages,
            summarizationOptions
          );

          summary = summaryResult.summary;
          summaryTokens = summaryResult.summaryTokens;
          summarizedMessageCount = summaryResult.summarizedMessageCount;

          // If summary is too long, truncate it
          if (summaryTokens > maxSummaryTokens) {
            logger.warn('Summary exceeds token budget, truncating', {
              summaryTokens,
              maxSummaryTokens,
            });
            
            summary = this.truncateToTokenBudget(summary, maxSummaryTokens, encodingType);
            summaryTokens = TokenCountService.countTokens(summary, encodingType);
          }
        } catch (error: any) {
          logger.warn('Failed to summarize older messages, continuing without summary', {
            error: error.message,
            olderMessageCount: olderMessages.length,
          });
        }
      }

      const totalTokens = finalWindowTokens + summaryTokens;

      logger.info('Sliding window applied', {
        originalMessageCount: messages.length,
        windowMessageCount: finalWindowMessages.length,
        summarizedMessageCount,
        windowTokens: finalWindowTokens,
        summaryTokens,
        totalTokens,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        windowMessages: finalWindowMessages,
        summary,
        originalMessageCount: messages.length,
        windowMessageCount: finalWindowMessages.length,
        summarizedMessageCount,
        totalTokens,
        windowTokens: finalWindowTokens,
        summaryTokens,
      };
    } catch (error: any) {
      logger.error('Error applying sliding window, returning window only', {
        error: error.message,
      });

      // Fallback: return just the window
      const windowMessages = messages.slice(-opts.windowSize);
      const windowTokens = this.countMessageTokens(windowMessages, encodingType);

      return {
        windowMessages,
        originalMessageCount: messages.length,
        windowMessageCount: windowMessages.length,
        summarizedMessageCount: 0,
        totalTokens: windowTokens,
        windowTokens,
        summaryTokens: 0,
      };
    }
  }

  /**
   * Convert sliding window result to conversation history format
   */
  static formatWindowForHistory(result: SlidingWindowResult): Array<{ role: 'user' | 'assistant'; content: string }> {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add summary as a system-like message if present
    if (result.summary) {
      history.push({
        role: 'assistant',
        content: `[Previous conversation summary]: ${result.summary}`,
      });
    }

    // Add window messages
    history.push(...result.windowMessages);

    return history;
  }

  /**
   * Count tokens in messages
   */
  private static countMessageTokens(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    encodingType: string
  ): number {
    return messages.reduce((total, msg) => {
      return total + TokenCountService.countTokens(msg.content, encodingType);
    }, 0);
  }

  /**
   * Trim messages to fit token budget
   */
  private static trimToTokenBudget(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    encodingType: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Start from most recent and work backwards
    const trimmed: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let currentTokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = TokenCountService.countTokens(msg.content, encodingType);

      if (currentTokens + msgTokens <= maxTokens) {
        trimmed.unshift(msg);
        currentTokens += msgTokens;
      } else {
        break;
      }
    }

    return trimmed;
  }

  /**
   * Truncate text to fit token budget
   */
  private static truncateToTokenBudget(
    text: string,
    maxTokens: number,
    encodingType: string
  ): string {
    const tokens = TokenCountService.countTokens(text, encodingType);
    
    if (tokens <= maxTokens) {
      return text;
    }

    // Binary search for truncation point
    let left = 0;
    let right = text.length;
    let bestLength = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.substring(0, mid);
      const truncatedTokens = TokenCountService.countTokens(truncated, encodingType);

      if (truncatedTokens <= maxTokens) {
        bestLength = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return text.substring(0, bestLength) + '...';
  }

  /**
   * Get optimal window size based on token budget
   */
  static calculateOptimalWindowSize(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTotalTokens: number,
    reservedSummaryTokens: number,
    model: string = 'gpt-3.5-turbo'
  ): number {
    const encodingType = TokenCountService.getEncodingForModel(model);
    const availableWindowTokens = maxTotalTokens - reservedSummaryTokens;

    if (availableWindowTokens <= 0) {
      return 0;
    }

    // Count tokens for each message and find how many fit
    let currentTokens = 0;
    let windowSize = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = TokenCountService.countTokens(messages[i].content, encodingType);
      
      if (currentTokens + msgTokens <= availableWindowTokens) {
        currentTokens += msgTokens;
        windowSize++;
      } else {
        break;
      }
    }

    return windowSize;
  }
}
