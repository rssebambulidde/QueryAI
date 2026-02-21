/**
 * Cost Tracking Service
 *
 * Tracks API costs per query and model usage for analytics.
 * Pricing is sourced dynamically from the provider model catalogues
 * (OpenAI, Anthropic, Google, Groq) via ProviderRegistry.
 */

import { DatabaseService } from './database.service';
import logger from '../config/logger';
import { ProviderRegistry } from '../providers/provider-registry';

// ── Pricing types & fallback ─────────────────────────────────────────────────

interface ModelPricing {
  inputPer1M: number;   // USD per 1 M input tokens
  outputPer1M: number;  // USD per 1 M output tokens
}

/** Conservative fallback for truly unknown models (roughly GPT-4o-mini rates). */
const FALLBACK_PRICING: ModelPricing = { inputPer1M: 0.15, outputPer1M: 0.60 };

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

  // ── Pricing cache ────────────────────────────────────────────────────────

  /** Lazily-built map: model ID (lowercase) → per-1M pricing. */
  private static pricingCache: Map<string, ModelPricing> | null = null;

  /**
   * Build (or return cached) pricing map from all provider model catalogues.
   */
  private static getPricingMap(): Map<string, ModelPricing> {
    if (CostTrackingService.pricingCache) return CostTrackingService.pricingCache;

    const map = new Map<string, ModelPricing>();

    try {
      const providers = ProviderRegistry.listProviders();
      for (const provider of providers) {
        for (const model of provider.models) {
          map.set(model.id.toLowerCase(), {
            inputPer1M: model.inputCostPer1M,
            outputPer1M: model.outputCostPer1M,
          });
        }
      }
    } catch (err: any) {
      logger.warn('Could not load pricing from provider registry', { error: err?.message });
    }

    if (map.size > 0) CostTrackingService.pricingCache = map;
    return map;
  }

  /**
   * Resolve model ID → pricing.  Tries exact match, then longest-prefix
   * match (APIs often return versioned names like "gpt-4o-2024-08-06").
   * Returns [resolvedModelId, pricing].
   */
  private static resolveModel(model: string): [string, ModelPricing] {
    const map = CostTrackingService.getPricingMap();
    const normalized = model.toLowerCase().trim();

    // 1. Exact match
    const exact = map.get(normalized);
    if (exact) return [normalized, exact];

    // 2. Longest catalogue ID that is a prefix of the returned model name
    let bestId: string | null = null;
    let bestLen = 0;
    for (const [catalogueId, pricing] of map) {
      if (normalized.startsWith(catalogueId) && catalogueId.length > bestLen) {
        bestId = catalogueId;
        bestLen = catalogueId.length;
      }
    }
    if (bestId) return [bestId, map.get(bestId)!];

    // 3. Fallback
    logger.warn('Unknown model for cost tracking, using fallback pricing', { model });
    return [model.toLowerCase().trim(), FALLBACK_PRICING];
  }

  /** @internal  Reset cached pricing map (test-only). */
  static _resetPricingCache(): void {
    CostTrackingService.pricingCache = null;
  }

  // ── Cost calculation ─────────────────────────────────────────────────────

  /**
   * Calculate cost for a query based on model and token usage
   */
  static calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): QueryCost {
    const [resolvedModel, pricing] = CostTrackingService.resolveModel(model);

    // ModelInfo prices are per 1 M tokens
    const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
    const totalCost = inputCost + outputCost;

    return {
      model: resolvedModel,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      inputCost: Math.round(inputCost * 1_000_000) / 1_000_000, // Round to 6 decimal places
      outputCost: Math.round(outputCost * 1_000_000) / 1_000_000,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
      timestamp: new Date().toISOString(),
    };
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
   * Get cost comparison between all available models
   */
  static getCostComparison(
    promptTokens: number,
    completionTokens: number
  ): Record<string, QueryCost> {
    const map = CostTrackingService.getPricingMap();
    const comparison: Record<string, QueryCost> = {};

    for (const modelId of map.keys()) {
      comparison[modelId] = this.calculateCost(modelId, promptTokens, completionTokens);
    }

    return comparison;
  }
}

export default CostTrackingService;
