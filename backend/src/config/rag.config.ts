/**
 * RAG Configuration
 * Dynamic limit calculation based on token budget and query complexity
 */

import { TokenBudgetService, TokenBudget } from '../services/token-budget.service';
import { ContextSelectorService, QueryComplexity } from '../services/context-selector.service';
import logger from './logger';

/**
 * Dynamic limit configuration
 */
export interface DynamicLimitConfig {
  enabled: boolean; // Enable dynamic limits (default: true)
  // Token budget-based limits
  useTokenBudgetLimits: boolean; // Calculate limits from token budget (default: true)
  tokensPerDocumentChunk: number; // Estimated tokens per document chunk (default: 300)
  tokensPerWebResult: number; // Estimated tokens per web result (default: 400)
  // Query complexity adjustments
  useComplexityAdjustments: boolean; // Adjust limits based on query complexity (default: true)
  complexityMultipliers: {
    simple: number; // Multiplier for simple queries (default: 0.7)
    moderate: number; // Multiplier for moderate queries (default: 1.0)
    complex: number; // Multiplier for complex queries (default: 1.3)
  };
  // Min/Max constraints
  minDocumentChunks: number; // Minimum document chunks (default: 3)
  maxDocumentChunks: number; // Maximum document chunks (default: 30)
  minWebResults: number; // Minimum web results (default: 2)
  maxWebResults: number; // Maximum web results (default: 15)
  // Default limits (fallback)
  defaultDocumentChunks: number; // Default document chunks (default: 5)
  defaultWebResults: number; // Default web results (default: 5)
  // Balance ratio
  documentWebRatio: number; // Document/web balance ratio (default: 0.6, meaning 60% documents)
}

/**
 * Default dynamic limit configuration
 */
export const DEFAULT_DYNAMIC_LIMIT_CONFIG: DynamicLimitConfig = {
  enabled: true,
  useTokenBudgetLimits: true,
  tokensPerDocumentChunk: 300,
  tokensPerWebResult: 400,
  useComplexityAdjustments: true,
  complexityMultipliers: {
    simple: 0.7,
    moderate: 1.0,
    complex: 1.3,
  },
  minDocumentChunks: 3,
  maxDocumentChunks: 30,
  minWebResults: 2,
  maxWebResults: 15,
  defaultDocumentChunks: 5,
  defaultWebResults: 5,
  documentWebRatio: 0.6, // 60% documents, 40% web
};

/**
 * Dynamic limit calculation result
 */
export interface DynamicLimits {
  documentChunks: number; // Calculated document chunks limit
  webResults: number; // Calculated web results limit
  reasoning: string; // Explanation of limit calculation
  factors: {
    tokenBudget?: number; // Token budget used
    complexity?: string; // Query complexity
    complexityMultiplier?: number; // Complexity multiplier applied
    baseLimits?: { documentChunks: number; webResults: number }; // Base limits before adjustments
  };
}

/**
 * Dynamic limit calculation options
 */
export interface DynamicLimitOptions {
  query: string; // User query
  model?: string; // Model name for token budgeting
  tokenBudget?: TokenBudget; // Pre-calculated token budget (optional)
  tokenBudgetOptions?: import('../services/token-budget.service').TokenBudgetOptions; // Token budget options
  // Override constraints
  minDocumentChunks?: number;
  maxDocumentChunks?: number;
  minWebResults?: number;
  maxWebResults?: number;
  // Override config
  config?: Partial<DynamicLimitConfig>;
}

/**
 * RAG Configuration Service
 */
export class RAGConfig {
  private static config: DynamicLimitConfig = DEFAULT_DYNAMIC_LIMIT_CONFIG;

  /**
   * Set dynamic limit configuration
   */
  static setConfig(config: Partial<DynamicLimitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('RAG dynamic limit configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  static getConfig(): DynamicLimitConfig {
    return { ...this.config };
  }

  /**
   * Calculate dynamic limits based on token budget and query complexity
   */
  static calculateDynamicLimits(
    options: DynamicLimitOptions
  ): DynamicLimits {
    const {
      query,
      model = 'gpt-3.5-turbo',
      tokenBudget,
      tokenBudgetOptions,
      minDocumentChunks,
      maxDocumentChunks,
      minWebResults,
      maxWebResults,
      config: overrideConfig,
    } = options;

    const config: DynamicLimitConfig = { ...this.config, ...overrideConfig };

    if (!config.enabled) {
      // Return default limits if dynamic limits disabled
      return {
        documentChunks: config.defaultDocumentChunks,
        webResults: config.defaultWebResults,
        reasoning: 'Dynamic limits disabled, using defaults',
        factors: {},
      };
    }

    // Step 1: Analyze query complexity
    let complexity: QueryComplexity | undefined;
    let complexityMultiplier = 1.0;

    if (config.useComplexityAdjustments) {
      try {
        const complexityResult = ContextSelectorService.selectContextSize(query, {
          minChunks: config.minDocumentChunks,
          maxChunks: config.maxDocumentChunks,
          defaultChunks: config.defaultDocumentChunks,
        });
        complexity = complexityResult.complexity;
        complexityMultiplier = config.complexityMultipliers[complexity.intentComplexity] || 1.0;
      } catch (error: any) {
        logger.warn('Failed to analyze query complexity for dynamic limits', {
          error: error.message,
        });
      }
    }

    // Step 2: Calculate base limits from token budget
    let baseDocumentChunks = config.defaultDocumentChunks;
    let baseWebResults = config.defaultWebResults;

    if (config.useTokenBudgetLimits) {
      let budget: TokenBudget | undefined = tokenBudget;

      // Calculate token budget if not provided
      if (!budget && tokenBudgetOptions) {
        try {
          budget = TokenBudgetService.calculateBudget({
            ...tokenBudgetOptions,
            model,
            userPrompt: query,
          });
        } catch (error: any) {
          logger.warn('Failed to calculate token budget for dynamic limits', {
            error: error.message,
          });
        }
      }

      if (budget) {
        // Calculate available budget for context (after system/user prompts)
        const availableBudget = budget.remaining.total;

        // Calculate maximum items that fit
        const avgTokensPerItem = 
          (config.tokensPerDocumentChunk * config.documentWebRatio) +
          (config.tokensPerWebResult * (1 - config.documentWebRatio));

        const maxItems = Math.floor(availableBudget / avgTokensPerItem);

        // Distribute items based on ratio
        baseDocumentChunks = Math.floor(maxItems * config.documentWebRatio);
        baseWebResults = maxItems - baseDocumentChunks;

        logger.debug('Calculated base limits from token budget', {
          availableBudget,
          maxItems,
          baseDocumentChunks,
          baseWebResults,
        });
      }
    }

    // Step 3: Apply complexity adjustments
    let adjustedDocumentChunks = baseDocumentChunks;
    let adjustedWebResults = baseWebResults;

    if (config.useComplexityAdjustments && complexityMultiplier !== 1.0) {
      adjustedDocumentChunks = Math.floor(baseDocumentChunks * complexityMultiplier);
      adjustedWebResults = Math.floor(baseWebResults * complexityMultiplier);
    }

    // Step 4: Apply min/max constraints
    const finalMinDocumentChunks = minDocumentChunks ?? config.minDocumentChunks;
    const finalMaxDocumentChunks = maxDocumentChunks ?? config.maxDocumentChunks;
    const finalMinWebResults = minWebResults ?? config.minWebResults;
    const finalMaxWebResults = maxWebResults ?? config.maxWebResults;

    const finalDocumentChunks = Math.max(
      finalMinDocumentChunks,
      Math.min(finalMaxDocumentChunks, adjustedDocumentChunks)
    );

    const finalWebResults = Math.max(
      finalMinWebResults,
      Math.min(finalMaxWebResults, adjustedWebResults)
    );

    // Step 5: Generate reasoning
    const reasoningParts: string[] = [];
    
    if (budget) {
      reasoningParts.push(`Token budget: ${budget.remaining.total} tokens available`);
    }
    
    if (complexity) {
      reasoningParts.push(`Query complexity: ${complexity.intentComplexity} (multiplier: ${complexityMultiplier.toFixed(2)})`);
    }
    
    reasoningParts.push(`Base limits: ${baseDocumentChunks} documents, ${baseWebResults} web`);
    reasoningParts.push(`Adjusted limits: ${adjustedDocumentChunks} documents, ${adjustedWebResults} web`);
    reasoningParts.push(`Final limits: ${finalDocumentChunks} documents, ${finalWebResults} web`);

    const reasoning = reasoningParts.join('; ');

    logger.info('Dynamic limits calculated', {
      query: query.substring(0, 100),
      documentChunks: finalDocumentChunks,
      webResults: finalWebResults,
      tokenBudget: budget?.remaining.total,
      complexity: complexity?.intentComplexity,
      reasoning,
    });

    return {
      documentChunks: finalDocumentChunks,
      webResults: finalWebResults,
      reasoning,
      factors: {
        tokenBudget: budget?.remaining.total,
        complexity: complexity?.intentComplexity,
        complexityMultiplier,
        baseLimits: {
          documentChunks: baseDocumentChunks,
          webResults: baseWebResults,
        },
      },
    };
  }

  /**
   * Get recommended limits for a query (quick calculation)
   */
  static getRecommendedLimits(
    query: string,
    options: {
      model?: string;
      minDocumentChunks?: number;
      maxDocumentChunks?: number;
      minWebResults?: number;
      maxWebResults?: number;
    } = {}
  ): { documentChunks: number; webResults: number } {
    const limits = this.calculateDynamicLimits({
      query,
      model: options.model,
      minDocumentChunks: options.minDocumentChunks,
      maxDocumentChunks: options.maxDocumentChunks,
      minWebResults: options.minWebResults,
      maxWebResults: options.maxWebResults,
      config: {
        useTokenBudgetLimits: false, // Quick calculation without token budget
      },
    });

    return {
      documentChunks: limits.documentChunks,
      webResults: limits.webResults,
    };
  }
}
