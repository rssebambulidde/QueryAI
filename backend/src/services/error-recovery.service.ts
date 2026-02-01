/**
 * Error Recovery Service
 * Implements recovery strategies for different error types
 */

import logger from '../config/logger';
import { DegradationService, ServiceType, DegradationLevel } from './degradation.service';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

export enum ErrorCategory {
  NETWORK = 'network', // Network-related errors (timeout, connection refused, etc.)
  RATE_LIMIT = 'rate_limit', // Rate limiting errors (429)
  SERVER_ERROR = 'server_error', // Server errors (500+)
  AUTHENTICATION = 'authentication', // Authentication/authorization errors (401, 403)
  VALIDATION = 'validation', // Validation errors (400)
  NOT_FOUND = 'not_found', // Resource not found (404)
  TIMEOUT = 'timeout', // Request timeout
  UNKNOWN = 'unknown', // Unknown error type
}

export enum RecoveryStrategy {
  RETRY = 'retry', // Retry the same operation
  FALLBACK = 'fallback', // Use fallback mechanism
  CIRCUIT_BREAK = 'circuit_break', // Open circuit breaker
  DEGRADE = 'degrade', // Degrade service level
  SKIP = 'skip', // Skip the operation
  WAIT = 'wait', // Wait and retry
}

export interface RecoveryAttempt {
  timestamp: number;
  errorCategory: ErrorCategory;
  errorMessage: string;
  strategy: RecoveryStrategy;
  success: boolean;
  duration: number;
  metadata?: Record<string, any>;
}

export interface RecoveryConfig {
  maxAttempts?: number;
  retryDelay?: number;
  enableFallback?: boolean;
  enableCircuitBreak?: boolean;
  enableDegradation?: boolean;
  timeout?: number;
}

export interface RecoveryResult<T> {
  result: T | null;
  recovered: boolean;
  strategy: RecoveryStrategy;
  attempts: number;
  duration: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface RecoveryStats {
  totalAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoveriesByCategory: Record<ErrorCategory, number>;
  recoveriesByStrategy: Record<RecoveryStrategy, number>;
  averageRecoveryTime: number;
  successRate: number;
}

/**
 * Error Recovery Service
 * Manages error recovery strategies and attempts
 */
export class ErrorRecoveryService {
  private static recoveryHistory: RecoveryAttempt[] = [];
  private static readonly MAX_HISTORY = 10000;
  private static stats: RecoveryStats = {
    totalAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    recoveriesByCategory: {} as Record<ErrorCategory, number>,
    recoveriesByStrategy: {} as Record<RecoveryStrategy, number>,
    averageRecoveryTime: 0,
    successRate: 0,
  };

  /**
   * Categorize error
   */
  static categorizeError(error: any): ErrorCategory {
    // Network errors
    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'EAI_AGAIN' ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('connection')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Rate limit errors
    if (
      error.status === 429 ||
      error.code === 'rate_limit_exceeded' ||
      error.type === 'rate_limit_error' ||
      error.message?.toLowerCase().includes('rate limit')
    ) {
      return ErrorCategory.RATE_LIMIT;
    }

    // Server errors
    if (error.status >= 500 && error.status < 600) {
      return ErrorCategory.SERVER_ERROR;
    }

    // Authentication errors
    if (error.status === 401 || error.status === 403) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Validation errors
    if (error.status === 400) {
      return ErrorCategory.VALIDATION;
    }

    // Not found errors
    if (error.status === 404) {
      return ErrorCategory.NOT_FOUND;
    }

    // Timeout errors
    if (error.message?.toLowerCase().includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine recovery strategy for error
   */
  static determineRecoveryStrategy(
    error: any,
    service: ServiceType,
    config?: RecoveryConfig
  ): RecoveryStrategy {
    const category = this.categorizeError(error);
    const enableFallback = config?.enableFallback ?? true;
    const enableCircuitBreak = config?.enableCircuitBreak ?? true;
    const enableDegradation = config?.enableDegradation ?? true;

    // Rate limit: wait and retry
    if (category === ErrorCategory.RATE_LIMIT) {
      return RecoveryStrategy.WAIT;
    }

    // Network errors: retry with backoff
    if (category === ErrorCategory.NETWORK || category === ErrorCategory.TIMEOUT) {
      return RecoveryStrategy.RETRY;
    }

    // Server errors: check circuit breaker and degrade
    if (category === ErrorCategory.SERVER_ERROR) {
      if (enableCircuitBreak) {
        const circuitState = DegradationService.checkCircuitBreakerStatus(service);
        if (circuitState === CircuitState.OPEN) {
          return RecoveryStrategy.CIRCUIT_BREAK;
        }
      }
      if (enableDegradation) {
        return RecoveryStrategy.DEGRADE;
      }
      return RecoveryStrategy.RETRY;
    }

    // Authentication errors: skip (cannot recover)
    if (category === ErrorCategory.AUTHENTICATION) {
      return RecoveryStrategy.SKIP;
    }

    // Validation errors: skip (cannot recover)
    if (category === ErrorCategory.VALIDATION) {
      return RecoveryStrategy.SKIP;
    }

    // Not found errors: skip (cannot recover)
    if (category === ErrorCategory.NOT_FOUND) {
      return RecoveryStrategy.SKIP;
    }

    // Unknown errors: try fallback if available
    if (enableFallback) {
      return RecoveryStrategy.FALLBACK;
    }

    return RecoveryStrategy.RETRY;
  }

  /**
   * Attempt recovery with strategy
   */
  static async attemptRecovery<T>(
    service: ServiceType,
    error: any,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
    config?: RecoveryConfig
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now();
    const category = this.categorizeError(error);
    const strategy = this.determineRecoveryStrategy(error, service, config);
    const maxAttempts = config?.maxAttempts || 3;
    const retryDelay = config?.retryDelay || 1000;

    this.stats.totalAttempts++;
    this.stats.recoveriesByCategory[category] = (this.stats.recoveriesByCategory[category] || 0) + 1;
    this.stats.recoveriesByStrategy[strategy] = (this.stats.recoveriesByStrategy[strategy] || 0) + 1;

    logger.info('Attempting error recovery', {
      service,
      category,
      strategy,
      errorMessage: error.message,
      maxAttempts,
    });

    try {
      let result: T | null = null;
      let attempts = 0;

      switch (strategy) {
        case RecoveryStrategy.RETRY:
          result = await this.retryOperation(primaryFn, maxAttempts, retryDelay);
          attempts = maxAttempts;
          break;

        case RecoveryStrategy.WAIT:
          result = await this.waitAndRetry(primaryFn, retryDelay * 2);
          attempts = 1;
          break;

        case RecoveryStrategy.FALLBACK:
          if (fallbackFn) {
            result = await fallbackFn();
            attempts = 1;
          } else {
            throw new Error('Fallback function not provided');
          }
          break;

        case RecoveryStrategy.DEGRADE:
          DegradationService.handleServiceError(service, error);
          if (fallbackFn) {
            result = await fallbackFn();
            attempts = 1;
          } else {
            throw new Error('Degradation requires fallback function');
          }
          break;

        case RecoveryStrategy.CIRCUIT_BREAK:
          // Circuit breaker should already be open, just skip
          throw new Error('Circuit breaker is open, cannot recover');

        case RecoveryStrategy.SKIP:
          throw new Error('Error cannot be recovered (skip strategy)');

        default:
          throw new Error(`Unknown recovery strategy: ${strategy}`);
      }

      const duration = Date.now() - startTime;
      this.recordRecoveryAttempt(category, error.message, strategy, true, duration);
      this.stats.successfulRecoveries++;
      this.updateStats();

      logger.info('Error recovery successful', {
        service,
        category,
        strategy,
        attempts,
        duration,
      });

      return {
        result,
        recovered: true,
        strategy,
        attempts,
        duration,
        metadata: {
          category,
          service,
        },
      };
    } catch (recoveryError: any) {
      const duration = Date.now() - startTime;
      this.recordRecoveryAttempt(category, error.message, strategy, false, duration, {
        recoveryError: recoveryError.message,
      });
      this.stats.failedRecoveries++;
      this.updateStats();

      logger.error('Error recovery failed', {
        service,
        category,
        strategy,
        error: recoveryError.message,
        duration,
      });

      return {
        result: null,
        recovered: false,
        strategy,
        attempts: 0,
        duration,
        error: recoveryError,
        metadata: {
          category,
          service,
          originalError: error.message,
        },
      };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private static async retryOperation<T>(
    fn: () => Promise<T>,
    maxAttempts: number,
    initialDelay: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          logger.debug('Retrying operation', {
            attempt,
            maxAttempts,
            delay,
            error: error.message,
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Wait and retry operation
   */
  private static async waitAndRetry<T>(
    fn: () => Promise<T>,
    delay: number
  ): Promise<T> {
    logger.debug('Waiting before retry', { delay });
    await this.sleep(delay);
    return await fn();
  }

  /**
   * Record recovery attempt
   */
  private static recordRecoveryAttempt(
    category: ErrorCategory,
    errorMessage: string,
    strategy: RecoveryStrategy,
    success: boolean,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const attempt: RecoveryAttempt = {
      timestamp: Date.now(),
      errorCategory: category,
      errorMessage,
      strategy,
      success,
      duration,
      metadata,
    };

    this.recoveryHistory.push(attempt);

    // Keep history size manageable
    if (this.recoveryHistory.length > this.MAX_HISTORY) {
      this.recoveryHistory = this.recoveryHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Update statistics
   */
  private static updateStats(): void {
    const totalRecoveries = this.stats.successfulRecoveries + this.stats.failedRecoveries;
    this.stats.successRate = totalRecoveries > 0
      ? (this.stats.successfulRecoveries / totalRecoveries) * 100
      : 0;

    // Calculate average recovery time from recent successful recoveries
    const recentSuccessful = this.recoveryHistory
      .filter(a => a.success)
      .slice(-100); // Last 100 successful recoveries

    if (recentSuccessful.length > 0) {
      const totalDuration = recentSuccessful.reduce((sum, a) => sum + a.duration, 0);
      this.stats.averageRecoveryTime = totalDuration / recentSuccessful.length;
    }
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  static getStats(): RecoveryStats {
    return { ...this.stats };
  }

  /**
   * Get recovery history
   */
  static getHistory(limit?: number): RecoveryAttempt[] {
    if (limit) {
      return this.recoveryHistory.slice(-limit);
    }
    return [...this.recoveryHistory];
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      recoveriesByCategory: {} as Record<ErrorCategory, number>,
      recoveriesByStrategy: {} as Record<RecoveryStrategy, number>,
      averageRecoveryTime: 0,
      successRate: 0,
    };
    this.recoveryHistory = [];
    logger.info('Recovery statistics reset');
  }

  /**
   * Get recovery attempts by service
   */
  static getAttemptsByService(service: ServiceType): RecoveryAttempt[] {
    return this.recoveryHistory.filter(
      attempt => attempt.metadata?.service === service
    );
  }

  /**
   * Get recovery attempts by category
   */
  static getAttemptsByCategory(category: ErrorCategory): RecoveryAttempt[] {
    return this.recoveryHistory.filter(
      attempt => attempt.errorCategory === category
    );
  }

  /**
   * Get recovery attempts by strategy
   */
  static getAttemptsByStrategy(strategy: RecoveryStrategy): RecoveryAttempt[] {
    return this.recoveryHistory.filter(
      attempt => attempt.strategy === strategy
    );
  }
}

export default ErrorRecoveryService;
