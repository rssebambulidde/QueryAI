/**
 * Adaptive Context Selection Service
 * Analyzes query complexity and context needs, dynamically adjusts chunk/result counts
 * Balances between document and web results, integrates with token budgeting
 */

import { ContextSelectorService, QueryComplexity, ContextSelectionResult } from './context-selector.service';
import { TokenBudgetService, TokenBudget, TokenBudgetOptions } from './token-budget.service';
import { TokenCountService } from './token-count.service';
import logger from '../config/logger';
import { RAGContext, DocumentContext } from './rag.service';

/**
 * Adaptive context selection options
 */
export interface AdaptiveContextOptions {
  query: string; // User query
  model?: string; // Model name for token budgeting
  tokenBudget?: TokenBudget; // Pre-calculated token budget (optional)
  tokenBudgetOptions?: TokenBudgetOptions; // Token budget options (if budget not provided)
  // Context selection constraints
  minDocumentChunks?: number; // Minimum document chunks
  maxDocumentChunks?: number; // Maximum document chunks
  minWebResults?: number; // Minimum web results
  maxWebResults?: number; // Maximum web results
  // Balance preferences
  preferDocuments?: boolean; // Prefer documents over web results
  preferWeb?: boolean; // Prefer web results over documents
  balanceRatio?: number; // Document/web balance ratio (0-1, 0.5 = balanced)
  // Query complexity analysis
  enableComplexityAnalysis?: boolean; // Enable query complexity analysis (default: true)
  // Token-aware selection
  enableTokenAwareSelection?: boolean; // Enable token-aware selection (default: true)
}

/**
 * Adaptive context selection result
 */
export interface AdaptiveContextResult {
  documentChunks: number; // Recommended document chunks
  webResults: number; // Recommended web results
  complexity: QueryComplexity; // Query complexity analysis
  tokenBudget?: TokenBudget; // Token budget used
  reasoning: string; // Explanation of selection
  adjustments: {
    complexityBased: number; // Adjustment based on complexity
    tokenBased: number; // Adjustment based on token budget
    balanceBased: number; // Adjustment based on balance preferences
  };
}

/**
 * Default adaptive context configuration
 */
const DEFAULT_ADAPTIVE_CONTEXT_CONFIG = {
  minDocumentChunks: 3,
  maxDocumentChunks: 20,
  minWebResults: 2,
  maxWebResults: 10,
  defaultDocumentChunks: 5,
  defaultWebResults: 5,
  balanceRatio: 0.5, // Balanced by default
  enableComplexityAnalysis: true,
  enableTokenAwareSelection: true,
};

/**
 * Adaptive Context Selection Service
 */
export class AdaptiveContextService {
  /**
   * Analyze query and select adaptive context sizes
   */
  static selectAdaptiveContext(
    options: AdaptiveContextOptions
  ): AdaptiveContextResult {
    const {
      query,
      model = 'gpt-3.5-turbo',
      tokenBudget,
      tokenBudgetOptions,
      minDocumentChunks = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.minDocumentChunks,
      maxDocumentChunks = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.maxDocumentChunks,
      minWebResults = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.minWebResults,
      maxWebResults = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.maxWebResults,
      preferDocuments = false,
      preferWeb = false,
      balanceRatio = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.balanceRatio,
      enableComplexityAnalysis = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.enableComplexityAnalysis,
      enableTokenAwareSelection = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.enableTokenAwareSelection,
    } = options;

    // Step 1: Analyze query complexity
    let complexity: QueryComplexity;
    let complexityBasedSelection: ContextSelectionResult;
    
    if (enableComplexityAnalysis) {
      complexityBasedSelection = ContextSelectorService.selectContextSize(query, {
        minChunks: minDocumentChunks,
        maxChunks: maxDocumentChunks,
        defaultChunks: DEFAULT_ADAPTIVE_CONTEXT_CONFIG.defaultDocumentChunks,
      });
      complexity = complexityBasedSelection.complexity;
    } else {
      // Use default complexity if analysis disabled
      complexity = {
        length: query.length,
        wordCount: query.split(/\s+/).length,
        keywordCount: 0,
        keywords: [],
        intentComplexity: 'moderate',
        queryType: 'factual',
        complexityScore: 0.5,
      };
      complexityBasedSelection = {
        chunkCount: DEFAULT_ADAPTIVE_CONTEXT_CONFIG.defaultDocumentChunks,
        complexity,
        reasoning: 'Complexity analysis disabled, using default',
      };
    }

    // Step 2: Calculate token budget if not provided
    let budget: TokenBudget | undefined = tokenBudget;
    if (!budget && enableTokenAwareSelection && tokenBudgetOptions) {
      try {
        budget = TokenBudgetService.calculateBudget({
          ...tokenBudgetOptions,
          model,
          userPrompt: query,
        });
      } catch (error: any) {
        logger.warn('Failed to calculate token budget for adaptive selection', {
          error: error.message,
        });
      }
    }

    // Step 3: Calculate base counts from complexity
    let baseDocumentChunks = complexityBasedSelection.chunkCount;
    let baseWebResults = Math.max(
      minWebResults,
      Math.min(maxWebResults, Math.floor(baseDocumentChunks * 0.8))
    );

    // Step 4: Apply balance preferences
    let balanceAdjustment = 0;
    if (preferDocuments) {
      baseDocumentChunks = Math.min(maxDocumentChunks, Math.floor(baseDocumentChunks * 1.3));
      baseWebResults = Math.max(minWebResults, Math.floor(baseWebResults * 0.7));
      balanceAdjustment = 1;
    } else if (preferWeb) {
      baseDocumentChunks = Math.max(minDocumentChunks, Math.floor(baseDocumentChunks * 0.7));
      baseWebResults = Math.min(maxWebResults, Math.floor(baseWebResults * 1.3));
      balanceAdjustment = -1;
    } else {
      // Apply balance ratio
      const totalItems = baseDocumentChunks + baseWebResults;
      baseDocumentChunks = Math.floor(totalItems * balanceRatio);
      baseWebResults = totalItems - baseDocumentChunks;
      balanceAdjustment = 0;
    }

    // Step 5: Apply token-aware adjustments if enabled
    let tokenAdjustment = 0;
    let finalDocumentChunks = baseDocumentChunks;
    let finalWebResults = baseWebResults;

    if (budget && enableTokenAwareSelection) {
      // Estimate tokens per item
      const estimatedTokensPerDocument = 300; // Average tokens per document chunk
      const estimatedTokensPerWebResult = 400; // Average tokens per web result

      // Calculate available budget for context
      const availableContextBudget = budget.remaining.total;

      // Calculate maximum items that fit
      const maxItemsByBudget = Math.floor(
        availableContextBudget / ((estimatedTokensPerDocument + estimatedTokensPerWebResult) / 2)
      );

      // Adjust if budget is limiting
      if (finalDocumentChunks + finalWebResults > maxItemsByBudget) {
        const ratio = maxItemsByBudget / (finalDocumentChunks + finalWebResults);
        finalDocumentChunks = Math.max(
          minDocumentChunks,
          Math.floor(finalDocumentChunks * ratio)
        );
        finalWebResults = Math.max(
          minWebResults,
          Math.floor(finalWebResults * ratio)
        );
        tokenAdjustment = -1;
      } else if (availableContextBudget > (finalDocumentChunks + finalWebResults) * 500) {
        // If we have extra budget, we could add more, but respect max limits
        const extraBudget = availableContextBudget - (finalDocumentChunks + finalWebResults) * 500;
        const extraItems = Math.floor(extraBudget / 500);
        if (extraItems > 0) {
          const docIncrease = Math.min(
            maxDocumentChunks - finalDocumentChunks,
            Math.floor(extraItems * balanceRatio)
          );
          const webIncrease = Math.min(
            maxWebResults - finalWebResults,
            extraItems - docIncrease
          );
          finalDocumentChunks += docIncrease;
          finalWebResults += webIncrease;
          tokenAdjustment = 1;
        }
      }
    }

    // Step 6: Ensure within bounds
    finalDocumentChunks = Math.max(
      minDocumentChunks,
      Math.min(maxDocumentChunks, finalDocumentChunks)
    );
    finalWebResults = Math.max(
      minWebResults,
      Math.min(maxWebResults, finalWebResults)
    );

    // Step 7: Generate reasoning
    const reasoningParts: string[] = [];
    reasoningParts.push(`Complexity: ${complexity.intentComplexity} (score: ${complexity.complexityScore.toFixed(2)})`);
    reasoningParts.push(`Query type: ${complexity.queryType}`);
    
    if (budget) {
      reasoningParts.push(`Token budget: ${budget.remaining.total} tokens available`);
    }
    
    if (preferDocuments) {
      reasoningParts.push('Preferring documents over web results');
    } else if (preferWeb) {
      reasoningParts.push('Preferring web results over documents');
    } else {
      reasoningParts.push(`Balance ratio: ${(balanceRatio * 100).toFixed(0)}% documents`);
    }
    
    if (tokenAdjustment !== 0) {
      reasoningParts.push(
        tokenAdjustment > 0
          ? 'Token budget allows additional context'
          : 'Token budget limits context size'
      );
    }

    const reasoning = reasoningParts.join('; ');

    logger.info('Adaptive context selected', {
      query: query.substring(0, 100),
      documentChunks: finalDocumentChunks,
      webResults: finalWebResults,
      complexity: complexity.intentComplexity,
      queryType: complexity.queryType,
      tokenBudget: budget?.remaining.total,
      reasoning,
    });

    return {
      documentChunks: finalDocumentChunks,
      webResults: finalWebResults,
      complexity,
      tokenBudget: budget,
      reasoning,
      adjustments: {
        complexityBased: complexityBasedSelection.chunkCount,
        tokenBased: tokenAdjustment,
        balanceBased: balanceAdjustment,
      },
    };
  }

  /**
   * Refine context selection based on actual retrieved context
   * Adjusts selection if context is too large or too small
   */
  static refineContextSelection(
    context: RAGContext,
    options: AdaptiveContextOptions,
    initialSelection: AdaptiveContextResult
  ): AdaptiveContextResult {
    const { model = 'gpt-3.5-turbo', tokenBudget } = options;

    // Count actual tokens in context
    const contextTokens = TokenBudgetService.countContextTokens(context, model);

    // Get token budget if available
    const budget = tokenBudget || initialSelection.tokenBudget;
    
    if (!budget) {
      // No budget available, return initial selection
      return initialSelection;
    }

    // Check if context fits within budget
    const budgetCheck = TokenBudgetService.checkBudget(budget, context, model);

    // Refine selection based on actual usage
    let refinedDocumentChunks = initialSelection.documentChunks;
    let refinedWebResults = initialSelection.webResults;

    if (!budgetCheck.fits) {
      // Context exceeds budget, reduce counts
      const excessTokens = contextTokens.total - budget.remaining.total;
      const excessRatio = excessTokens / contextTokens.total;
      
      refinedDocumentChunks = Math.max(
        options.minDocumentChunks || DEFAULT_ADAPTIVE_CONTEXT_CONFIG.minDocumentChunks,
        Math.floor(refinedDocumentChunks * (1 - excessRatio * 0.5))
      );
      refinedWebResults = Math.max(
        options.minWebResults || DEFAULT_ADAPTIVE_CONTEXT_CONFIG.minWebResults,
        Math.floor(refinedWebResults * (1 - excessRatio * 0.5))
      );

      logger.info('Refining context selection due to budget constraints', {
        originalDocumentChunks: initialSelection.documentChunks,
        refinedDocumentChunks,
        originalWebResults: initialSelection.webResults,
        refinedWebResults,
        excessTokens,
        contextTokens: contextTokens.total,
        availableBudget: budget.remaining.total,
      });
    } else if (contextTokens.total < budget.remaining.total * 0.5) {
      // Context is much smaller than budget, could add more
      // But respect max limits
      const availableTokens = budget.remaining.total - contextTokens.total;
      const estimatedTokensPerItem = 350;
      const additionalItems = Math.floor(availableTokens / estimatedTokensPerItem);
      
      if (additionalItems > 0) {
        const docIncrease = Math.min(
          (options.maxDocumentChunks || DEFAULT_ADAPTIVE_CONTEXT_CONFIG.maxDocumentChunks) - refinedDocumentChunks,
          Math.floor(additionalItems * 0.6)
        );
        const webIncrease = Math.min(
          (options.maxWebResults || DEFAULT_ADAPTIVE_CONTEXT_CONFIG.maxWebResults) - refinedWebResults,
          additionalItems - docIncrease
        );
        
        refinedDocumentChunks += docIncrease;
        refinedWebResults += webIncrease;

        logger.info('Refining context selection to utilize available budget', {
          originalDocumentChunks: initialSelection.documentChunks,
          refinedDocumentChunks,
          originalWebResults: initialSelection.webResults,
          refinedWebResults,
          availableTokens,
          additionalItems,
        });
      }
    }

    return {
      ...initialSelection,
      documentChunks: refinedDocumentChunks,
      webResults: refinedWebResults,
      reasoning: initialSelection.reasoning + '; Refined based on actual context size',
    };
  }

  /**
   * Balance document and web results based on query characteristics
   */
  static balanceDocumentAndWeb(
    query: string,
    complexity: QueryComplexity,
    baseDocumentChunks: number,
    baseWebResults: number,
    options: {
      preferDocuments?: boolean;
      preferWeb?: boolean;
      balanceRatio?: number;
    } = {}
  ): { documentChunks: number; webResults: number } {
    const {
      preferDocuments = false,
      preferWeb = false,
      balanceRatio = DEFAULT_ADAPTIVE_CONTEXT_CONFIG.balanceRatio,
    } = options;

    let documentChunks = baseDocumentChunks;
    let webResults = baseWebResults;

    // Adjust based on query type
    if (complexity.queryType === 'exploratory' || complexity.queryType === 'conceptual') {
      // More web results for exploratory/conceptual queries
      webResults = Math.floor(webResults * 1.2);
      documentChunks = Math.floor(documentChunks * 0.9);
    } else if (complexity.queryType === 'factual') {
      // More documents for factual queries
      documentChunks = Math.floor(documentChunks * 1.1);
      webResults = Math.floor(webResults * 0.9);
    }

    // Apply user preferences
    if (preferDocuments) {
      documentChunks = Math.floor(documentChunks * 1.3);
      webResults = Math.floor(webResults * 0.7);
    } else if (preferWeb) {
      documentChunks = Math.floor(documentChunks * 0.7);
      webResults = Math.floor(webResults * 1.3);
    } else {
      // Apply balance ratio
      const total = documentChunks + webResults;
      documentChunks = Math.floor(total * balanceRatio);
      webResults = total - documentChunks;
    }

    return { documentChunks, webResults };
  }

  /**
   * Get recommended context sizes for a query
   * Simplified version for quick recommendations
   */
  static getRecommendedContextSizes(
    query: string,
    options: {
      model?: string;
      minDocumentChunks?: number;
      maxDocumentChunks?: number;
      minWebResults?: number;
      maxWebResults?: number;
    } = {}
  ): { documentChunks: number; webResults: number } {
    const selection = this.selectAdaptiveContext({
      query,
      model: options.model,
      minDocumentChunks: options.minDocumentChunks,
      maxDocumentChunks: options.maxDocumentChunks,
      minWebResults: options.minWebResults,
      maxWebResults: options.maxWebResults,
      enableTokenAwareSelection: false, // Quick recommendation without token budget
    });

    return {
      documentChunks: selection.documentChunks,
      webResults: selection.webResults,
    };
  }
}
