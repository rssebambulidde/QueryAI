/**
 * Query Optimizer Service
 * Optimizes search queries for better search results
 * Analyzes question types and applies optimization rules
 */

import logger from '../config/logger';

export type QuestionType = 'factual' | 'analytical' | 'comparative' | 'procedural' | 'exploratory' | 'unknown';

export interface QueryOptimizationConfig {
  enabled: boolean; // Enable query optimization
  removeStopWords: boolean; // Remove stop words
  extractKeywords: boolean; // Extract and emphasize keywords
  enhanceWithContext: boolean; // Enhance query with context
  maxQueryLength: number; // Maximum optimized query length
  minKeywordLength: number; // Minimum keyword length
}

export interface QueryOptimizationOptions {
  removeStopWords?: boolean;
  extractKeywords?: boolean;
  enhanceWithContext?: boolean;
  context?: string; // Additional context to enhance query
  topic?: string; // Topic for context enhancement
}

export interface OptimizedQuery {
  originalQuery: string;
  optimizedQuery: string;
  questionType: QuestionType;
  keywords: string[]; // Extracted keywords
  removedStopWords: string[]; // Removed stop words
  enhancements: string[]; // Applied enhancements
  optimizationTimeMs: number;
}

/**
 * Default optimization configuration
 */
export const DEFAULT_QUERY_OPTIMIZATION_CONFIG: QueryOptimizationConfig = {
  enabled: true,
  removeStopWords: true,
  extractKeywords: true,
  enhanceWithContext: true,
  maxQueryLength: 200, // Max length for optimized query
  minKeywordLength: 3, // Minimum keyword length
};

/**
 * Stop words to remove from queries
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to',
  'was', 'were', 'will', 'with', 'would', 'this', 'these', 'those',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'can', 'could', 'should', 'may', 'might', 'must', 'do', 'does', 'did',
  'have', 'has', 'had', 'been', 'being', 'am', 'is', 'are', 'was', 'were',
]);

/**
 * Question type patterns (ordered by specificity - more specific first)
 */
const QUESTION_TYPE_PATTERNS = {
  comparative: [
    /^(compare|comparison)/i,
    /^(what is the difference|what are the differences)/i,
    /^(which is better|which one is better)/i,
    /\b(versus|vs|vs\.)\b/i,
    /\b(better|worse|best|worst)\b.*\b(than|vs|versus)\b/i,
  ],
  analytical: [
    /^(why|how)\s+(does|do|did|is|are|was|were)/i,
    /\b(analyze|analysis|explain|understand|reason|cause|effect)\b/i,
    /^(what causes|what leads to|what results in)/i,
  ],
  procedural: [
    /^(how to|how do|how can|how should)/i,
    /\b(steps|process|method|procedure|guide|tutorial|way to)\b/i,
  ],
  exploratory: [
    /^(tell me about|learn about|information about|know about)/i,
    /\b(overview|introduction|background|general|everything)\b/i,
  ],
  factual: [
    /^(what|who|when|where|which)\s+(is|are|was|were|did|does|do)/i,
    /^(how many|how much)/i,
  ],
};

/**
 * Query Optimizer Service
 * Optimizes search queries for better results
 */
export class QueryOptimizerService {
  private static config: QueryOptimizationConfig = DEFAULT_QUERY_OPTIMIZATION_CONFIG;

  /**
   * Set optimization configuration
   */
  static setConfig(config: Partial<QueryOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Query optimization configuration updated', { config: this.config });
  }

  /**
   * Get current optimization configuration
   */
  static getConfig(): QueryOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Classify question type
   */
  static classifyQuestionType(query: string): QuestionType {
    const lowerQuery = query.toLowerCase().trim();

    // Check patterns in priority order
    for (const [type, patterns] of Object.entries(QUESTION_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return type as QuestionType;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Extract keywords from query
   */
  private static extractKeywords(query: string): string[] {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => 
        word.length >= this.config.minKeywordLength &&
        !STOP_WORDS.has(word)
      );

    // Remove duplicates while preserving order
    const uniqueKeywords = Array.from(new Set(words));
    return uniqueKeywords;
  }

  /**
   * Remove stop words from query
   */
  private static removeStopWords(query: string): { cleaned: string; removed: string[] } {
    const words = query.split(/\s+/);
    const cleaned: string[] = [];
    const removed: string[] = [];

    for (const word of words) {
      const normalized = word.toLowerCase().replace(/[^\w]/g, '');
      if (STOP_WORDS.has(normalized)) {
        removed.push(word);
      } else {
        cleaned.push(word);
      }
    }

    return {
      cleaned: cleaned.join(' ').trim(),
      removed,
    };
  }

  /**
   * Emphasize keywords in query (add quotes for important terms)
   */
  private static emphasizeKeywords(query: string, keywords: string[]): string {
    if (keywords.length === 0) {
      return query;
    }

    // For important keywords (longer or less common), add quotes
    const importantKeywords = keywords.filter(kw => kw.length >= 5);
    
    if (importantKeywords.length === 0) {
      return query;
    }

    // Add quotes around important keywords if they appear as standalone words
    let emphasized = query;
    for (const keyword of importantKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      emphasized = emphasized.replace(regex, `"${keyword}"`);
    }

    return emphasized;
  }

  /**
   * Enhance query with context
   */
  private static enhanceWithContext(
    query: string,
    context?: string,
    topic?: string
  ): string {
    let enhanced = query;

    // Add topic if provided and not already in query
    if (topic) {
      const topicLower = topic.toLowerCase();
      const queryLower = query.toLowerCase();
      
      if (!queryLower.includes(topicLower)) {
        enhanced = `${topic} ${enhanced}`;
      }
    }

    // Add context keywords if provided
    if (context) {
      const contextKeywords = this.extractKeywords(context);
      const queryKeywords = this.extractKeywords(query);
      
      // Add context keywords that aren't already in query
      const newKeywords = contextKeywords.filter(
        kw => !queryKeywords.includes(kw)
      );
      
      if (newKeywords.length > 0) {
        // Add top 2-3 context keywords
        const topContextKeywords = newKeywords.slice(0, 3);
        enhanced = `${enhanced} ${topContextKeywords.join(' ')}`;
      }
    }

    return enhanced.trim();
  }

  /**
   * Apply optimization rules based on question type
   */
  private static applyQuestionTypeOptimization(
    query: string,
    questionType: QuestionType
  ): string {
    let optimized = query;

    switch (questionType) {
      case 'factual':
        // For factual queries, keep it concise and direct
        // Remove question words if they don't add value
        optimized = optimized.replace(/^(what|who|when|where|which)\s+/i, '');
        break;

      case 'analytical':
        // For analytical queries, emphasize cause/effect terms
        optimized = optimized.replace(/\b(why|how)\s+/i, '');
        // Keep analytical terms
        break;

      case 'comparative':
        // For comparative queries, emphasize comparison terms
        // Keep comparison keywords
        break;

      case 'procedural':
        // For procedural queries, emphasize action terms
        optimized = optimized.replace(/^(how to|how do|how can|how should)\s+/i, '');
        break;

      case 'exploratory':
        // For exploratory queries, keep broad terms
        optimized = optimized.replace(/^(tell me about|learn about|information about)\s+/i, '');
        break;

      case 'unknown':
        // No specific optimization
        break;
    }

    return optimized.trim();
  }

  /**
   * Optimize query for search
   */
  static optimizeQuery(
    query: string,
    options: QueryOptimizationOptions = {}
  ): OptimizedQuery {
    const startTime = Date.now();
    const config = { ...this.config, ...options };

    if (!config.enabled || !query || query.trim().length === 0) {
      return {
        originalQuery: query,
        optimizedQuery: query.trim(),
        questionType: 'unknown',
        keywords: [],
        removedStopWords: [],
        enhancements: [],
        optimizationTimeMs: Date.now() - startTime,
      };
    }

    const originalQuery = query.trim();
    let optimized = originalQuery;
    const enhancements: string[] = [];
    let removedStopWords: string[] = [];
    let keywords: string[] = [];

    // Classify question type
    const questionType = this.classifyQuestionType(originalQuery);
    enhancements.push(`Question type: ${questionType}`);

    // Apply question type optimization
    optimized = this.applyQuestionTypeOptimization(optimized, questionType);
    if (optimized !== originalQuery) {
      enhancements.push('Applied question type optimization');
    }

    // Extract keywords
    if (config.extractKeywords) {
      keywords = this.extractKeywords(optimized);
      if (keywords.length > 0) {
        enhancements.push(`Extracted ${keywords.length} keywords`);
      }
    }

    // Remove stop words
    if (config.removeStopWords) {
      const { cleaned, removed } = this.removeStopWords(optimized);
      optimized = cleaned;
      removedStopWords = removed;
      if (removed.length > 0) {
        enhancements.push(`Removed ${removed.length} stop words`);
      }
    }

    // Emphasize keywords
    if (config.extractKeywords && keywords.length > 0) {
      optimized = this.emphasizeKeywords(optimized, keywords);
      if (optimized !== originalQuery) {
        enhancements.push('Emphasized important keywords');
      }
    }

    // Enhance with context
    if (config.enhanceWithContext) {
      const beforeEnhancement = optimized;
      optimized = this.enhanceWithContext(optimized, options.context, options.topic);
      if (optimized !== beforeEnhancement) {
        enhancements.push('Enhanced with context');
      }
    }

    // Limit query length
    if (optimized.length > config.maxQueryLength) {
      optimized = optimized.substring(0, config.maxQueryLength).trim();
      enhancements.push(`Truncated to ${config.maxQueryLength} characters`);
    }

    // Ensure query is not empty
    if (optimized.length === 0) {
      optimized = originalQuery; // Fallback to original
      enhancements.push('Fallback to original query (optimization removed all content)');
    }

    const optimizationTimeMs = Date.now() - startTime;

    logger.debug('Query optimized', {
      originalQuery: originalQuery.substring(0, 100),
      optimizedQuery: optimized.substring(0, 100),
      questionType,
      keywordsCount: keywords.length,
      optimizationTimeMs,
    });

    return {
      originalQuery,
      optimizedQuery: optimized,
      questionType,
      keywords,
      removedStopWords,
      enhancements,
      optimizationTimeMs,
    };
  }

  /**
   * Quick optimize (simplified version)
   */
  static quickOptimize(query: string): string {
    const result = this.optimizeQuery(query, {
      removeStopWords: true,
      extractKeywords: false,
      enhanceWithContext: false,
    });
    return result.optimizedQuery;
  }

  /**
   * Check if query needs optimization
   */
  static needsOptimization(query: string): boolean {
    if (!query || query.trim().length === 0) {
      return false;
    }

    // Check if query has stop words
    const words = query.toLowerCase().split(/\s+/);
    const hasStopWords = words.some(word => STOP_WORDS.has(word.replace(/[^\w]/g, '')));

    // Check if query is too long
    const isTooLong = query.length > this.config.maxQueryLength;

    // Check if query has question words that can be optimized
    const hasQuestionWords = /^(what|who|when|where|which|why|how|tell me about)/i.test(query);

    return hasStopWords || isTooLong || hasQuestionWords;
  }
}
