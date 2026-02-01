/**
 * OpenAI Connection Pool Configuration
 * Manages OpenAI client connections with pooling and monitoring
 */

import OpenAI from 'openai';
import config from './env';
import logger from './logger';

export interface OpenAIPoolConfig {
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface OpenAIStats {
  totalRequests: number;
  activeRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageResponseTime: number;
  averageTokensUsed: number;
  lastRequestTime?: number;
  requestsByModel: Record<string, number>;
}

/**
 * OpenAI Connection Pool Manager
 * Manages OpenAI client connections with request queuing and monitoring
 */
export class OpenAIPool {
  private static client: OpenAI | null = null;
  private static poolConfig: OpenAIPoolConfig;
  private static stats: OpenAIStats = {
    totalRequests: 0,
    activeRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    averageResponseTime: 0,
    averageTokensUsed: 0,
    requestsByModel: {},
  };
  private static responseTimes: number[] = [];
  private static tokenCounts: number[] = [];
  private static requestQueue: Array<() => Promise<any>> = [];
  private static processingQueue = false;
  private static readonly MAX_RESPONSE_TIME_SAMPLES = 1000;
  private static readonly MAX_CONCURRENT_DEFAULT = 10;

  /**
   * Initialize OpenAI connection pool
   */
  static initialize(poolConfig?: OpenAIPoolConfig): void {
    this.poolConfig = {
      maxConcurrentRequests: poolConfig?.maxConcurrentRequests || this.MAX_CONCURRENT_DEFAULT,
      requestTimeout: poolConfig?.requestTimeout || 60000, // 60 seconds
      maxRetries: poolConfig?.maxRetries || 3,
      retryDelay: poolConfig?.retryDelay || 1000,
      timeout: poolConfig?.timeout || 60000,
    };

    if (!config.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY is not set. OpenAI features will not work.');
      return;
    }

    // Create OpenAI client (singleton)
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
        timeout: this.poolConfig.timeout,
        maxRetries: this.poolConfig.maxRetries,
      });

      logger.info('OpenAI client initialized', {
        poolConfig: this.poolConfig,
      });
    }
  }

  /**
   * Get OpenAI client
   */
  static getClient(): OpenAI {
    if (!this.client) {
      this.initialize();
    }
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Set OPENAI_API_KEY environment variable.');
    }
    return this.client;
  }

  /**
   * Execute request with monitoring and queuing
   */
  static async executeRequest<T>(
    requestFn: (client: OpenAI) => Promise<T>,
    model?: string
  ): Promise<T> {
    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.activeRequests++;

    // Track model usage
    if (model) {
      this.stats.requestsByModel[model] = (this.stats.requestsByModel[model] || 0) + 1;
    }

    try {
      // Check if we need to queue the request
      if (this.stats.activeRequests > this.poolConfig.maxConcurrentRequests!) {
        // Queue the request
        return new Promise<T>((resolve, reject) => {
          this.requestQueue.push(async () => {
            try {
              const result = await this.executeRequestDirect(requestFn, model);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          });

          // Process queue if not already processing
          if (!this.processingQueue) {
            this.processQueue();
          }
        });
      }

      return await this.executeRequestDirect(requestFn, model);
    } finally {
      this.stats.activeRequests = Math.max(0, this.stats.activeRequests - 1);
      this.stats.lastRequestTime = Date.now();
    }
  }

  /**
   * Execute request directly (internal)
   */
  private static async executeRequestDirect<T>(
    requestFn: (client: OpenAI) => Promise<T>,
    model?: string
  ): Promise<T> {
    const startTime = Date.now();
    const client = this.getClient();

    try {
      const result = await requestFn(client);
      const responseTime = Date.now() - startTime;

      this.stats.successfulRequests++;

      // Track response time
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
        this.responseTimes.shift();
      }

      // Update average response time
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.stats.averageResponseTime = sum / this.responseTimes.length;

      // Extract token usage if available
      if (result && typeof result === 'object' && 'usage' in result) {
        const usage = (result as any).usage;
        if (usage && usage.total_tokens) {
          this.tokenCounts.push(usage.total_tokens);
          if (this.tokenCounts.length > this.MAX_RESPONSE_TIME_SAMPLES) {
            this.tokenCounts.shift();
          }
          const tokenSum = this.tokenCounts.reduce((a, b) => a + b, 0);
          this.stats.averageTokensUsed = tokenSum / this.tokenCounts.length;
        }
      }

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.stats.failedRequests++;

      // Track rate limiting
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        this.stats.rateLimitedRequests++;
        logger.warn('OpenAI rate limit exceeded', {
          model,
          responseTime,
          retryAfter: error.headers?.['retry-after'],
        });
      } else {
        logger.error('OpenAI request error', {
          error: error.message,
          model,
          responseTime,
          code: error.code,
        });
      }

      // Track response time even for errors
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
        this.responseTimes.shift();
      }

      throw error;
    }
  }

  /**
   * Process request queue
   */
  private static async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0 && this.stats.activeRequests < this.poolConfig.maxConcurrentRequests!) {
      const request = this.requestQueue.shift();
      if (request) {
        // Execute request asynchronously
        request().catch((error) => {
          logger.error('Queued request failed', { error: error.message });
        });
      }
    }

    this.processingQueue = false;
  }

  /**
   * Get connection statistics
   */
  static getStats(): OpenAIStats {
    return {
      ...this.stats,
      averageResponseTime: this.stats.averageResponseTime,
      averageTokensUsed: this.stats.averageTokensUsed,
    };
  }

  /**
   * Get pool configuration
   */
  static getPoolConfig(): OpenAIPoolConfig {
    return { ...this.poolConfig };
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats = {
      totalRequests: 0,
      activeRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      averageResponseTime: 0,
      averageTokensUsed: 0,
      requestsByModel: {},
    };
    this.responseTimes = [];
    this.tokenCounts = [];
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    stats: OpenAIStats;
  }> {
    try {
      if (!config.OPENAI_API_KEY) {
        return {
          healthy: false,
          message: 'OpenAI API key not configured',
          stats: this.getStats(),
        };
      }

      const client = this.getClient();
      const startTime = Date.now();

      const response = await client.models.list();
      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        message: `OpenAI healthy (${response.data.length} models available, response time: ${responseTime}ms)`,
        stats: this.getStats(),
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: `OpenAI health check failed: ${error.message}`,
        stats: this.getStats(),
      };
    }
  }

  /**
   * Get queue status
   */
  static getQueueStatus(): {
    queueLength: number;
    activeRequests: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.stats.activeRequests,
      maxConcurrent: this.poolConfig.maxConcurrentRequests || this.MAX_CONCURRENT_DEFAULT,
    };
  }

  /**
   * Close connections
   */
  static async close(): Promise<void> {
    // OpenAI client doesn't need explicit closing, but we can reset stats
    this.resetStats();
    this.requestQueue = [];
    logger.info('OpenAI connection pool closed');
  }
}

// Initialize pool on module load
OpenAIPool.initialize();

// Export singleton client for backward compatibility
export const openai = OpenAIPool.getClient();

// Export pool manager
export default OpenAIPool;
