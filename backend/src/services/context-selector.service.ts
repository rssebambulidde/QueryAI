/**
 * Context Selector Service
 * Implements adaptive context selection based on query complexity
 * Dynamically adjusts chunk count based on query characteristics
 */

import { ThresholdOptimizerService, QueryType } from './threshold-optimizer.service';
import logger from '../config/logger';

export interface QueryComplexity {
  length: number; // Query length in characters
  wordCount: number; // Number of words
  keywordCount: number; // Number of significant keywords
  keywords: string[]; // Extracted keywords
  intentComplexity: 'simple' | 'moderate' | 'complex'; // Intent complexity
  queryType: QueryType; // Query type (factual, conceptual, etc.)
  complexityScore: number; // Overall complexity score (0-1)
}

export interface ContextSelectionConfig {
  enabled: boolean; // Enable adaptive context selection
  minChunks: number; // Minimum number of chunks
  maxChunks: number; // Maximum number of chunks
  defaultChunks: number; // Default number of chunks
  // Complexity-based multipliers
  simpleQueryMultiplier: number; // Multiplier for simple queries (default: 0.6)
  moderateQueryMultiplier: number; // Multiplier for moderate queries (default: 1.0)
  complexQueryMultiplier: number; // Multiplier for complex queries (default: 1.5)
  // Query type adjustments
  queryTypeAdjustments: Record<QueryType, number>; // Additional chunks per query type
  // Length-based adjustments
  lengthThresholds: {
    short: number; // Characters for short query (default: 20)
    medium: number; // Characters for medium query (default: 100)
    long: number; // Characters for long query (default: 200)
  };
  lengthMultipliers: {
    short: number; // Multiplier for short queries (default: 0.7)
    medium: number; // Multiplier for medium queries (default: 1.0)
    long: number; // Multiplier for long queries (default: 1.3)
  };
}

export interface ContextSelectionOptions {
  minChunks?: number;
  maxChunks?: number;
  defaultChunks?: number;
}

export interface ContextSelectionResult {
  chunkCount: number;
  complexity: QueryComplexity;
  reasoning: string; // Explanation of chunk count selection
}

/**
 * Default context selection configuration
 */
export const DEFAULT_CONTEXT_SELECTION_CONFIG: ContextSelectionConfig = {
  enabled: true,
  minChunks: 3,
  maxChunks: 20,
  defaultChunks: 5,
  simpleQueryMultiplier: 0.6,
  moderateQueryMultiplier: 1.0,
  complexQueryMultiplier: 1.5,
  queryTypeAdjustments: {
    factual: 0, // No adjustment
    conceptual: 2, // +2 chunks for conceptual queries
    procedural: 1, // +1 chunk for procedural queries
    exploratory: 3, // +3 chunks for exploratory queries
    unknown: 0, // No adjustment
  },
  lengthThresholds: {
    short: 20,
    medium: 100,
    long: 200,
  },
  lengthMultipliers: {
    short: 0.7,
    medium: 1.0,
    long: 1.3,
  },
};

/**
 * Context Selector Service
 * Analyzes query complexity and selects appropriate context size
 */
export class ContextSelectorService {
  private static config: ContextSelectionConfig = DEFAULT_CONTEXT_SELECTION_CONFIG;

  /**
   * Set context selection configuration
   */
  static setConfig(config: Partial<ContextSelectionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Context selection configuration updated', { config: this.config });
  }

  /**
   * Get current context selection configuration
   */
  static getConfig(): ContextSelectionConfig {
    return { ...this.config };
  }

  /**
   * Extract keywords from query (significant words, excluding stop words)
   */
  private static extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
    ]);

    const words = query
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
      .filter(word => word.length > 2 && !stopWords.has(word));

    return words;
  }

  /**
   * Analyze query complexity
   */
  static analyzeQueryComplexity(query: string): QueryComplexity {
    const length = query.length;
    const words = query.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const keywords = this.extractKeywords(query);
    const keywordCount = keywords.length;

    // Detect query type
    const queryType = ThresholdOptimizerService.detectQueryType(query);

    // Determine intent complexity based on query characteristics
    let intentComplexity: 'simple' | 'moderate' | 'complex' = 'moderate';

    // Simple queries: short, few keywords, factual
    if (length < 50 && keywordCount <= 2 && queryType === 'factual') {
      intentComplexity = 'simple';
    }
    // Complex queries: long, many keywords, exploratory/conceptual
    else if (
      (length > 150 || keywordCount > 5) &&
      (queryType === 'exploratory' || queryType === 'conceptual')
    ) {
      intentComplexity = 'complex';
    }
    // Moderate: everything else
    else {
      intentComplexity = 'moderate';
    }

    // Calculate complexity score (0-1)
    const lengthScore = Math.min(1, length / 200); // Normalize to 0-1
    const keywordScore = Math.min(1, keywordCount / 10); // Normalize to 0-1
    const intentScore = intentComplexity === 'simple' ? 0.3 : intentComplexity === 'moderate' ? 0.6 : 0.9;
    const typeScore = queryType === 'exploratory' ? 0.9 : queryType === 'conceptual' ? 0.7 : 0.5;

    // Weighted average
    const complexityScore =
      lengthScore * 0.2 +
      keywordScore * 0.3 +
      intentScore * 0.3 +
      typeScore * 0.2;

    return {
      length,
      wordCount,
      keywordCount,
      keywords, // Include keywords in result
      intentComplexity,
      queryType,
      complexityScore,
    };
  }

  /**
   * Select appropriate chunk count based on query complexity
   */
  static selectContextSize(
    query: string,
    options: ContextSelectionOptions = {}
  ): ContextSelectionResult {
    const config = { ...this.config, ...options };

    if (!config.enabled) {
      return {
        chunkCount: config.defaultChunks,
        complexity: this.analyzeQueryComplexity(query),
        reasoning: 'Adaptive context selection disabled, using default',
      };
    }

    // Analyze query complexity
    const complexity = this.analyzeQueryComplexity(query);

    // Start with default chunks
    let chunkCount = config.defaultChunks;

    // Apply intent complexity multiplier
    let multiplier = 1.0;
    switch (complexity.intentComplexity) {
      case 'simple':
        multiplier = config.simpleQueryMultiplier;
        break;
      case 'moderate':
        multiplier = config.moderateQueryMultiplier;
        break;
      case 'complex':
        multiplier = config.complexQueryMultiplier;
        break;
    }
    chunkCount = Math.round(chunkCount * multiplier);

    // Apply length-based multiplier
    let lengthMultiplier = 1.0;
    if (complexity.length <= config.lengthThresholds.short) {
      lengthMultiplier = config.lengthMultipliers.short;
    } else if (complexity.length <= config.lengthThresholds.medium) {
      lengthMultiplier = config.lengthMultipliers.medium;
    } else {
      lengthMultiplier = config.lengthMultipliers.long;
    }
    chunkCount = Math.round(chunkCount * lengthMultiplier);

    // Apply query type adjustment
    const typeAdjustment = config.queryTypeAdjustments[complexity.queryType] || 0;
    chunkCount += typeAdjustment;

    // Apply complexity score adjustment (fine-tuning)
    const complexityAdjustment = Math.round((complexity.complexityScore - 0.5) * 4); // -2 to +2
    chunkCount += complexityAdjustment;

    // Ensure within bounds
    chunkCount = Math.max(config.minChunks, Math.min(config.maxChunks, chunkCount));

    // Build reasoning
    const reasoning = [
      `Query complexity: ${complexity.intentComplexity} (score: ${complexity.complexityScore.toFixed(2)})`,
      `Query type: ${complexity.queryType}`,
      `Length: ${complexity.length} chars, ${complexity.wordCount} words, ${complexity.keywordCount} keywords`,
      `Applied multipliers: intent=${multiplier.toFixed(2)}, length=${lengthMultiplier.toFixed(2)}`,
      `Type adjustment: +${typeAdjustment}, complexity adjustment: ${complexityAdjustment >= 0 ? '+' : ''}${complexityAdjustment}`,
      `Final chunk count: ${chunkCount}`,
    ].join('; ');

    logger.debug('Context size selected', {
      query: query.substring(0, 100),
      chunkCount,
      complexity: complexity.intentComplexity,
      queryType: complexity.queryType,
    });

    return {
      chunkCount,
      complexity,
      reasoning,
    };
  }

  /**
   * Get chunk count for a query (convenience method)
   */
  static getChunkCount(
    query: string,
    options: ContextSelectionOptions = {}
  ): number {
    const result = this.selectContextSize(query, options);
    return result.chunkCount;
  }

  /**
   * Check if query is complex enough to warrant more context
   */
  static isComplexQuery(query: string): boolean {
    const complexity = this.analyzeQueryComplexity(query);
    return complexity.complexityScore > 0.6;
  }

  /**
   * Get recommended chunk count range for a query
   */
  static getChunkCountRange(
    query: string,
    options: ContextSelectionOptions = {}
  ): { min: number; max: number; recommended: number } {
    const config = { ...this.config, ...options };
    const result = this.selectContextSize(query, options);

    // Calculate range based on complexity
    const range = Math.round((config.maxChunks - config.minChunks) * 0.3);
    const min = Math.max(config.minChunks, result.chunkCount - range);
    const max = Math.min(config.maxChunks, result.chunkCount + range);

    return {
      min,
      max,
      recommended: result.chunkCount,
    };
  }
}
