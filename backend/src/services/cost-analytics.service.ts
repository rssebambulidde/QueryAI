/**
 * Cost Analytics Service (Week 12: Monitoring & Analytics)
 * Cost tracking, time-series analytics, and cost APIs data layer.
 * Builds on CostTrackingService and usage_logs.
 */

import logger from '../config/logger';
import { CostTrackingService } from './cost-tracking.service';

export type CostInterval = 'hour' | 'day' | 'week';

export interface CostTrendPoint {
  date: string;
  totalCost: number;
  totalQueries: number;
  totalTokens: number;
  byModel: Record<string, { cost: number; queries: number; tokens: number }>;
}

export interface CostSummary {
  totalCost: number;
  totalQueries: number;
  totalTokens: number;
  averageCostPerQuery: number;
  modelBreakdown: Record<
    string,
    { count: number; totalCost: number; totalTokens: number }
  >;
}

export interface CostAnalyticsQuery {
  userId: string;
  startDate: string;
  endDate: string;
  interval?: CostInterval;
}

/**
 * Cost Analytics Service
 */
export class CostAnalyticsService {
  /**
   * Get cost summary for a user and period (delegates to CostTrackingService).
   */
  static async getCostSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CostSummary> {
    const stats = await CostTrackingService.getUserCostStats(
      userId,
      startDate,
      endDate
    );
    return {
      totalCost: stats.totalCost,
      totalQueries: stats.totalQueries,
      totalTokens: stats.totalTokens,
      averageCostPerQuery: stats.averageCostPerQuery,
      modelBreakdown: stats.modelBreakdown,
    };
  }

  /**
   * Get cost trends over time (daily or interval buckets).
   */
  static async getCostTrends(
    userId: string,
    startDate: string,
    endDate: string,
    interval: CostInterval = 'day'
  ): Promise<CostTrendPoint[]> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      const start = new Date(startDate);
      const end = new Date(endDate);

      const { data: rows, error } = await supabaseAdmin
        .from('usage_logs')
        .select('created_at, metadata')
        .eq('user_id', userId)
        .eq('type', 'query')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Cost analytics trends query failed', { error, userId });
        return [];
      }

      const bucketFormat = this.intervalToBucketFormat(interval);
      const buckets = new Map<
        string,
        {
          cost: number;
          queries: number;
          tokens: number;
          byModel: Record<string, { cost: number; queries: number; tokens: number }>;
        }
      >();

      for (const row of rows || []) {
        const meta = (row as { metadata?: Record<string, unknown> }).metadata;
        if (!meta || typeof (meta as { cost?: number }).cost !== 'number') continue;

        const cost = (meta as { cost: number }).cost;
        const model = String((meta as { model?: string }).model || 'unknown');
        const tokens = Number((meta as { totalTokens?: number }).totalTokens) || 0;

        const d = new Date((row as { created_at: string }).created_at);
        const key = this.formatBucketKey(d, bucketFormat);

        if (!buckets.has(key)) {
          buckets.set(key, {
            cost: 0,
            queries: 0,
            tokens: 0,
            byModel: {},
          });
        }
        const b = buckets.get(key)!;
        b.cost += cost;
        b.queries += 1;
        b.tokens += tokens;
        if (!b.byModel[model]) {
          b.byModel[model] = { cost: 0, queries: 0, tokens: 0 };
        }
        b.byModel[model].cost += cost;
        b.byModel[model].queries += 1;
        b.byModel[model].tokens += tokens;
      }

      const sorted = Array.from(buckets.entries())
        .map(([date, v]) => ({
          date,
          totalCost: Math.round(v.cost * 1e6) / 1e6,
          totalQueries: v.queries,
          totalTokens: v.tokens,
          byModel: Object.fromEntries(
            Object.entries(v.byModel).map(([m, s]) => [
              m,
              {
                cost: Math.round(s.cost * 1e6) / 1e6,
                queries: s.queries,
                tokens: s.tokens,
              },
            ])
          ),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return sorted;
    } catch (err: unknown) {
      logger.error('Cost analytics getCostTrends failed', {
        error: err instanceof Error ? err.message : String(err),
        userId,
      });
      return [];
    }
  }

  private static intervalToBucketFormat(
    interval: CostInterval
  ): 'hour' | 'day' | 'week' {
    return interval;
  }

  private static formatBucketKey(d: Date, format: 'hour' | 'day' | 'week'): string {
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const day = d.getUTCDate();
    const m = String(mo + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');

    if (format === 'hour') {
      return `${y}-${m}-${dd}T${h}:00:00Z`;
    }
    if (format === 'week') {
      const dow = d.getUTCDay();
      const toMonday = dow === 0 ? 6 : dow - 1;
      const monday = new Date(Date.UTC(y, mo, day - toMonday));
      const my = monday.getUTCFullYear();
      const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
      const md = String(monday.getUTCDate()).padStart(2, '0');
      return `${my}-${mm}-${md}`;
    }
    return `${y}-${m}-${dd}`;
  }
}

export default CostAnalyticsService;
