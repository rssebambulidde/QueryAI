/**
 * History Filter Service
 * Filters conversation history by relevance to current query
 * Uses embedding-based similarity for fast and accurate relevance scoring
 */

import { EmbeddingService } from './embedding.service';
import logger from '../config/logger';

/**
 * History message with relevance score
 */
export interface ScoredHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  relevanceScore: number;
  originalIndex: number;
}

/**
 * History filtering options
 */
export interface HistoryFilterOptions {
  minRelevanceScore?: number; // Minimum relevance score to include (default: 0.3)
  maxHistoryMessages?: number; // Maximum number of messages to keep (default: 10)
  preserveRecentMessages?: number; // Always preserve recent N messages (default: 2)
  useEmbeddingSimilarity?: boolean; // Use embedding-based similarity (default: true)
  useKeywordMatching?: boolean; // Use keyword matching as fallback (default: true)
  maxFilteringTimeMs?: number; // Maximum time for filtering (default: 300ms)
  embeddingModel?: string; // Embedding model to use (default: from config)
}

/**
 * History filtering result
 */
export interface HistoryFilterResult {
  filteredHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  scores: ScoredHistoryMessage[];
  stats: {
    originalCount: number;
    filteredCount: number;
    removedCount: number;
    processingTimeMs: number;
    performanceWarning?: boolean;
  };
}

/**
 * Default filtering options
 */
const DEFAULT_FILTER_OPTIONS: Required<HistoryFilterOptions> = {
  minRelevanceScore: 0.3,
  maxHistoryMessages: 10,
  preserveRecentMessages: 2,
  useEmbeddingSimilarity: true,
  useKeywordMatching: true,
  maxFilteringTimeMs: 300,
  embeddingModel: '',
};

/**
 * History Filter Service
 */
export class HistoryFilterService {
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      logger.warn('Embedding dimension mismatch', {
        vec1Length: vec1.length,
        vec2Length: vec2.length,
      });
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Calculate keyword-based similarity (fast fallback)
   */
  private static calculateKeywordSimilarity(query: string, message: string): number {
    if (!query || !message) {
      return 0;
    }

    // Extract keywords from query (remove stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can']);
    
    const queryWords = new Set(
      query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
    );

    const messageWords = new Set(
      message
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
    );

    if (queryWords.size === 0 || messageWords.size === 0) {
      return 0;
    }

    // Calculate Jaccard similarity
    const intersection = new Set([...queryWords].filter(word => messageWords.has(word)));
    const union = new Set([...queryWords, ...messageWords]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Score history messages by relevance to query
   */
  private static async scoreHistoryMessages(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: Required<HistoryFilterOptions>
  ): Promise<ScoredHistoryMessage[]> {
    const startTime = Date.now();
    const scoredMessages: ScoredHistoryMessage[] = [];

    try {
      if (options.useEmbeddingSimilarity) {
        // Generate embedding for query
        const queryEmbedding = await EmbeddingService.generateEmbedding(
          query,
          options.embeddingModel as any
        );

        // Score each message
        for (let i = 0; i < history.length; i++) {
          const message = history[i];
          
          // Clean message content (remove citations)
          const cleanContent = message.content
            .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
            .replace(/\[Document \d+\]/g, '') // Remove document citations
            .replace(/\[Web Source \d+\]/g, '') // Remove web citations
            .trim();

          if (!cleanContent) {
            scoredMessages.push({
              ...message,
              relevanceScore: 0,
              originalIndex: i,
            });
            continue;
          }

          try {
            // Generate embedding for message
            const messageEmbedding = await EmbeddingService.generateEmbedding(
              cleanContent,
              options.embeddingModel as any
            );

            // Calculate cosine similarity
            const similarity = this.cosineSimilarity(queryEmbedding, messageEmbedding);
            
            scoredMessages.push({
              ...message,
              relevanceScore: similarity,
              originalIndex: i,
            });
          } catch (error: any) {
            // Fallback to keyword matching if embedding fails
            logger.warn('Embedding generation failed for message, using keyword matching', {
              error: error.message,
              messageIndex: i,
            });
            
            const keywordScore = this.calculateKeywordSimilarity(query, cleanContent);
            scoredMessages.push({
              ...message,
              relevanceScore: keywordScore,
              originalIndex: i,
            });
          }

          // Check timeout
          if (Date.now() - startTime > options.maxFilteringTimeMs) {
            logger.warn('History filtering timeout, using keyword matching for remaining messages', {
              processed: i + 1,
              total: history.length,
            });
            
            // Use keyword matching for remaining messages
            for (let j = i + 1; j < history.length; j++) {
              const remainingMessage = history[j];
              const cleanContent = remainingMessage.content
                .replace(/\[.*?\]\(.*?\)/g, '')
                .replace(/\[Document \d+\]/g, '')
                .replace(/\[Web Source \d+\]/g, '')
                .trim();
              
              const keywordScore = this.calculateKeywordSimilarity(query, cleanContent);
              scoredMessages.push({
                ...remainingMessage,
                relevanceScore: keywordScore,
                originalIndex: j,
              });
            }
            break;
          }
        }
      } else {
        // Use keyword matching only
        for (let i = 0; i < history.length; i++) {
          const message = history[i];
          const cleanContent = message.content
            .replace(/\[.*?\]\(.*?\)/g, '')
            .replace(/\[Document \d+\]/g, '')
            .replace(/\[Web Source \d+\]/g, '')
            .trim();
          
          const keywordScore = this.calculateKeywordSimilarity(query, cleanContent);
          scoredMessages.push({
            ...message,
            relevanceScore: keywordScore,
            originalIndex: i,
          });
        }
      }
    } catch (error: any) {
      logger.error('Error scoring history messages, using keyword matching', {
        error: error.message,
      });
      
      // Fallback to keyword matching
      for (let i = 0; i < history.length; i++) {
        const message = history[i];
        const cleanContent = message.content
          .replace(/\[.*?\]\(.*?\)/g, '')
          .replace(/\[Document \d+\]/g, '')
          .replace(/\[Web Source \d+\]/g, '')
          .trim();
        
        const keywordScore = this.calculateKeywordSimilarity(query, cleanContent);
        scoredMessages.push({
          ...message,
          relevanceScore: keywordScore,
          originalIndex: i,
        });
      }
    }

    return scoredMessages;
  }

  /**
   * Filter history by relevance
   */
  static async filterHistory(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: HistoryFilterOptions = {}
  ): Promise<HistoryFilterResult> {
    const startTime = Date.now();
    const opts: Required<HistoryFilterOptions> = {
      ...DEFAULT_FILTER_OPTIONS,
      ...options,
      embeddingModel: options.embeddingModel || EmbeddingService.getCurrentModel(),
    };

    try {
      // If history is short enough, return as-is
      if (history.length <= opts.maxHistoryMessages) {
        return {
          filteredHistory: history,
          scores: history.map((msg, idx) => ({
            ...msg,
            relevanceScore: 1.0,
            originalIndex: idx,
          })),
          stats: {
            originalCount: history.length,
            filteredCount: history.length,
            removedCount: 0,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }

      // Score all messages
      const scoredMessages = await this.scoreHistoryMessages(query, history, opts);

      // Separate messages to preserve and filter
      const messagesToPreserve = scoredMessages.slice(-opts.preserveRecentMessages);
      const messagesToFilter = scoredMessages.slice(0, -opts.preserveRecentMessages);

      // Filter messages by relevance score
      const filteredMessages = messagesToFilter.filter(
        msg => msg.relevanceScore >= opts.minRelevanceScore
      );

      // Sort by relevance score (descending)
      filteredMessages.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Take top N messages (after preserving recent)
      const maxFiltered = opts.maxHistoryMessages - opts.preserveRecentMessages;
      const topFiltered = filteredMessages.slice(0, maxFiltered);

      // Combine preserved and filtered messages
      const allFiltered = [...topFiltered, ...messagesToPreserve];

      // Sort by original index to maintain conversation order
      allFiltered.sort((a, b) => a.originalIndex - b.originalIndex);

      // Convert back to history format
      const filteredHistory = allFiltered.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const processingTime = Date.now() - startTime;
      const performanceWarning = processingTime > opts.maxFilteringTimeMs;

      if (performanceWarning) {
        logger.warn('History filtering exceeded target time', {
          processingTimeMs: processingTime,
          targetTimeMs: opts.maxFilteringTimeMs,
        });
      }

      logger.info('History filtered by relevance', {
        originalCount: history.length,
        filteredCount: filteredHistory.length,
        removedCount: history.length - filteredHistory.length,
        processingTimeMs: processingTime,
        avgRelevanceScore: allFiltered.reduce((sum, msg) => sum + msg.relevanceScore, 0) / allFiltered.length,
      });

      return {
        filteredHistory,
        scores: allFiltered,
        stats: {
          originalCount: history.length,
          filteredCount: filteredHistory.length,
          removedCount: history.length - filteredHistory.length,
          processingTimeMs: processingTime,
          performanceWarning,
        },
      };
    } catch (error: any) {
      logger.error('Error filtering history, returning original history', {
        error: error.message,
      });

      // Return original history on error
      return {
        filteredHistory: history,
        scores: history.map((msg, idx) => ({
          ...msg,
          relevanceScore: 1.0,
          originalIndex: idx,
        })),
        stats: {
          originalCount: history.length,
          filteredCount: history.length,
          removedCount: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Quick filter using keyword matching only (faster, less accurate)
   */
  static quickFilter(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: HistoryFilterOptions = {}
  ): HistoryFilterResult {
    const startTime = Date.now();
    const opts: Required<HistoryFilterOptions> = {
      ...DEFAULT_FILTER_OPTIONS,
      ...options,
      useEmbeddingSimilarity: false, // Use keyword matching only
    };

    // Score messages using keyword matching
    const scoredMessages: ScoredHistoryMessage[] = history.map((msg, idx) => {
      const cleanContent = msg.content
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\[Document \d+\]/g, '')
        .replace(/\[Web Source \d+\]/g, '')
        .trim();
      
      const keywordScore = this.calculateKeywordSimilarity(query, cleanContent);
      return {
        ...msg,
        relevanceScore: keywordScore,
        originalIndex: idx,
      };
    });

    // Separate messages to preserve and filter
    const messagesToPreserve = scoredMessages.slice(-opts.preserveRecentMessages);
    const messagesToFilter = scoredMessages.slice(0, -opts.preserveRecentMessages);

    // Filter by relevance score
    const filteredMessages = messagesToFilter.filter(
      msg => msg.relevanceScore >= opts.minRelevanceScore
    );

    // Sort by relevance and take top N
    filteredMessages.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const maxFiltered = opts.maxHistoryMessages - opts.preserveRecentMessages;
    const topFiltered = filteredMessages.slice(0, maxFiltered);

    // Combine and sort by original index
    const allFiltered = [...topFiltered, ...messagesToPreserve];
    allFiltered.sort((a, b) => a.originalIndex - b.originalIndex);

    const filteredHistory = allFiltered.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const processingTime = Date.now() - startTime;

    return {
      filteredHistory,
      scores: allFiltered,
      stats: {
        originalCount: history.length,
        filteredCount: filteredHistory.length,
        removedCount: history.length - filteredHistory.length,
        processingTimeMs: processingTime,
        performanceWarning: processingTime > opts.maxFilteringTimeMs,
      },
    };
  }
}
