/**
 * Graceful Degradation Service
 * Implements fallback mechanisms and partial result handling
 */

import logger from '../config/logger';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';

export enum DegradationLevel {
  NONE = 'none', // No degradation, all services operational
  PARTIAL = 'partial', // Some services degraded, partial functionality
  SEVERE = 'severe', // Most services degraded, limited functionality
  CRITICAL = 'critical', // Critical services down, minimal functionality
}

export enum ServiceType {
  EMBEDDING = 'embedding',
  SEARCH = 'search',
  PINECONE = 'pinecone',
  OPENAI = 'openai',
  TAVILY = 'tavily',
}

export interface DegradationStatus {
  level: DegradationLevel;
  affectedServices: ServiceType[];
  message: string;
  canProvidePartialResults: boolean;
  fallbackAvailable: boolean;
}

export interface FallbackResult<T> {
  result: T | null;
  degraded: boolean;
  degradationLevel: DegradationLevel;
  affectedServices: ServiceType[];
  message?: string;
  fromCache?: boolean;
  partial?: boolean;
}

/**
 * Graceful Degradation Service
 * Manages service degradation and fallback strategies
 */
export class DegradationService {
  private static degradationStatus: Map<ServiceType, DegradationLevel> = new Map();

  /**
   * Check if a service is degraded
   */
  static isServiceDegraded(service: ServiceType): boolean {
    const level = this.degradationStatus.get(service);
    return level !== undefined && level !== DegradationLevel.NONE;
  }

  /**
   * Get degradation level for a service
   */
  static getServiceDegradationLevel(service: ServiceType): DegradationLevel {
    return this.degradationStatus.get(service) || DegradationLevel.NONE;
  }

  /**
   * Update service degradation status
   */
  static updateServiceStatus(service: ServiceType, level: DegradationLevel): void {
    this.degradationStatus.set(service, level);
    logger.info('Service degradation status updated', {
      service,
      level,
    });
  }

  /**
   * Check circuit breaker status for a service
   */
  static checkCircuitBreakerStatus(service: ServiceType): CircuitState | null {
    const circuitMap: Record<ServiceType, string | null> = {
      [ServiceType.EMBEDDING]: 'openai-embeddings',
      [ServiceType.SEARCH]: 'tavily-search',
      [ServiceType.PINECONE]: 'pinecone-query',
      [ServiceType.OPENAI]: null, // OpenAI chat doesn't have a dedicated circuit breaker yet
      [ServiceType.TAVILY]: 'tavily-search',
    };

    const circuitName = circuitMap[service];
    if (!circuitName) {
      return null;
    }

    try {
      return CircuitBreakerService.getState(circuitName);
    } catch (error) {
      // Circuit breaker may not exist yet
      return null;
    }
  }

  /**
   * Get overall degradation status
   */
  static getOverallStatus(): DegradationStatus {
    const affectedServices: ServiceType[] = [];
    let maxLevel = DegradationLevel.NONE;

    // Check all services
    for (const service of Object.values(ServiceType)) {
      const level = this.getServiceDegradationLevel(service);
      const circuitState = this.checkCircuitBreakerStatus(service);

      // If circuit is open, service is severely degraded
      if (circuitState === CircuitState.OPEN) {
        if (level === DegradationLevel.NONE) {
          this.updateServiceStatus(service, DegradationLevel.SEVERE);
        }
        affectedServices.push(service);
        if (this.compareDegradationLevels(level, maxLevel) > 0) {
          maxLevel = level;
        }
      } else if (level !== DegradationLevel.NONE) {
        affectedServices.push(service);
        if (this.compareDegradationLevels(level, maxLevel) > 0) {
          maxLevel = level;
        }
      }
    }

    // Determine if partial results are possible
    const canProvidePartialResults = this.canProvidePartialResults(affectedServices);
    const fallbackAvailable = this.hasFallbackAvailable(affectedServices);

    // Generate message
    const message = this.generateDegradationMessage(maxLevel, affectedServices);

    return {
      level: maxLevel,
      affectedServices,
      message,
      canProvidePartialResults,
      fallbackAvailable,
    };
  }

  /**
   * Check if partial results can be provided
   */
  private static canProvidePartialResults(affectedServices: ServiceType[]): boolean {
    // If only one service is affected, we might still provide partial results
    if (affectedServices.length === 0) {
      return true;
    }

    // If embedding is down but search is up, we can use keyword search
    if (affectedServices.includes(ServiceType.EMBEDDING) && 
        !affectedServices.includes(ServiceType.SEARCH)) {
      return true;
    }

    // If Pinecone is down but we have cached results, we can use those
    if (affectedServices.includes(ServiceType.PINECONE)) {
      return true; // Cached results might be available
    }

    // If OpenAI is down but we have cached responses, we can use those
    if (affectedServices.includes(ServiceType.OPENAI)) {
      return true; // Cached responses might be available
    }

    return false;
  }

  /**
   * Check if fallback mechanisms are available
   */
  private static hasFallbackAvailable(affectedServices: ServiceType[]): boolean {
    // Embedding has keyword search fallback
    if (affectedServices.includes(ServiceType.EMBEDDING)) {
      return true;
    }

    // Search has cached results fallback
    if (affectedServices.includes(ServiceType.SEARCH)) {
      return true;
    }

    // OpenAI has cached responses fallback
    if (affectedServices.includes(ServiceType.OPENAI)) {
      return true;
    }

    return false;
  }

  /**
   * Generate degradation message
   */
  private static generateDegradationMessage(
    level: DegradationLevel,
    affectedServices: ServiceType[]
  ): string {
    if (level === DegradationLevel.NONE) {
      return 'All services operational';
    }

    const serviceNames = affectedServices.map(s => s.toUpperCase()).join(', ');
    
    switch (level) {
      case DegradationLevel.PARTIAL:
        return `Some services are experiencing issues (${serviceNames}). Partial functionality available.`;
      case DegradationLevel.SEVERE:
        return `Multiple services are unavailable (${serviceNames}). Limited functionality available.`;
      case DegradationLevel.CRITICAL:
        return `Critical services are unavailable (${serviceNames}). Minimal functionality available.`;
      default:
        return `Service degradation detected (${serviceNames}).`;
    }
  }

  /**
   * Compare degradation levels
   */
  private static compareDegradationLevels(
    a: DegradationLevel,
    b: DegradationLevel
  ): number {
    const order = {
      [DegradationLevel.NONE]: 0,
      [DegradationLevel.PARTIAL]: 1,
      [DegradationLevel.SEVERE]: 2,
      [DegradationLevel.CRITICAL]: 3,
    };
    return order[a] - order[b];
  }

  /**
   * Create fallback result
   */
  static createFallbackResult<T>(
    result: T | null,
    degraded: boolean,
    affectedServices: ServiceType[],
    message?: string,
    fromCache?: boolean,
    partial?: boolean
  ): FallbackResult<T> {
    const level = degraded
      ? this.getOverallStatus().level
      : DegradationLevel.NONE;

    return {
      result,
      degraded,
      degradationLevel: level,
      affectedServices,
      message,
      fromCache,
      partial,
    };
  }

  /**
   * Handle service error and determine degradation
   */
  static handleServiceError(
    service: ServiceType,
    error: any
  ): DegradationLevel {
    // Check if it's a circuit breaker error
    const circuitState = this.checkCircuitBreakerStatus(service);
    if (circuitState === CircuitState.OPEN) {
      this.updateServiceStatus(service, DegradationLevel.SEVERE);
      return DegradationLevel.SEVERE;
    }

    // Check error type
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      // Rate limit - partial degradation
      this.updateServiceStatus(service, DegradationLevel.PARTIAL);
      return DegradationLevel.PARTIAL;
    }

    if (error.status >= 500 || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      // Server error - severe degradation
      this.updateServiceStatus(service, DegradationLevel.SEVERE);
      return DegradationLevel.SEVERE;
    }

    // Other errors - might be temporary
    this.updateServiceStatus(service, DegradationLevel.PARTIAL);
    return DegradationLevel.PARTIAL;
  }

  /**
   * Reset service degradation status
   */
  static resetServiceStatus(service: ServiceType): void {
    this.degradationStatus.delete(service);
    logger.info('Service degradation status reset', {
      service,
    });
  }

  /**
   * Reset all service degradation statuses
   */
  static resetAllStatuses(): void {
    this.degradationStatus.clear();
    logger.info('All service degradation statuses reset');
  }

  /**
   * Get degradation statistics
   */
  static getStatistics(): {
    totalServices: number;
    degradedServices: number;
    services: Record<ServiceType, DegradationLevel>;
    overallStatus: DegradationStatus;
  } {
    const services: Record<ServiceType, DegradationLevel> = {} as any;
    let degradedCount = 0;

    for (const service of Object.values(ServiceType)) {
      const level = this.getServiceDegradationLevel(service);
      services[service] = level;
      if (level !== DegradationLevel.NONE) {
        degradedCount++;
      }
    }

    return {
      totalServices: Object.values(ServiceType).length,
      degradedServices: degradedCount,
      services,
      overallStatus: this.getOverallStatus(),
    };
  }
}

export default DegradationService;
