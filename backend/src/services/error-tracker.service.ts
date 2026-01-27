/**
 * Error Tracking Service
 * Tracks error rates and categorizes errors by type
 */

import logger from '../config/logger';
import { supabaseAdmin } from '../config/database';

export enum ServiceType {
  RAG = 'rag',
  AI = 'ai',
  EMBEDDING = 'embedding',
  SEARCH = 'search',
  PINECONE = 'pinecone',
  DATABASE = 'database',
  CACHE = 'cache',
  AUTH = 'auth',
  UNKNOWN = 'unknown',
}

export enum ErrorCategory {
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  SERVER_ERROR = 'server_error',
  TIMEOUT = 'timeout',
  CIRCUIT_BREAKER = 'circuit_breaker',
  DEGRADATION = 'degradation',
  UNKNOWN = 'unknown',
}

export interface ErrorMetric {
  serviceType: ServiceType;
  errorCategory: ErrorCategory;
  userId?: string;
  queryId?: string;
  errorMessage: string;
  errorCode?: string;
  statusCode?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ErrorStats {
  serviceType: ServiceType;
  errorCategory: ErrorCategory;
  count: number;
  errorRate: number; // Percentage
  lastOccurrence: number;
  firstOccurrence: number;
}

export interface ErrorQuery {
  serviceType?: ServiceType;
  errorCategory?: ErrorCategory;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ErrorRateAlert {
  serviceType: ServiceType;
  errorCategory: ErrorCategory;
  errorRate: number;
  threshold: number;
  alertLevel: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

/**
 * Error Tracker Service
 * Tracks and categorizes errors across all services
 */
export class ErrorTrackerService {
  private static readonly ERROR_RATE_THRESHOLDS: Record<ServiceType, { warning: number; critical: number }> = {
    [ServiceType.RAG]: { warning: 5.0, critical: 10.0 }, // 5% warning, 10% critical
    [ServiceType.AI]: { warning: 3.0, critical: 8.0 },
    [ServiceType.EMBEDDING]: { warning: 5.0, critical: 15.0 },
    [ServiceType.SEARCH]: { warning: 10.0, critical: 20.0 },
    [ServiceType.PINECONE]: { warning: 5.0, critical: 15.0 },
    [ServiceType.DATABASE]: { warning: 2.0, critical: 5.0 },
    [ServiceType.CACHE]: { warning: 10.0, critical: 25.0 },
    [ServiceType.AUTH]: { warning: 1.0, critical: 3.0 },
    [ServiceType.UNKNOWN]: { warning: 5.0, critical: 10.0 },
  };

  /**
   * Categorize an error
   */
  static categorizeError(error: any): ErrorCategory {
    if (!error) {
      return ErrorCategory.UNKNOWN;
    }

    // Network errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('network') ||
      error.message?.includes('connection')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Rate limit errors
    if (
      error.status === 429 ||
      error.code === 'rate_limit_exceeded' ||
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests')
    ) {
      return ErrorCategory.RATE_LIMIT;
    }

    // Authentication errors
    if (
      error.status === 401 ||
      error.status === 403 ||
      error.code === 'unauthorized' ||
      error.code === 'forbidden' ||
      error.message?.includes('authentication') ||
      error.message?.includes('unauthorized')
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Validation errors
    if (
      error.status === 400 ||
      error.name === 'ValidationError' ||
      error.message?.includes('validation') ||
      error.message?.includes('invalid')
    ) {
      return ErrorCategory.VALIDATION;
    }

    // Not found errors
    if (
      error.status === 404 ||
      error.code === 'not_found' ||
      error.message?.includes('not found')
    ) {
      return ErrorCategory.NOT_FOUND;
    }

    // Timeout errors
    if (
      error.code === 'ETIMEDOUT' ||
      error.name === 'TimeoutError' ||
      error.message?.includes('timeout')
    ) {
      return ErrorCategory.TIMEOUT;
    }

    // Circuit breaker errors
    if (
      error.message?.includes('circuit breaker') ||
      error.message?.includes('circuit is open')
    ) {
      return ErrorCategory.CIRCUIT_BREAKER;
    }

    // Degradation errors
    if (
      error.message?.includes('degraded') ||
      error.message?.includes('degradation')
    ) {
      return ErrorCategory.DEGRADATION;
    }

    // Server errors
    if (
      error.status >= 500 ||
      error.code === 'internal_error' ||
      error.message?.includes('server error')
    ) {
      return ErrorCategory.SERVER_ERROR;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Track an error
   */
  static async trackError(
    serviceType: ServiceType,
    error: any,
    options?: {
      userId?: string;
      queryId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const errorCategory = this.categorizeError(error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorCode = error?.code || error?.name;
      const statusCode = error?.status || error?.statusCode;

      const metric: ErrorMetric = {
        serviceType,
        errorCategory,
        userId: options?.userId,
        queryId: options?.queryId,
        errorMessage: errorMessage.substring(0, 1000), // Limit length
        errorCode,
        statusCode,
        timestamp: Date.now(),
        metadata: options?.metadata,
      };

      // Store error metric (async, don't block)
      this.storeErrorMetric(metric).catch((storeError: any) => {
        logger.warn('Failed to store error metric', {
          error: storeError.message,
          serviceType,
        });
      });

      // Check for error rate alerts
      this.checkErrorRateAlerts(serviceType, errorCategory).catch((alertError: any) => {
        logger.warn('Failed to check error rate alerts', {
          error: alertError.message,
          serviceType,
        });
      });

      // Log error
      logger.error('Error tracked', {
        serviceType,
        errorCategory,
        errorMessage: errorMessage.substring(0, 200),
        userId: options?.userId,
      });
    } catch (trackingError: any) {
      logger.error('Failed to track error', {
        error: trackingError.message,
        serviceType,
      });
    }
  }

  /**
   * Store error metric in database
   */
  private static async storeErrorMetric(metric: ErrorMetric): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('error_metrics')
        .insert({
          service_type: metric.serviceType,
          error_category: metric.errorCategory,
          user_id: metric.userId,
          query_id: metric.queryId,
          error_message: metric.errorMessage,
          error_code: metric.errorCode,
          status_code: metric.statusCode,
          timestamp: new Date(metric.timestamp).toISOString(),
          metadata: metric.metadata,
        });

      if (error) {
        logger.error('Failed to store error metric', {
          error: error.message,
          serviceType: metric.serviceType,
        });
      }
    } catch (error: any) {
      logger.error('Error storing error metric', {
        error: error.message,
        serviceType: metric.serviceType,
      });
    }
  }

  /**
   * Check for error rate alerts
   */
  private static async checkErrorRateAlerts(
    serviceType: ServiceType,
    errorCategory: ErrorCategory
  ): Promise<void> {
    try {
      // Calculate error rate for the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      // Get total requests and errors for this service in the last hour
      const { data: errorData, error: errorError } = await supabaseAdmin
        .from('error_metrics')
        .select('id')
        .eq('service_type', serviceType)
        .gte('timestamp', oneHourAgo)
        .lte('timestamp', now);

      if (errorError) {
        logger.error('Failed to get error count for alert check', {
          error: errorError.message,
        });
        return;
      }

      const errorCount = errorData?.length || 0;

      // Get total operations from latency metrics (approximation)
      const { data: latencyData, error: latencyError } = await supabaseAdmin
        .from('latency_metrics')
        .select('id')
        .eq('operation_type', this.getOperationTypeForService(serviceType))
        .gte('timestamp', oneHourAgo)
        .lte('timestamp', now);

      if (latencyError) {
        logger.warn('Failed to get latency metrics for error rate calculation', {
          error: latencyError.message,
        });
      }

      const totalOperations = (latencyData?.length || 0) + errorCount;
      const errorRate = totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0;

      const thresholds = this.ERROR_RATE_THRESHOLDS[serviceType];
      if (!thresholds) {
        return;
      }

      let alertLevel: 'warning' | 'critical' | null = null;
      let message = '';

      if (errorRate >= thresholds.critical) {
        alertLevel = 'critical';
        message = `Critical error rate alert: ${serviceType} has ${errorRate.toFixed(2)}% error rate (threshold: ${thresholds.critical}%)`;
      } else if (errorRate >= thresholds.warning) {
        alertLevel = 'warning';
        message = `Warning error rate alert: ${serviceType} has ${errorRate.toFixed(2)}% error rate (threshold: ${thresholds.warning}%)`;
      }

      if (alertLevel) {
        logger.error(message, {
          serviceType,
          errorCategory,
          errorRate,
          threshold: alertLevel === 'critical' ? thresholds.critical : thresholds.warning,
          errorCount,
          totalOperations,
        });

        // Store alert in database
        await this.storeErrorRateAlert({
          serviceType,
          errorCategory,
          errorRate,
          threshold: alertLevel === 'critical' ? thresholds.critical : thresholds.warning,
          alertLevel,
          message,
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      logger.error('Error checking error rate alerts', {
        error: error.message,
      });
    }
  }

  /**
   * Get operation type for service (for latency metrics lookup)
   */
  private static getOperationTypeForService(serviceType: ServiceType): string {
    const mapping: Record<ServiceType, string> = {
      [ServiceType.RAG]: 'rag_context_retrieval',
      [ServiceType.AI]: 'ai_question_answering',
      [ServiceType.EMBEDDING]: 'embedding_generation',
      [ServiceType.SEARCH]: 'web_search',
      [ServiceType.PINECONE]: 'pinecone_query',
      [ServiceType.DATABASE]: 'database_query',
      [ServiceType.CACHE]: 'cache_lookup',
      [ServiceType.AUTH]: 'external_api_call',
      [ServiceType.UNKNOWN]: 'external_api_call',
    };
    return mapping[serviceType] || 'external_api_call';
  }

  /**
   * Store error rate alert in database
   */
  private static async storeErrorRateAlert(alert: ErrorRateAlert): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('error_rate_alerts')
        .insert({
          service_type: alert.serviceType,
          error_category: alert.errorCategory,
          error_rate: alert.errorRate,
          threshold: alert.threshold,
          alert_level: alert.alertLevel,
          message: alert.message,
          timestamp: new Date(alert.timestamp).toISOString(),
        });

      if (error) {
        logger.error('Failed to store error rate alert', {
          error: error.message,
        });
      }
    } catch (error: any) {
      logger.error('Error storing error rate alert', {
        error: error.message,
      });
    }
  }

  /**
   * Get error statistics
   */
  static async getErrorStats(query: ErrorQuery): Promise<ErrorStats[]> {
    try {
      let dbQuery = supabaseAdmin
        .from('error_metrics')
        .select('*')
        .order('timestamp', { ascending: false });

      if (query.serviceType) {
        dbQuery = dbQuery.eq('service_type', query.serviceType);
      }

      if (query.errorCategory) {
        dbQuery = dbQuery.eq('error_category', query.errorCategory);
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

      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 1000) - 1);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to get error metrics', {
          error: error.message,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by service type and error category
      const grouped = new Map<string, any[]>();
      const timestamps = new Map<string, number[]>();

      for (const row of data) {
        const key = `${row.service_type}:${row.error_category}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
          timestamps.set(key, []);
        }
        grouped.get(key)!.push(row);
        timestamps.get(key)!.push(new Date(row.timestamp).getTime());
      }

      // Calculate statistics for each group
      const stats: ErrorStats[] = [];

      for (const [key, errors] of grouped.entries()) {
        const [serviceType, errorCategory] = key.split(':');
        const count = errors.length;
        const ts = timestamps.get(key)!;
        const lastOccurrence = Math.max(...ts);
        const firstOccurrence = Math.min(...ts);

        // Calculate error rate (approximate - would need total requests)
        // For now, use count as proxy
        const errorRate = count; // This would be calculated with total requests

        stats.push({
          serviceType: serviceType as ServiceType,
          errorCategory: errorCategory as ErrorCategory,
          count,
          errorRate,
          lastOccurrence,
          firstOccurrence,
        });
      }

      return stats.sort((a, b) => b.count - a.count);
    } catch (error: any) {
      logger.error('Error getting error statistics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get error trends over time
   */
  static async getErrorTrends(
    serviceType: ServiceType,
    errorCategory: ErrorCategory | null,
    startDate: string,
    endDate: string,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{
    period: string;
    errorCount: number;
    errorRate: number;
  }>> {
    try {
      let dbQuery = supabaseAdmin
        .from('error_metrics')
        .select('timestamp')
        .eq('service_type', serviceType)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: true });

      if (errorCategory) {
        dbQuery = dbQuery.eq('error_category', errorCategory);
      }

      const { data, error } = await dbQuery;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by time interval
      const grouped = new Map<string, number>();

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

        grouped.set(period, (grouped.get(period) || 0) + 1);
      }

      // Calculate error rates (approximate)
      const trends: Array<{
        period: string;
        errorCount: number;
        errorRate: number;
      }> = [];

      for (const [period, errorCount] of grouped.entries()) {
        // Error rate would need total requests - using count as proxy
        trends.push({
          period,
          errorCount,
          errorRate: errorCount, // Would be calculated with total requests
        });
      }

      return trends.sort((a, b) => a.period.localeCompare(b.period));
    } catch (error: any) {
      logger.error('Error getting error trends', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get recent error rate alerts
   */
  static async getRecentAlerts(limit: number = 50): Promise<ErrorRateAlert[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('error_rate_alerts')
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
        serviceType: row.service_type as ServiceType,
        errorCategory: row.error_category as ErrorCategory,
        errorRate: row.error_rate,
        threshold: row.threshold,
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
    alertsByService: Record<ServiceType, number>;
  }> {
    try {
      let dbQuery = supabaseAdmin
        .from('error_rate_alerts')
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
          alertsByService: {} as Record<ServiceType, number>,
        };
      }

      let criticalAlerts = 0;
      let warningAlerts = 0;
      const alertsByService: Record<ServiceType, number> = {} as any;

      for (const row of data) {
        if (row.alert_level === 'critical') {
          criticalAlerts++;
        } else {
          warningAlerts++;
        }

        const serviceType = row.service_type as ServiceType;
        alertsByService[serviceType] = (alertsByService[serviceType] || 0) + 1;
      }

      return {
        totalAlerts: data.length,
        criticalAlerts,
        warningAlerts,
        alertsByService,
      };
    } catch (error: any) {
      logger.error('Error getting alert statistics', {
        error: error.message,
      });
      throw error;
    }
  }
}

export default ErrorTrackerService;
