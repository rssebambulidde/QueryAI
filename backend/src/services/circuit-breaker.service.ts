/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern to prevent cascading failures
 */

import logger from '../config/logger';

export enum CircuitState {
  CLOSED = 'closed', // Normal operation, requests pass through
  OPEN = 'open', // Circuit is open, requests fail immediately
  HALF_OPEN = 'half-open', // Testing if service recovered, limited requests allowed
}

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Number of failures before opening circuit (default: 5)
  resetTimeout?: number; // Time in ms before attempting to close circuit (default: 60000)
  monitoringWindow?: number; // Time window in ms for failure tracking (default: 60000)
  halfOpenMaxCalls?: number; // Max calls allowed in half-open state (default: 3)
  timeout?: number; // Request timeout in ms (default: 30000)
  errorFilter?: (error: any) => boolean; // Filter which errors count as failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  openedAt?: number;
  halfOpenedAt?: number;
  failureRate: number;
  successRate: number;
}

export interface CircuitBreakerResult<T> {
  result: T;
  fromCache: boolean;
  circuitState: CircuitState;
}

/**
 * Circuit Breaker
 * Prevents cascading failures by opening circuit after threshold failures
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private openedAt?: number;
  private halfOpenedAt?: number;
  private halfOpenCalls: number = 0;
  private failureTimestamps: number[] = [];
  private config: Required<CircuitBreakerConfig>;

  constructor(
    private name: string,
    config?: CircuitBreakerConfig
  ) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      resetTimeout: config?.resetTimeout || 60000, // 60 seconds
      monitoringWindow: config?.monitoringWindow || 60000, // 60 seconds
      halfOpenMaxCalls: config?.halfOpenMaxCalls || 3,
      timeout: config?.timeout || 30000, // 30 seconds
      errorFilter: config?.errorFilter || (() => true), // Count all errors as failures
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    this.totalCalls++;

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (this.openedAt && Date.now() - this.openedAt >= this.config.resetTimeout) {
        this.transitionToHalfOpen();
      } else {
        // Circuit is open, fail immediately
        logger.warn('Circuit breaker is OPEN, request rejected', {
          circuit: this.name,
          failures: this.failures,
          openedAt: this.openedAt,
        });
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Service unavailable.`);
      }
    }

    // Half-open state: limit concurrent calls
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        logger.warn('Circuit breaker HALF-OPEN limit reached, request rejected', {
          circuit: this.name,
          halfOpenCalls: this.halfOpenCalls,
        });
        throw new Error(`Circuit breaker HALF-OPEN limit reached for ${this.name}.`);
      }
      this.halfOpenCalls++;
    }

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Circuit breaker timeout for ${this.name}`));
        }, this.config.timeout);
      });

      // Race between function and timeout
      const result = await Promise.race([fn(), timeoutPromise]);

      // Clear timeout if function completed
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Success
      this.recordSuccess();
      return {
        result,
        fromCache: false,
        circuitState: this.state,
      };
    } catch (error: any) {
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Check if error should count as failure
      if (this.config.errorFilter(error)) {
        this.recordFailure();
      } else {
        // Error doesn't count as failure, but still throw
        logger.debug('Error filtered out from circuit breaker', {
          circuit: this.name,
          error: error.message,
        });
        throw error;
      }

      throw error;
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.halfOpenCalls = 0;

    // If in half-open state and we got a success, close the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      logger.info('Circuit breaker closing after successful call', {
        circuit: this.name,
        failures: this.failures,
      });
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      this.failureTimestamps = [];
      this.halfOpenedAt = undefined;
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(): void {
    const now = Date.now();
    this.failures++;
    this.lastFailureTime = now;

    // Add failure timestamp
    this.failureTimestamps.push(now);

    // Remove old failures outside monitoring window
    const cutoff = now - this.config.monitoringWindow;
    this.failureTimestamps = this.failureTimestamps.filter(timestamp => timestamp > cutoff);
    this.failures = this.failureTimestamps.length;

    // Check if we should open the circuit
    if (this.failures >= this.config.failureThreshold) {
      if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.openedAt = Date.now();
    this.halfOpenCalls = 0;
    this.halfOpenedAt = undefined;

    logger.error('Circuit breaker opened', {
      circuit: this.name,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      resetTimeout: this.config.resetTimeout,
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenedAt = Date.now();
    this.halfOpenCalls = 0;

    logger.info('Circuit breaker transitioning to HALF-OPEN', {
      circuit: this.name,
      failures: this.failures,
      resetTimeout: this.config.resetTimeout,
    });
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const failureRate = this.totalCalls > 0 ? (this.failures / this.totalCalls) * 100 : 0;
    const successRate = this.totalCalls > 0 ? (this.successes / this.totalCalls) * 100 : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      halfOpenedAt: this.halfOpenedAt,
      failureRate,
      successRate,
    };
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.failureTimestamps = [];
    this.openedAt = undefined;
    this.halfOpenedAt = undefined;
    this.halfOpenCalls = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;

    logger.info('Circuit breaker manually reset', {
      circuit: this.name,
    });
  }

  /**
   * Manually open circuit breaker
   */
  open(): void {
    this.transitionToOpen();
  }

  /**
   * Manually close circuit breaker
   */
  close(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.failureTimestamps = [];
    this.openedAt = undefined;
    this.halfOpenedAt = undefined;
    this.halfOpenCalls = 0;

    logger.info('Circuit breaker manually closed', {
      circuit: this.name,
    });
  }
}

/**
 * Circuit Breaker Service
 * Manages circuit breakers for different services
 */
export class CircuitBreakerService {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker
   */
  static getBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
      logger.info('Circuit breaker created', {
        circuit: name,
        config: {
          failureThreshold: config?.failureThreshold || 5,
          resetTimeout: config?.resetTimeout || 60000,
        },
      });
    }
    return this.breakers.get(name)!;
  }

  /**
   * Execute function with circuit breaker
   */
  static async execute<T>(
    circuitName: string,
    fn: () => Promise<T>,
    config?: CircuitBreakerConfig
  ): Promise<CircuitBreakerResult<T>> {
    const breaker = this.getBreaker(circuitName, config);
    return breaker.execute(fn);
  }

  /**
   * Get circuit breaker statistics
   */
  static getStats(circuitName?: string): CircuitBreakerStats | Record<string, CircuitBreakerStats> {
    if (circuitName) {
      const breaker = this.breakers.get(circuitName);
      if (!breaker) {
        throw new Error(`Circuit breaker not found: ${circuitName}`);
      }
      return breaker.getStats();
    }

    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Get all circuit breaker names
   */
  static getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Reset circuit breaker
   */
  static reset(circuitName: string): void {
    const breaker = this.breakers.get(circuitName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found: ${circuitName}`);
    }
    breaker.reset();
  }

  /**
   * Manually open circuit breaker
   */
  static open(circuitName: string): void {
    const breaker = this.breakers.get(circuitName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found: ${circuitName}`);
    }
    breaker.open();
  }

  /**
   * Manually close circuit breaker
   */
  static close(circuitName: string): void {
    const breaker = this.breakers.get(circuitName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found: ${circuitName}`);
    }
    breaker.close();
  }

  /**
   * Get circuit breaker state
   */
  static getState(circuitName: string): CircuitState | null {
    const breaker = this.breakers.get(circuitName);
    return breaker ? breaker.getState() : null;
  }

  /**
   * Health check for all circuit breakers
   */
  static healthCheck(): {
    healthy: boolean;
    circuits: Record<string, { state: CircuitState; healthy: boolean }>;
  } {
    const circuits: Record<string, { state: CircuitState; healthy: boolean }> = {};
    let allHealthy = true;

    for (const [name, breaker] of this.breakers.entries()) {
      const state = breaker.getState();
      const healthy = state === CircuitState.CLOSED || state === CircuitState.HALF_OPEN;
      circuits[name] = { state, healthy };
      if (!healthy) {
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      circuits,
    };
  }
}

export default CircuitBreakerService;
