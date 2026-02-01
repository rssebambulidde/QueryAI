/**
 * Async Operation Monitor
 * Tracks and monitors async operations for performance optimization
 */

import logger from '../config/logger';

export interface AsyncOperationMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AsyncOperationStats {
  operation: string;
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  p50: number; // 50th percentile
  p95: number; // 95th percentile
  p99: number; // 99th percentile
}

/**
 * Async Operation Monitor
 * Tracks async operations for performance analysis
 */
export class AsyncMonitorService {
  private static metrics: AsyncOperationMetrics[] = [];
  private static readonly MAX_METRICS = 10000; // Keep last 10k metrics
  private static readonly PERCENTILE_SAMPLES = 1000; // Use last 1k for percentiles

  /**
   * Track an async operation
   */
  static async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
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
      this.recordMetric({
        operation,
        duration,
        timestamp: startTime,
        success,
        error,
        metadata,
      });

      // Log slow operations
      if (duration > 1000) {
        logger.warn('Slow async operation detected', {
          operation,
          duration,
          metadata,
        });
      }
    }
  }

  /**
   * Record a metric
   */
  private static recordMetric(metric: AsyncOperationMetrics): void {
    this.metrics.push(metric);

    // Keep only last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  /**
   * Get statistics for an operation
   */
  static getOperationStats(operation: string): AsyncOperationStats | null {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);

    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const successCount = operationMetrics.filter(m => m.success).length;
    const errorCount = operationMetrics.length - successCount;

    // Calculate percentiles
    const p50 = this.calculatePercentile(durations, 50);
    const p95 = this.calculatePercentile(durations, 95);
    const p99 = this.calculatePercentile(durations, 99);

    return {
      operation,
      totalCalls: operationMetrics.length,
      totalDuration,
      averageDuration: totalDuration / operationMetrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successCount,
      errorCount,
      successRate: (successCount / operationMetrics.length) * 100,
      p50,
      p95,
      p99,
    };
  }

  /**
   * Get all operation statistics
   */
  static getAllStats(): Record<string, AsyncOperationStats> {
    const operations = new Set(this.metrics.map(m => m.operation));
    const stats: Record<string, AsyncOperationStats> = {};

    for (const operation of operations) {
      const stat = this.getOperationStats(operation);
      if (stat) {
        stats[operation] = stat;
      }
    }

    return stats;
  }

  /**
   * Calculate percentile
   */
  private static calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get recent metrics
   */
  static getRecentMetrics(limit: number = 100): AsyncOperationMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Clear metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get slow operations (above threshold)
   */
  static getSlowOperations(thresholdMs: number = 1000): AsyncOperationMetrics[] {
    return this.metrics.filter(m => m.duration > thresholdMs);
  }

  /**
   * Get parallelization opportunities
   * Identifies operations that could benefit from parallelization
   */
  static getParallelizationOpportunities(): Array<{
    operation: string;
    averageDuration: number;
    totalCalls: number;
    estimatedSavings: number; // Estimated time saved with parallelization
  }> {
    const stats = this.getAllStats();
    const opportunities: Array<{
      operation: string;
      averageDuration: number;
      totalCalls: number;
      estimatedSavings: number;
    }> = [];

    for (const [operation, stat] of Object.entries(stats)) {
      // If operation is called multiple times and has significant duration
      if (stat.totalCalls > 1 && stat.averageDuration > 100) {
        // Estimate savings: if parallelized, would take max(durations) instead of sum
        const estimatedSavings = stat.totalDuration - stat.maxDuration;
        if (estimatedSavings > 100) {
          opportunities.push({
            operation,
            averageDuration: stat.averageDuration,
            totalCalls: stat.totalCalls,
            estimatedSavings,
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }
}

export default AsyncMonitorService;
