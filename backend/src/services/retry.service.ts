/**
 * Retry Service
 * Implements retry logic with exponential backoff for external API calls
 */

import logger from '../config/logger';

export interface RetryConfig {
  maxRetries?: number; // Maximum number of retry attempts (default: 3)
  initialDelay?: number; // Initial delay in milliseconds (default: 1000)
  maxDelay?: number; // Maximum delay in milliseconds (default: 30000)
  multiplier?: number; // Exponential backoff multiplier (default: 2)
  jitter?: boolean; // Add random jitter to prevent thundering herd (default: true)
  retryableErrors?: Array<number | string>; // HTTP status codes or error codes to retry
  onRetry?: (error: Error, attempt: number, delay: number) => void; // Callback on retry
}

export interface RetryStats {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  totalRetries: number;
  averageRetries: number;
  retriesByError: Record<string, number>;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTime: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: true,
  retryableErrors: [
    // HTTP status codes
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    // Error codes
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'EAI_AGAIN',
    // OpenAI specific
    'rate_limit_exceeded',
    'server_error',
    'timeout',
  ],
};

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, retryableErrors: Array<number | string>): boolean {
  // Check HTTP status code
  if (error.status && retryableErrors.includes(error.status)) {
    return true;
  }

  // Check error code
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }

  // Check error message for specific patterns
  const errorMessage = error.message?.toLowerCase() || '';
  for (const retryableError of retryableErrors) {
    if (typeof retryableError === 'string' && errorMessage.includes(retryableError.toLowerCase())) {
      return true;
    }
  }

  // Check OpenAI specific error types
  if (error.type === 'rate_limit_error' || error.type === 'server_error') {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  multiplier: number,
  maxDelay: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);

  // Apply max delay cap
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter (random value between 0 and 10% of delay) to prevent thundering herd
  if (jitter) {
    const jitterAmount = cappedDelay * 0.1 * Math.random();
    return Math.floor(cappedDelay + jitterAmount);
  }

  return Math.floor(cappedDelay);
}

/**
 * Retry Service
 * Provides retry logic with exponential backoff
 */
export class RetryService {
  private static stats: RetryStats = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    totalRetries: 0,
    averageRetries: 0,
    retriesByError: {},
  };

  /**
   * Execute function with retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    config?: RetryConfig
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const retryConfig: Required<Omit<RetryConfig, 'onRetry'>> & { onRetry?: RetryConfig['onRetry'] } = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
      attempts = attempt;

      try {
        const result = await fn();
        const totalTime = Date.now() - startTime;

        // Track successful retry if this wasn't the first attempt
        if (attempt > 1) {
          this.stats.successfulRetries++;
          this.stats.totalRetries += attempt - 1;
          logger.info('Retry successful', {
            attempts: attempt,
            totalTime,
            error: lastError?.message,
          });
        }

        this.stats.totalAttempts += attempt;
        this.updateAverageRetries();

        return {
          result,
          attempts,
          totalTime,
        };
      } catch (error: any) {
        lastError = error;

        // Don't retry on last attempt
        if (attempt > retryConfig.maxRetries) {
          this.stats.failedRetries++;
          this.stats.totalRetries += retryConfig.maxRetries;
          this.stats.totalAttempts += attempt;

          // Track error type
          const errorKey = error.status || error.code || error.type || 'unknown';
          this.stats.retriesByError[String(errorKey)] =
            (this.stats.retriesByError[String(errorKey)] || 0) + 1;

          logger.error('Retry exhausted', {
            attempts: attempt,
            maxRetries: retryConfig.maxRetries,
            error: error.message,
            status: error.status,
            code: error.code,
          });

          throw error;
        }

        // Check if error is retryable
        if (!isRetryableError(error, retryConfig.retryableErrors)) {
          this.stats.totalAttempts += attempt;
          logger.warn('Error not retryable', {
            error: error.message,
            status: error.status,
            code: error.code,
            attempt,
          });
          throw error;
        }

        // Calculate delay for next retry
        const delay = calculateDelay(
          attempt,
          retryConfig.initialDelay,
          retryConfig.multiplier,
          retryConfig.maxDelay,
          retryConfig.jitter
        );

        // Call onRetry callback if provided
        if (retryConfig.onRetry) {
          try {
            retryConfig.onRetry(error, attempt, delay);
          } catch (callbackError) {
            logger.warn('onRetry callback error', { error: callbackError });
          }
        }

        // Log retry attempt
        logger.warn('Retrying operation', {
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
          delay,
          error: error.message,
          status: error.status,
          code: error.code,
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update average retries
   */
  private static updateAverageRetries(): void {
    if (this.stats.totalAttempts > 0) {
      this.stats.averageRetries =
        this.stats.totalRetries / (this.stats.totalAttempts - this.stats.totalRetries);
    }
  }

  /**
   * Get retry statistics
   */
  static getStats(): RetryStats {
    return {
      ...this.stats,
      averageRetries: this.stats.averageRetries || 0,
    };
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalRetries: 0,
      averageRetries: 0,
      retriesByError: {},
    };
  }

  /**
   * Check if error is retryable (public utility)
   */
  static isRetryableError(error: any, retryableErrors?: Array<number | string>): boolean {
    const errors = retryableErrors || DEFAULT_CONFIG.retryableErrors;
    return isRetryableError(error, errors);
  }

  /**
   * Create retry configuration for specific use case
   */
  static createConfig(overrides?: RetryConfig): RetryConfig {
    return {
      ...DEFAULT_CONFIG,
      ...overrides,
    };
  }
}

export default RetryService;
