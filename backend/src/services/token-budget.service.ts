/**
 * Token Budget Service
 * Calculates available token budget and allocates it to different context components
 * Ensures no context overflow by managing token distribution
 */

import { TokenCountService } from './token-count.service';
import logger from '../config/logger';
import { RAGContext, DocumentContext } from './rag.service';

/**
 * Model token limits (total context window)
 * These are the maximum tokens including both input and output
 */
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // GPT-3.5 models
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-3.5-turbo-1106': 16385,
  'gpt-3.5-turbo-0125': 16385,
  
  // GPT-4 models
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4-0125-preview': 128000,
  'gpt-4-1106-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  
  // Default fallback
  'default': 16385,
};

/**
 * Default allocation ratios for context components
 */
export interface BudgetAllocation {
  documentContext: number; // Ratio for document context (0-1)
  webResults: number; // Ratio for web results (0-1)
  systemPrompt: number; // Ratio for system prompt (0-1)
  userPrompt: number; // Ratio for user prompt/question (0-1)
  responseReserve: number; // Reserve for response tokens (0-1)
  overhead: number; // Overhead for formatting, metadata, etc. (0-1)
}

/**
 * Default budget allocation
 */
export const DEFAULT_BUDGET_ALLOCATION: BudgetAllocation = {
  documentContext: 0.50, // 50% for document context
  webResults: 0.20, // 20% for web results
  systemPrompt: 0.05, // 5% for system prompt
  userPrompt: 0.05, // 5% for user prompt
  responseReserve: 0.15, // 15% reserve for response
  overhead: 0.05, // 5% overhead for formatting
};

/**
 * Token budget calculation result
 */
export interface TokenBudget {
  model: string;
  modelLimit: number; // Total model token limit
  availableBudget: number; // Available tokens after reserves
  allocatedBudget: number; // Total allocated budget
  allocations: {
    documentContext: number; // Tokens allocated for documents
    webResults: number; // Tokens allocated for web results
    systemPrompt: number; // Tokens allocated for system prompt
    userPrompt: number; // Tokens allocated for user prompt
    responseReserve: number; // Tokens reserved for response
    overhead: number; // Tokens for overhead
  };
  usage: {
    documentContext: number; // Actual tokens used for documents
    webResults: number; // Actual tokens used for web results
    systemPrompt: number; // Actual tokens used for system prompt
    userPrompt: number; // Actual tokens used for user prompt
    total: number; // Total tokens used
  };
  remaining: {
    documentContext: number; // Remaining tokens for documents
    webResults: number; // Remaining tokens for web results
    total: number; // Total remaining tokens
  };
  warnings: string[]; // Warnings if budget exceeded
}

/**
 * Token budget options
 */
export interface TokenBudgetOptions {
  model: string; // Model name (e.g., 'gpt-3.5-turbo')
  maxResponseTokens?: number; // Maximum response tokens (default: calculated from allocation)
  allocation?: Partial<BudgetAllocation>; // Custom allocation ratios
  systemPrompt?: string; // System prompt text (for accurate counting)
  userPrompt?: string; // User prompt/question text (for accurate counting)
  strictMode?: boolean; // Strict mode: throw error if budget exceeded
}

/**
 * Token Budget Service
 */
export class TokenBudgetService {
  /**
   * Get token limit for a model
   */
  static getModelLimit(model: string): number {
    // Check exact match first
    if (model in MODEL_TOKEN_LIMITS) {
      return MODEL_TOKEN_LIMITS[model];
    }
    
    // Try to infer from model name
    if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
      return MODEL_TOKEN_LIMITS['gpt-4-turbo'];
    }
    
    if (model.includes('gpt-4-32k')) {
      return MODEL_TOKEN_LIMITS['gpt-4-32k'];
    }
    
    if (model.includes('gpt-4')) {
      return MODEL_TOKEN_LIMITS['gpt-4'];
    }
    
    if (model.includes('gpt-3.5-turbo')) {
      return MODEL_TOKEN_LIMITS['gpt-3.5-turbo'];
    }
    
    // Default fallback
    logger.warn('Unknown model, using default token limit', { model });
    return MODEL_TOKEN_LIMITS['default'];
  }

  /**
   * Calculate token budget for a request
   */
  static calculateBudget(options: TokenBudgetOptions): TokenBudget {
    const model = options.model || 'gpt-3.5-turbo';
    const modelLimit = this.getModelLimit(model);
    
    // Merge allocation with defaults
    const allocation: BudgetAllocation = {
      ...DEFAULT_BUDGET_ALLOCATION,
      ...options.allocation,
    };
    
    // Validate allocation ratios sum to 1.0
    const totalRatio = Object.values(allocation).reduce((sum, val) => sum + val, 0);
    if (Math.abs(totalRatio - 1.0) > 0.01) {
      logger.warn('Budget allocation ratios do not sum to 1.0', {
        totalRatio,
        allocation,
      });
      // Normalize ratios
      Object.keys(allocation).forEach(key => {
        (allocation as any)[key] = (allocation as any)[key] / totalRatio;
      });
    }
    
    // Calculate response reserve
    const maxResponseTokens = options.maxResponseTokens || Math.floor(modelLimit * allocation.responseReserve);
    
    // Calculate available budget (model limit - response reserve - overhead)
    const overheadTokens = Math.floor(modelLimit * allocation.overhead);
    const availableBudget = modelLimit - maxResponseTokens - overheadTokens;
    
    // Allocate budget to components
    const allocations = {
      documentContext: Math.floor(availableBudget * allocation.documentContext),
      webResults: Math.floor(availableBudget * allocation.webResults),
      systemPrompt: Math.floor(availableBudget * allocation.systemPrompt),
      userPrompt: Math.floor(availableBudget * allocation.userPrompt),
      responseReserve: maxResponseTokens,
      overhead: overheadTokens,
    };
    
    // Count actual usage for system and user prompts if provided
    const encodingType = TokenCountService.getEncodingForModel(model);
    const systemPromptTokens = options.systemPrompt
      ? TokenCountService.countTokens(options.systemPrompt, encodingType)
      : allocations.systemPrompt;
    const userPromptTokens = options.userPrompt
      ? TokenCountService.countTokens(options.userPrompt, encodingType)
      : allocations.userPrompt;
    
    // Calculate total allocated
    const allocatedBudget = 
      allocations.documentContext +
      allocations.webResults +
      systemPromptTokens +
      userPromptTokens +
      allocations.responseReserve +
      allocations.overhead;
    
    // Initial usage (system and user prompts)
    const usage = {
      documentContext: 0,
      webResults: 0,
      systemPrompt: systemPromptTokens,
      userPrompt: userPromptTokens,
      total: systemPromptTokens + userPromptTokens,
    };
    
    // Calculate remaining budget
    const remaining = {
      documentContext: allocations.documentContext,
      webResults: allocations.webResults,
      total: availableBudget - usage.total,
    };
    
    // Check for warnings
    const warnings: string[] = [];
    if (systemPromptTokens > allocations.systemPrompt) {
      warnings.push(`System prompt exceeds allocation: ${systemPromptTokens} > ${allocations.systemPrompt}`);
    }
    if (userPromptTokens > allocations.userPrompt) {
      warnings.push(`User prompt exceeds allocation: ${userPromptTokens} > ${allocations.userPrompt}`);
    }
    if (usage.total > availableBudget) {
      warnings.push(`Total usage exceeds available budget: ${usage.total} > ${availableBudget}`);
    }
    
    // In strict mode, throw error if budget exceeded
    if (options.strictMode && warnings.length > 0) {
      throw new Error(`Token budget exceeded: ${warnings.join('; ')}`);
    }
    
    return {
      model,
      modelLimit,
      availableBudget,
      allocatedBudget,
      allocations,
      usage,
      remaining,
      warnings,
    };
  }

  /**
   * Count tokens in RAG context
   */
  static countContextTokens(
    context: RAGContext,
    model: string = 'gpt-3.5-turbo'
  ): { documentContext: number; webResults: number; total: number } {
    const encodingType = TokenCountService.getEncodingForModel(model);
    
    // Count document context tokens
    const documentContextTokens = context.documentContexts.reduce((sum, doc) => {
      const docText = `[Document] ${doc.documentName}\n${doc.content}`;
      return sum + TokenCountService.countTokens(docText, encodingType);
    }, 0);
    
    // Count web results tokens
    const webResultsTokens = context.webSearchResults.reduce((sum, result) => {
      const resultText = `[Web Source] ${result.title}\nURL: ${result.url}\n${result.content}`;
      return sum + TokenCountService.countTokens(resultText, encodingType);
    }, 0);
    
    return {
      documentContext: documentContextTokens,
      webResults: webResultsTokens,
      total: documentContextTokens + webResultsTokens,
    };
  }

  /**
   * Check if context fits within budget
   */
  static checkBudget(
    budget: TokenBudget,
    context: RAGContext,
    model: string = 'gpt-3.5-turbo'
  ): {
    fits: boolean;
    contextTokens: { documentContext: number; webResults: number; total: number };
    remaining: { documentContext: number; webResults: number; total: number };
    warnings: string[];
    errors: string[];
  } {
    const contextTokens = this.countContextTokens(context, model);
    
    // Calculate remaining budget
    const remaining = {
      documentContext: budget.remaining.documentContext - contextTokens.documentContext,
      webResults: budget.remaining.webResults - contextTokens.webResults,
      total: budget.remaining.total - contextTokens.total,
    };
    
    // Check if fits
    const fits = remaining.total >= 0 && remaining.documentContext >= 0 && remaining.webResults >= 0;
    
    // Generate warnings
    const warnings: string[] = [];
    const errors: string[] = [];
    
    if (contextTokens.documentContext > budget.allocations.documentContext) {
      const message = `Document context exceeds allocation: ${contextTokens.documentContext} > ${budget.allocations.documentContext}`;
      warnings.push(message);
      if (!fits) errors.push(message);
    }
    
    if (contextTokens.webResults > budget.allocations.webResults) {
      const message = `Web results exceed allocation: ${contextTokens.webResults} > ${budget.allocations.webResults}`;
      warnings.push(message);
      if (!fits) errors.push(message);
    }
    
    if (contextTokens.total > budget.remaining.total) {
      const message = `Total context exceeds remaining budget: ${contextTokens.total} > ${budget.remaining.total}`;
      warnings.push(message);
      errors.push(message);
    }
    
    // Update budget usage
    budget.usage.documentContext = contextTokens.documentContext;
    budget.usage.webResults = contextTokens.webResults;
    budget.usage.total = budget.usage.systemPrompt + budget.usage.userPrompt + contextTokens.total;
    budget.remaining = remaining;
    budget.warnings.push(...warnings);
    
    return {
      fits,
      contextTokens,
      remaining,
      warnings,
      errors,
    };
  }

  /**
   * Trim context to fit within budget
   * Prioritizes higher-scored items
   */
  static trimContextToBudget(
    context: RAGContext,
    budget: TokenBudget,
    model: string = 'gpt-3.5-turbo'
  ): RAGContext {
    const encodingType = TokenCountService.getEncodingForModel(model);
    const trimmedContext: RAGContext = {
      documentContexts: [],
      webSearchResults: [],
    };
    
    let documentTokens = 0;
    let webTokens = 0;
    
    // Sort documents by score (descending) and add until budget exhausted
    const sortedDocuments = [...context.documentContexts].sort((a, b) => b.score - a.score);
    for (const doc of sortedDocuments) {
      const docText = `[Document] ${doc.documentName}\n${doc.content}`;
      const docTokens = TokenCountService.countTokens(docText, encodingType);
      
      if (documentTokens + docTokens <= budget.remaining.documentContext) {
        trimmedContext.documentContexts.push(doc);
        documentTokens += docTokens;
      } else {
        // Try to fit a truncated version
        const remainingTokens = budget.remaining.documentContext - documentTokens;
        if (remainingTokens > 100) { // Only if we have meaningful space
          const truncatedContent = this.truncateToTokens(doc.content, remainingTokens - 50, encodingType); // Reserve 50 for metadata
          trimmedContext.documentContexts.push({
            ...doc,
            content: truncatedContent + '...',
          });
          documentTokens += TokenCountService.countTokens(`[Document] ${doc.documentName}\n${truncatedContent}`, encodingType);
        }
        break;
      }
    }
    
    // Sort web results by score (if available) and add until budget exhausted
    const sortedWebResults = [...context.webSearchResults].sort((a, b) => {
      const aScore = (a as any).score || 0;
      const bScore = (b as any).score || 0;
      return bScore - aScore;
    });
    
    for (const result of sortedWebResults) {
      const resultText = `[Web Source] ${result.title}\nURL: ${result.url}\n${result.content}`;
      const resultTokens = TokenCountService.countTokens(resultText, encodingType);
      
      if (webTokens + resultTokens <= budget.remaining.webResults) {
        trimmedContext.webSearchResults.push(result);
        webTokens += resultTokens;
      } else {
        // Try to fit a truncated version
        const remainingTokens = budget.remaining.webResults - webTokens;
        if (remainingTokens > 100) { // Only if we have meaningful space
          const truncatedContent = this.truncateToTokens(result.content, remainingTokens - 100, encodingType); // Reserve 100 for title/URL
          trimmedContext.webSearchResults.push({
            ...result,
            content: truncatedContent + '...',
          });
          webTokens += TokenCountService.countTokens(`[Web Source] ${result.title}\nURL: ${result.url}\n${truncatedContent}`, encodingType);
        }
        break;
      }
    }
    
    logger.info('Context trimmed to fit budget', {
      originalDocuments: context.documentContexts.length,
      trimmedDocuments: trimmedContext.documentContexts.length,
      originalWebResults: context.webSearchResults.length,
      trimmedWebResults: trimmedContext.webSearchResults.length,
      documentTokens,
      webTokens,
      totalTokens: documentTokens + webTokens,
    });
    
    return trimmedContext;
  }

  /**
   * Truncate text to fit within token limit
   */
  private static truncateToTokens(
    text: string,
    maxTokens: number,
    encodingType: string
  ): string {
    if (maxTokens <= 0) {
      return '';
    }
    
    const encodingType = TokenCountService.getEncodingForModel('gpt-3.5-turbo');
    const tokens = TokenCountService.countTokens(text, encodingType);
    
    if (tokens <= maxTokens) {
      return text;
    }
    
    // Simple truncation: estimate characters per token (4 chars per token average)
    const estimatedChars = Math.floor(maxTokens * 4);
    const truncated = text.substring(0, Math.min(estimatedChars, text.length));
    
    // Refine by counting actual tokens
    let refined = truncated;
    let refinedTokens = TokenCountService.countTokens(refined, encodingType);
    
    // Adjust if needed
    if (refinedTokens > maxTokens) {
      const ratio = maxTokens / refinedTokens;
      const newLength = Math.floor(refined.length * ratio);
      refined = text.substring(0, newLength);
    } else if (refinedTokens < maxTokens && refined.length < text.length) {
      // Try to add more if we have space
      const remaining = text.substring(refined.length);
      const remainingTokens = TokenCountService.countTokens(remaining, encodingType);
      if (refinedTokens + remainingTokens <= maxTokens) {
        refined = text;
      }
    }
    
    return refined;
  }

  /**
   * Get budget summary for logging
   */
  static getBudgetSummary(budget: TokenBudget): string {
    return `Token Budget: ${budget.usage.total}/${budget.modelLimit} tokens used, ` +
           `${budget.remaining.total} remaining. ` +
           `Allocations: Documents=${budget.allocations.documentContext}, ` +
           `Web=${budget.allocations.webResults}, ` +
           `Response=${budget.allocations.responseReserve}`;
  }
}
