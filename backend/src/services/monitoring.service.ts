/**
 * Monitoring Service (Week 12: Monitoring & Analytics)
 * Usage analytics and performance metrics aggregation.
 */

import logger from '../config/logger';
import { LatencyTrackerService, type LatencyQuery } from './latency-tracker.service';
import { ErrorTrackerService, type ErrorQuery } from './error-tracker.service';

export type UsageBucket = 'hour' | 'day' | 'week';

export interface UsageAnalyticsPoint {
  date: string;
  queries: number;
  documentUploads: number;
  apiCalls: number;
}

export interface UsageAnalyticsResult {
  points: UsageAnalyticsPoint[];
  interval: UsageBucket;
  startDate: string;
  endDate: string;
}

export interface PerformanceSummary {
  latency: {
    averageMs: number;
    p95Ms: number;
    p99Ms: number;
    totalOperations: number;
    byOperation: Array<{ operationType: string; count: number; avgMs: number; p95Ms: number }>;
  };
  errors: {
    totalErrors: number;
    errorRatePercent: number;
    byService: Array<{ serviceType: string; count: number; percentage: number }>;
  };
  throughputEstimate: number; // ops per second over period
}

/**
 * Format date for bucket key.
 */
function formatBucketKey(d: Date, bucket: UsageBucket): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');

  if (bucket === 'hour') return `${y}-${m}-${dd}T${h}:00:00Z`;
  if (bucket === 'week') {
    const dow = d.getUTCDay();
    const toMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate() - toMonday));
    const my = monday.getUTCFullYear();
    const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
    const md = String(monday.getUTCDate()).padStart(2, '0');
    return `${my}-${mm}-${md}`;
  }
  return `${y}-${m}-${dd}`;
}

/**
 * Monitoring Service
 */
export class MonitoringService {
  /**
   * Get usage analytics over time (queries, document uploads, api calls per bucket).
   */
  static async getUsageAnalytics(
    startDate: string,
    endDate: string,
    interval: UsageBucket = 'day',
    userId?: string
  ): Promise<UsageAnalyticsResult> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      const start = new Date(startDate);
      const end = new Date(endDate);

      let q = supabaseAdmin
        .from('usage_logs')
        .select('type, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (userId) q = q.eq('user_id', userId);

      const { data: rows, error } = await q.order('created_at', { ascending: true });

      if (error) {
        logger.error('Monitoring usage analytics query failed', { error, userId });
        return { points: [], interval, startDate, endDate };
      }

      const buckets = new Map<
        string,
        { queries: number; documentUploads: number; apiCalls: number }
      >();

      for (const row of rows || []) {
        const r = row as { type: string; created_at: string };
        const key = formatBucketKey(new Date(r.created_at), interval);
        if (!buckets.has(key)) {
          buckets.set(key, { queries: 0, documentUploads: 0, apiCalls: 0 });
        }
        const b = buckets.get(key)!;
        if (r.type === 'query') b.queries++;
        else if (r.type === 'document_upload') b.documentUploads++;
        else if (r.type === 'api_call') b.apiCalls++;
      }

      const points: UsageAnalyticsPoint[] = Array.from(buckets.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { points, interval, startDate, endDate };
    } catch (err: unknown) {
      logger.error('Monitoring getUsageAnalytics failed', {
        error: err instanceof Error ? err.message : String(err),
        userId,
      });
      return { points: [], interval, startDate, endDate };
    }
  }

  /**
   * Get aggregated performance metrics (latency + errors + throughput estimate).
   */
  static async getPerformanceSummary(
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<PerformanceSummary> {
    const latQuery: LatencyQuery = {
      startDate,
      endDate,
      userId,
    };
    const errQuery: ErrorQuery = {
      startDate,
      endDate,
      userId,
    };

    const [latStats, errStats] = await Promise.all([
      LatencyTrackerService.getLatencyStats(latQuery),
      ErrorTrackerService.getErrorStats(errQuery),
    ]);

    let totalOps = 0;
    let sumLatency = 0;
    const latByOp: Array<{ operationType: string; count: number; avgMs: number; p95Ms: number }> = [];

    for (const s of latStats) {
      const count = s.count;
      totalOps += count;
      sumLatency += s.averageLatency * count;
      latByOp.push({
        operationType: s.operationType,
        count,
        avgMs: s.averageLatency,
        p95Ms: s.p95,
      });
    }

    const avgMs = totalOps > 0 ? sumLatency / totalOps : 0;
    const p95 = latStats.length > 0
      ? Math.max(...latStats.map((s) => s.p95))
      : 0;
    const p99 = latStats.length > 0
      ? Math.max(...latStats.map((s) => s.p99))
      : 0;

    let totalErrors = 0;
    const byService: Array<{ serviceType: string; count: number; percentage: number }> = [];
    for (const e of errStats) {
      totalErrors += e.count;
      byService.push({
        serviceType: e.serviceType,
        count: e.count,
        percentage: e.errorRate,
      });
    }
    const errorRatePercent = totalOps > 0 ? (totalErrors / (totalOps + totalErrors)) * 100 : 0;

    const days = Math.max(
      1,
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const seconds = days * 24 * 60 * 60;
    const throughputEstimate = seconds > 0 ? (totalOps + totalErrors) / seconds : 0;

    return {
      latency: {
        averageMs: Math.round(avgMs * 100) / 100,
        p95Ms: Math.round(p95 * 100) / 100,
        p99Ms: Math.round(p99 * 100) / 100,
        totalOperations: totalOps,
        byOperation: latByOp
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
      errors: {
        totalErrors,
        errorRatePercent: Math.round(errorRatePercent * 100) / 100,
        byService: byService.sort((a, b) => b.count - a.count).slice(0, 10),
      },
      throughputEstimate: Math.round(throughputEstimate * 1e4) / 1e4,
    };
  }
}

export default MonitoringService;
