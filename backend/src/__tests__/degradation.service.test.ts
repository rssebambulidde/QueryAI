import {
  DegradationService,
  DegradationLevel,
  ServiceType,
} from '../services/degradation.service';
import { CircuitBreakerService, CircuitState } from '../services/circuit-breaker.service';

jest.mock('../services/circuit-breaker.service');

describe('DegradationService', () => {
  beforeEach(() => {
    DegradationService.resetAllStatuses();
    jest.clearAllMocks();
  });

  describe('isServiceDegraded', () => {
    it('should return false when service is not degraded', () => {
      expect(DegradationService.isServiceDegraded(ServiceType.OPENAI)).toBe(false);
    });

    it('should return true when service is degraded', () => {
      DegradationService.updateServiceStatus(ServiceType.OPENAI, DegradationLevel.PARTIAL);
      expect(DegradationService.isServiceDegraded(ServiceType.OPENAI)).toBe(true);
    });
  });

  describe('getServiceDegradationLevel', () => {
    it('should return NONE for non-degraded service', () => {
      expect(DegradationService.getServiceDegradationLevel(ServiceType.OPENAI)).toBe(
        DegradationLevel.NONE
      );
    });

    it('should return degradation level for degraded service', () => {
      DegradationService.updateServiceStatus(ServiceType.OPENAI, DegradationLevel.SEVERE);
      expect(DegradationService.getServiceDegradationLevel(ServiceType.OPENAI)).toBe(
        DegradationLevel.SEVERE
      );
    });
  });

  describe('updateServiceStatus', () => {
    it('should update service degradation status', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      expect(DegradationService.getServiceDegradationLevel(ServiceType.EMBEDDING)).toBe(
        DegradationLevel.PARTIAL
      );
    });
  });

  describe('checkCircuitBreakerStatus', () => {
    it('should return circuit breaker state for service', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      const state = DegradationService.checkCircuitBreakerStatus(ServiceType.EMBEDDING);
      expect(state).toBe(CircuitState.CLOSED);
      expect(CircuitBreakerService.getState).toHaveBeenCalledWith('openai-embeddings');
    });

    it('should return null for service without circuit breaker', () => {
      const state = DegradationService.checkCircuitBreakerStatus(ServiceType.OPENAI);
      expect(state).toBeNull();
    });

    it('should handle circuit breaker errors gracefully', () => {
      (CircuitBreakerService.getState as jest.Mock).mockImplementation(() => {
        throw new Error('Circuit breaker not found');
      });
      const state = DegradationService.checkCircuitBreakerStatus(ServiceType.EMBEDDING);
      expect(state).toBeNull();
    });
  });

  describe('getOverallStatus', () => {
    it('should return NONE when no services are degraded', () => {
      const status = DegradationService.getOverallStatus();
      expect(status.level).toBe(DegradationLevel.NONE);
      expect(status.affectedServices).toHaveLength(0);
    });

    it('should detect degraded services', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      const status = DegradationService.getOverallStatus();
      expect(status.level).toBe(DegradationLevel.PARTIAL);
      expect(status.affectedServices).toContain(ServiceType.EMBEDDING);
    });

    it('should detect circuit breaker open as severe degradation', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.OPEN);
      const status = DegradationService.getOverallStatus();
      expect(status.level).toBe(DegradationLevel.SEVERE);
    });

    it('should determine highest degradation level', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      DegradationService.updateServiceStatus(ServiceType.SEARCH, DegradationLevel.SEVERE);
      const status = DegradationService.getOverallStatus();
      expect(status.level).toBe(DegradationLevel.SEVERE);
    });
  });

  describe('createFallbackResult', () => {
    it('should create fallback result with degradation info', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      const result = DegradationService.createFallbackResult(
        'fallback data',
        true,
        [ServiceType.EMBEDDING],
        'Using fallback'
      );

      expect(result.result).toBe('fallback data');
      expect(result.degraded).toBe(true);
      expect(result.affectedServices).toContain(ServiceType.EMBEDDING);
      expect(result.message).toBe('Using fallback');
    });

    it('should create non-degraded result', () => {
      const result = DegradationService.createFallbackResult('data', false, []);
      expect(result.degraded).toBe(false);
      expect(result.degradationLevel).toBe(DegradationLevel.NONE);
    });

    it('should include cache and partial flags', () => {
      const result = DegradationService.createFallbackResult(
        'data',
        true,
        [ServiceType.EMBEDDING],
        undefined,
        true,
        true
      );
      expect(result.fromCache).toBe(true);
      expect(result.partial).toBe(true);
    });
  });

  describe('handleServiceError', () => {
    it('should set SEVERE degradation when circuit breaker is open', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.OPEN);
      const error = new Error('Service error');
      const level = DegradationService.handleServiceError(ServiceType.EMBEDDING, error);
      expect(level).toBe(DegradationLevel.SEVERE);
      expect(DegradationService.getServiceDegradationLevel(ServiceType.EMBEDDING)).toBe(
        DegradationLevel.SEVERE
      );
    });

    it('should set PARTIAL degradation for rate limit errors', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      const error = new Error('Rate limit');
      (error as any).status = 429;
      const level = DegradationService.handleServiceError(ServiceType.OPENAI, error);
      expect(level).toBe(DegradationLevel.PARTIAL);
    });

    it('should set SEVERE degradation for server errors', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      const error = new Error('Server error');
      (error as any).status = 500;
      const level = DegradationService.handleServiceError(ServiceType.OPENAI, error);
      expect(level).toBe(DegradationLevel.SEVERE);
    });

    it('should set SEVERE degradation for timeout errors', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      const error = new Error('Timeout');
      (error as any).code = 'ETIMEDOUT';
      const level = DegradationService.handleServiceError(ServiceType.OPENAI, error);
      expect(level).toBe(DegradationLevel.SEVERE);
    });

    it('should set PARTIAL degradation for other errors', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      const error = new Error('Other error');
      const level = DegradationService.handleServiceError(ServiceType.OPENAI, error);
      expect(level).toBe(DegradationLevel.PARTIAL);
    });
  });

  describe('resetServiceStatus', () => {
    it('should reset service degradation status', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      DegradationService.resetServiceStatus(ServiceType.EMBEDDING);
      expect(DegradationService.getServiceDegradationLevel(ServiceType.EMBEDDING)).toBe(
        DegradationLevel.NONE
      );
    });
  });

  describe('resetAllStatuses', () => {
    it('should reset all service degradation statuses', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      DegradationService.updateServiceStatus(ServiceType.SEARCH, DegradationLevel.SEVERE);
      DegradationService.resetAllStatuses();

      expect(DegradationService.getServiceDegradationLevel(ServiceType.EMBEDDING)).toBe(
        DegradationLevel.NONE
      );
      expect(DegradationService.getServiceDegradationLevel(ServiceType.SEARCH)).toBe(
        DegradationLevel.NONE
      );
    });
  });

  describe('getStatistics', () => {
    it('should return degradation statistics', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      const stats = DegradationService.getStatistics();

      expect(stats.totalServices).toBeGreaterThan(0);
      expect(stats.degradedServices).toBe(1);
      expect(stats.services[ServiceType.EMBEDDING]).toBe(DegradationLevel.PARTIAL);
      expect(stats.overallStatus).toBeDefined();
    });

    it('should count degraded services correctly', () => {
      DegradationService.updateServiceStatus(ServiceType.EMBEDDING, DegradationLevel.PARTIAL);
      DegradationService.updateServiceStatus(ServiceType.SEARCH, DegradationLevel.SEVERE);
      const stats = DegradationService.getStatistics();

      expect(stats.degradedServices).toBe(2);
    });
  });
});
