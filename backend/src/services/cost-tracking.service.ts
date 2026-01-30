/**
 * Cost Tracking Service
 * Tracks API costs per query and model usage for analytics
 */

import { DatabaseService } from './database.service';
import logger from '../config/logger';

// OpenAI pricing (as of 2024, update as needed)
// Prices are per 1K tokens
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': {
    input: 0.03, // $0.03 per 1K input tokens
    output: 0.06, // $0.06 per 1K output tokens
  },
  'gpt-4-turbo': {
    input: 0.01, // $0.01 per 1K input tokens
    output: 0.03, // $0.03 per 1K output tokens
  },
  'gpt-4o': {
    input: 0.005, // $0.005 per 1K input tokens
    output: 0.015, // $0.015 per 1K output tokens
  },
  'gpt-4o-mini': {
    input: 0.00015, // $0.00015 per 1K input tokens
    output: 0.0006, // $0.0006 per 1K output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.0005, // $0.0005 per 1K input tokens
    output: 0.0015, // $0.0015 per 1K output tokens
  },
  'gpt-3.5-turbo-16k': {
    input: 0.003, // $0.003 per 1K input tokens
    output: 0.004, // $0.004 per 1K output tokens
  },
};

export interface QueryCost {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: number; // Cost in USD
  outputCost: number; // Cost in USD
  totalCost: number; // Total cost in USD
  timestamp: string;
}

export interface CostTrackingData {
  userId: string;
  queryId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number; // Total cost in USD
  metadata?: Record<string, any>;
}

/**
 * Cost Tracking Service
 */
export class CostTrackingService {
  /**
   * Calculate cost for a query based on model and token usage
   */
  static calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): QueryCost {
    // Normalize model name (handle variations)
    const normalizedModel = this.normalizeModelName(model);
    
    // Get pricing for model (default to GPT-3.5 Turbo if unknown)
    const pricing = OPENAI_PRICING[normalizedModel] || OPENAI_PRICING['gpt-3.5-turbo'];
    
    // Calculate costs
    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;
    
    return {
      model: normalizedModel,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCost: Math.round(inputCost * 1000000) / 1000000, // Round to 6 decimal places
      outputCost: Math.round(outputCost * 1000000) / 1000000,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Normalize model name to handle variations
   */
  private static normalizeModelName(model: string): string {
    const normalized = model.toLowerCase().trim();
    
    // Handle GPT-4 variations
    if (normalized.includes('gpt-4o-mini')) return 'gpt-4o-mini';
    if (normalized.includes('gpt-4o')) return 'gpt-4o';
    if (normalized.includes('gpt-4-turbo')) return 'gpt-4-turbo';
    if (normalized.includes('gpt-4')) return 'gpt-4';
    
    // Handle GPT-3.5 variations
    if (normalized.includes('gpt-3.5-turbo-16k')) return 'gpt-3.5-turbo-16k';
    if (normalized.includes('gpt-3.5-turbo')) return 'gpt-3.5-turbo';
    if (normalized.includes('gpt-3.5')) return 'gpt-3.5-turbo';
    
    // Default to GPT-3.5 Turbo for unknown models
    return 'gpt-3.5-turbo';
  }

  /**
   * Track cost for a query
   */
  static async trackCost(
    userId: string,
    costData: CostTrackingData
  ): Promise<void> {
    try {
      // Store cost data in usage logs with metadata
      await DatabaseService.logUsage(userId, 'query', {
        model: costData.model,
        promptTokens: costData.promptTokens,
        completionTokens: costData.completionTokens,
        totalTokens: costData.totalTokens,
        cost: costData.cost,
        queryId: costData.queryId,
        ...costData.metadata,
      });
      
      logger.debug('Cost tracked', {
        userId,
        model: costData.model,
        cost: costData.cost,
        tokens: costData.totalTokens,
      });
    } catch (error: any) {
      logger.error('Failed to track cost', {
        error: error.message,
        userId,
        model: costData.model,
      });
      // Don't throw - cost tracking failure shouldn't break the request
    }
  }

  /**
   * Get cost statistics for a user
   */
  static async getUserCostStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCost: number;
    totalQueries: number;
    totalTokens: number;
    averageCostPerQuery: number;
    modelBreakdown: Record<string, {
      count: number;
      totalCost: number;
      totalTokens: number;
    }>;
  }> {
    try {
      // Calculate period if not provided
      let periodStart: Date;
      let periodEnd: Date;

      if (startDate && endDate) {
        periodStart = startDate;
        periodEnd = endDate;
      } else {
        const now = new Date();
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
      }

      // Get usage logs for the period
      const { supabaseAdmin } = await import('../config/database');
      const { data: usageLogs, error } = await supabaseAdmin
        .from('usage_logs')
        .select('metadata')
        .eq('user_id', userId)
        .eq('type', 'query')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

      if (error) {
        logger.error('Error fetching cost stats:', error);
        return {
          totalCost: 0,
          totalQueries: 0,
          totalTokens: 0,
          averageCostPerQuery: 0,
          modelBreakdown: {},
        };
      }

      // Aggregate costs
      let totalCost = 0;
      let totalQueries = 0;
      let totalTokens = 0;
      const modelBreakdown: Record<string, {
        count: number;
        totalCost: number;
        totalTokens: number;
      }> = {};

      (usageLogs || []).forEach((log) => {
        if (log.metadata && typeof log.metadata.cost === 'number') {
          totalCost += log.metadata.cost;
          totalQueries++;
          
          if (typeof log.metadata.totalTokens === 'number') {
            totalTokens += log.metadata.totalTokens;
          }

          const model = log.metadata.model || 'unknown';
          if (!modelBreakdown[model]) {
            modelBreakdown[model] = {
              count: 0,
              totalCost: 0,
              totalTokens: 0,
            };
          }
          
          modelBreakdown[model].count++;
          modelBreakdown[model].totalCost += log.metadata.cost;
          if (typeof log.metadata.totalTokens === 'number') {
            modelBreakdown[model].totalTokens += log.metadata.totalTokens;
          }
        }
      });

      const averageCostPerQuery = totalQueries > 0 ? totalCost / totalQueries : 0;

      return {
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        totalQueries,
        totalTokens,
        averageCostPerQuery: Math.round(averageCostPerQuery * 1000000) / 1000000,
        modelBreakdown: Object.fromEntries(
          Object.entries(modelBreakdown).map(([model, stats]) => [
            model,
            {
              count: stats.count,
              totalCost: Math.round(stats.totalCost * 1000000) / 1000000,
              totalTokens: stats.totalTokens,
            },
          ])
        ),
      };
    } catch (error: any) {
      logger.error('Failed to get user cost stats:', error);
      return {
        totalCost: 0,
        totalQueries: 0,
        totalTokens: 0,
        averageCostPerQuery: 0,
        modelBreakdown: {},
      };
    }
  }

  /**
   * Get cost comparison between models
   */
  static getCostComparison(
    promptTokens: number,
    completionTokens: number
  ): Record<string, QueryCost> {
    const models = Object.keys(OPENAI_PRICING);
    const comparison: Record<string, QueryCost> = {};

    models.forEach((model) => {
      comparison[model] = this.calculateCost(model, promptTokens, completionTokens);
    });

    return comparison;
  }
}

export default CostTrackingService;
