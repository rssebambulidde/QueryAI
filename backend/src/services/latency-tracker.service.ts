/**
 * Latency Tracking Service
 * Tracks latency for all major operations
 */

import logger from '../config/logger';
import { supabaseAdmin } from '../config/database';

export enum OperationType {
  // RAG Operations
  RAG_CONTEXT_RETRIEVAL = 'rag_context_retrieval',
  DOCUMENT_SEARCH = 'document_search',
  SEMANTIC_SEARCH = 'semantic_search',
  KEYWORD_SEARCH = 'keyword_search',
  WEB_SEARCH = 'web_search',
  EMBEDDING_GENERATION = 'embedding_generation',
  PINECONE_QUERY = 'pinecone_query',
  PINECONE_UPSERT = 'pinecone_upsert',
  PINECONE_DELETE = 'pinecone_delete',
  
  // AI Operations
  AI_QUESTION_ANSWERING = 'ai_question_answering',
  AI_STREAMING = 'ai_streaming',
  AI_OFF_TOPIC_CHECK = 'ai_off_topic_check',
  AI_FOLLOW_UP_GENERATION = 'ai_follow_up_generation',
  AI_SUMMARY_GENERATION = 'ai_summary_generation',
  
  // Processing Operations
  CONTEXT_FORMATTING = 'context_formatting',
  CONTEXT_COMPRESSION = 'context_compression',
  CONTEXT_SUMMARIZATION = 'context_summarization',
  RERANKING = 'reranking',
  DEDUPLICATION = 'deduplication',
  DIVERSITY_FILTERING = 'diversity_filtering',
  
  // Other Operations
  CACHE_LOOKUP = 'cache_lookup',
  CACHE_STORE = 'cache_store',
  DATABASE_QUERY = 'database_query',
  EXTERNAL_API_CALL = 'external_api_call',
}

export interface LatencyMetric {
  operationType: OperationType;
  userId?: string;
  queryId?: string;
  duration: number; // milliseconds
  timestamp: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface LatencyStats {
  operationType: OperationType;
  count: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p50: number; // Median
  p95: number; // 95th percentile
  p99: number; // 99th percentile
  successRate: number;
  errorRate: number;
}

export interface LatencyQuery {
  operationType?: OperationType;
  userId?: string;
  startDate?: string;
  endDate?: string;
  minLatency?: number;
  maxLatency?: number;
  limit?: number;
  offset?: number;
}

export interface LatencyAlert {
  operationType: OperationType;
  threshold: number;
  currentLatency: number;
  alertLevel: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

/**
 * Latency Tracker Service
 * Tracks and stores latency metrics for all operations
 */
export class LatencyTrackerService {
  private static readonly ALERT_THRESHOLDS: Record<OperationType, { warning: number; critical: number }> = {
    [OperationType.RAG_CONTEXT_RETRIEVAL]: { warning: 2000, critical: 5000 },
    [OperationType.DOCUMENT_SEARCH]: { warning: 1500, critical: 3000 },
    [OperationType.SEMANTIC_SEARCH]: { warning: 1000, critical: 2500 },
    [OperationType.KEYWORD_SEARCH]: { warning: 500, critical: 1500 },
    [OperationType.WEB_SEARCH]: { warning: 3000, critical: 8000 },
    [OperationType.EMBEDDING_GENERATION]: { warning: 2000, critical: 5000 },
    [OperationType.PINECONE_QUERY]: { warning: 1000, critical: 3000 },
    [OperationType.PINECONE_UPSERT]: { warning: 2000, critical: 5000 },
    [OperationType.PINECONE_DELETE]: { warning: 1000, critical: 3000 },
    [OperationType.AI_QUESTION_ANSWERING]: { warning: 5000, critical: 15000 },
    [OperationType.AI_STREAMING]: { warning: 1000, critical: 3000 },
    [OperationType.AI_OFF_TOPIC_CHECK]: { warning: 1000, critical: 3000 },
    [OperationType.AI_FOLLOW_UP_GENERATION]: { warning: 2000, critical: 5000 },
    [OperationType.AI_SUMMARY_GENERATION]: { warning: 3000, critical: 8000 },
    [OperationType.CONTEXT_FORMATTING]: { warning: 500, critical: 1500 },
    [OperationType.CONTEXT_COMPRESSION]: { warning: 1000, critical: 3000 },
    [OperationType.CONTEXT_SUMMARIZATION]: { warning: 2000, critical: 5000 },
    [OperationType.RERANKING]: { warning: 1000, critical: 3000 },
    [OperationType.DEDUPLICATION]: { warning: 500, critical: 1500 },
    [OperationType.DIVERSITY_FILTERING]: { warning: 500, critical: 1500 },
    [OperationType.CACHE_LOOKUP]: { warning: 100, critical: 500 },
    [OperationType.CACHE_STORE]: { warning: 200, critical: 1000 },
    [OperationType.DATABASE_QUERY]: { warning: 500, critical: 2000 },
    [OperationType.EXTERNAL_API_CALL]: { warning: 3000, critical: 10000 },
  };

  /**
   * Track operation latency
   */
  static async trackOperation<T>(
    operationType: OperationType,
    fn: () => Promise<T>,
    options?: {
      userId?: string;
      queryId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const result = await fn();
      success = true;
      return result;
    } catch (err: any) {
      error = err.message || 'Unknown error';
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      const timestamp = Date.now();

      const metric: LatencyMetric = {
        operationType,
        userId: options?.userId,
        queryId: options?.queryId,
        duration,
        timestamp,
        success,
        error,
        metadata: options?.metadata,
      };

      // Store metric (async, don't block)
      this.storeLatencyMetric(metric).catch((storeError: any) => {
        logger.warn('Failed to store latency metric', {
          error: storeError.message,
          operationType,
        });
      });

      // Check for alerts
      this.checkAlerts(metric).catch((alertError: any) => {
        logger.warn('Failed to check latency alerts', {
          error: alertError.message,
          operationType,
        });
      });

      // Log slow operations
      if (duration > 1000) {
        logger.warn('Slow operation detected', {
          operationType,
          duration,
          userId: options?.userId,
          metadata: options?.metadata,
        });
      }
    }
  }

  /**
   * Store latency metric in database
   */
  private static async storeLatencyMetric(metric: LatencyMetric): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('latency_metrics')
        .insert({
          operation_type: metric.operationType,
          user_id: metric.userId,
          query_id: metric.queryId,
          duration: metric.duration,
          timestamp: new Date(metric.timestamp).toISOString(),
          success: metric.success,
          error: metric.error,
          metadata: metric.metadata,
        });

      if (error) {
        logger.error('Failed to store latency metric', {
          error: error.message,
          operationType: metric.operationType,
        });
      }
    } catch (error: any) {
      logger.error('Error storing latency metric', {
        error: error.message,
        operationType: metric.operationType,
      });
    }
  }

  /**
   * Check for latency alerts
   */
  private static async checkAlerts(metric: LatencyMetric): Promise<void> {
    const thresholds = this.ALERT_THRESHOLDS[metric.operationType];
    if (!thresholds) {
      return;
    }

    let alertLevel: 'warning' | 'critical' | null = null;
    let message = '';

    if (metric.duration >= thresholds.critical) {
      alertLevel = 'critical';
      message = `Critical latency alert: ${metric.operationType} took ${metric.duration}ms (threshold: ${thresholds.critical}ms)`;
    } else if (metric.duration >= thresholds.warning) {
      alertLevel = 'warning';
      message = `Warning latency alert: ${metric.operationType} took ${metric.duration}ms (threshold: ${thresholds.warning}ms)`;
    }

    if (alertLevel) {
      logger.error(message, {
        operationType: metric.operationType,
        duration: metric.duration,
        threshold: alertLevel === 'critical' ? thresholds.critical : thresholds.warning,
        userId: metric.userId,
        metadata: metric.metadata,
      });

      // Store alert in database
      await this.storeAlert({
        operationType: metric.operationType,
        threshold: alertLevel === 'critical' ? thresholds.critical : thresholds.warning,
        currentLatency: metric.duration,
        alertLevel,
        message,
        timestamp: metric.timestamp,
      });
    }
  }

  /**
   * Store alert in database
   */
  private static async storeAlert(alert: LatencyAlert): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('latency_alerts')
        .insert({
          operation_type: alert.operationType,
          threshold: alert.threshold,
          current_latency: alert.currentLatency,
          alert_level: alert.alertLevel,
          message: alert.message,
          timestamp: new Date(alert.timestamp).toISOString(),
        });

      if (error) {
        logger.error('Failed to store latency alert', {
          error: error.message,
        });
      }
    } catch (error: any) {
      logger.error('Error storing latency alert', {
        error: error.message,
      });
    }
  }

  /**
   * Get latency statistics
   */
  static async getLatencyStats(query: LatencyQuery): Promise<LatencyStats[]> {
    try {
      let dbQuery = supabaseAdmin
        .from('latency_metrics')
        .select('*')
        .order('timestamp', { ascending: false });

      if (query.operationType) {
        dbQuery = dbQuery.eq('operation_type', query.operationType);
      }

      if (query.userId) {
        dbQuery = dbQuery.eq('user_id', query.userId);
      }

      if (query.startDate) {
        dbQuery = dbQuery.gte('timestamp', query.startDate);
      }

      if (query.endDate) {
        dbQuery = dbQuery.lte('timestamp', query.endDate);
      }

      if (query.minLatency !== undefined) {
        dbQuery = dbQuery.gte('duration', query.minLatency);
      }

      if (query.maxLatency !== undefined) {
        dbQuery = dbQuery.lte('duration', query.maxLatency);
      }

      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 1000) - 1);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to get latency metrics', {
          error: error.message,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by operation type and calculate statistics
      const grouped = new Map<OperationType, number[]>();
      const successCounts = new Map<OperationType, number>();
      const totalCounts = new Map<OperationType, number>();

      for (const row of data) {
        const opType = row.operation_type as OperationType;
        const duration = row.duration;
        const success = row.success;

        if (!grouped.has(opType)) {
          grouped.set(opType, []);
          successCounts.set(opType, 0);
          totalCounts.set(opType, 0);
        }

        grouped.get(opType)!.push(duration);
        totalCounts.set(opType, totalCounts.get(opType)! + 1);
        if (success) {
          successCounts.set(opType, successCounts.get(opType)! + 1);
        }
      }

      // Calculate statistics for each operation type
      const stats: LatencyStats[] = [];

      for (const [operationType, durations] of grouped.entries()) {
        const sorted = [...durations].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((s, d) => s + d, 0);
        const averageLatency = sum / count;
        const minLatency = sorted[0];
        const maxLatency = sorted[sorted.length - 1];
        const p50 = this.percentile(sorted, 50);
        const p95 = this.percentile(sorted, 95);
        const p99 = this.percentile(sorted, 99);
        const successCount = successCounts.get(operationType) || 0;
        const totalCount = totalCounts.get(operationType) || count;
        const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
        const errorRate = 100 - successRate;

        stats.push({
          operationType,
          count,
          averageLatency,
          minLatency,
          maxLatency,
          p50,
          p95,
          p99,
          successRate,
          errorRate,
        });
      }

      return stats.sort((a, b) => b.averageLatency - a.averageLatency);
    } catch (error: any) {
      logger.error('Error getting latency statistics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate percentile
   */
  private static percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Get latency trends over time
   */
  static async getLatencyTrends(
    operationType: OperationType,
    startDate: string,
    endDate: string,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{
    period: string;
    averageLatency: number;
    count: number;
    p95: number;
    p99: number;
  }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('latency_metrics')
        .select('duration, timestamp')
        .eq('operation_type', operationType)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by time interval
      const grouped = new Map<string, number[]>();

      for (const row of data) {
        const date = new Date(row.timestamp);
        let period: string;

        if (interval === 'hour') {
          period = date.toISOString().slice(0, 13) + ':00:00Z';
        } else if (interval === 'day') {
          period = date.toISOString().slice(0, 10);
        } else {
          // week
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().slice(0, 10);
        }

        if (!grouped.has(period)) {
          grouped.set(period, []);
        }
        grouped.get(period)!.push(row.duration);
      }

      // Calculate statistics for each period
      const trends: Array<{
        period: string;
        averageLatency: number;
        count: number;
        p95: number;
        p99: number;
      }> = [];

      for (const [period, durations] of grouped.entries()) {
        const sorted = [...durations].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((s, d) => s + d, 0);
        const averageLatency = sum / count;
        const p95 = this.percentile(sorted, 95);
        const p99 = this.percentile(sorted, 99);

        trends.push({
          period,
          averageLatency,
          count,
          p95,
          p99,
        });
      }

      return trends.sort((a, b) => a.period.localeCompare(b.period));
    } catch (error: any) {
      logger.error('Error getting latency trends', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get recent alerts
   */
  static async getRecentAlerts(limit: number = 50): Promise<LatencyAlert[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('latency_alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!data) {
        return [];
      }

      return data.map((row: any) => ({
        operationType: row.operation_type as OperationType,
        threshold: row.threshold,
        currentLatency: row.current_latency,
        alertLevel: row.alert_level as 'warning' | 'critical',
        message: row.message,
        timestamp: new Date(row.timestamp).getTime(),
      }));
    } catch (error: any) {
      logger.error('Error getting recent alerts', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  static async getAlertStats(startDate?: string, endDate?: string): Promise<{
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    alertsByOperation: Record<OperationType, number>;
  }> {
    try {
      let dbQuery = supabaseAdmin
        .from('latency_alerts')
        .select('*');

      if (startDate) {
        dbQuery = dbQuery.gte('timestamp', startDate);
      }

      if (endDate) {
        dbQuery = dbQuery.lte('timestamp', endDate);
      }

      const { data, error } = await dbQuery;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          totalAlerts: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
          alertsByOperation: {} as Record<OperationType, number>,
        };
      }

      let criticalAlerts = 0;
      let warningAlerts = 0;
      const alertsByOperation: Record<OperationType, number> = {} as any;

      for (const row of data) {
        if (row.alert_level === 'critical') {
          criticalAlerts++;
        } else {
          warningAlerts++;
        }

        const opType = row.operation_type as OperationType;
        alertsByOperation[opType] = (alertsByOperation[opType] || 0) + 1;
      }

      return {
        totalAlerts: data.length,
        criticalAlerts,
        warningAlerts,
        alertsByOperation,
      };
    } catch (error: any) {
      logger.error('Error getting alert statistics', {
        error: error.message,
      });
      throw error;
    }
  }
}

export default LatencyTrackerService;
