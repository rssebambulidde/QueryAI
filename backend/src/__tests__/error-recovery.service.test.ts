import {
  ErrorRecoveryService,
  ErrorCategory,
  RecoveryStrategy,
  ServiceType,
} from '../services/error-recovery.service';
import { DegradationService } from '../services/degradation.service';
import { CircuitBreakerService, CircuitState } from '../services/circuit-breaker.service';

jest.mock('../services/degradation.service');
jest.mock('../services/circuit-breaker.service');

describe('ErrorRecoveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      const error = new Error('Connection timeout');
      (error as any).code = 'ETIMEDOUT';
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.NETWORK);
    });

    it('should categorize rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.RATE_LIMIT);
    });

    it('should categorize server errors', () => {
      const error = new Error('Server error');
      (error as any).status = 500;
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.SERVER_ERROR);
    });

    it('should categorize authentication errors', () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should categorize validation errors', () => {
      const error = new Error('Bad request');
      (error as any).status = 400;
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.VALIDATION);
    });

    it('should categorize not found errors', () => {
      const error = new Error('Not found');
      (error as any).status = 404;
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.NOT_FOUND);
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Request timeout');
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.TIMEOUT);
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Unknown error');
      expect(ErrorRecoveryService.categorizeError(error)).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('determineRecoveryStrategy', () => {
    it('should return WAIT for rate limit errors', () => {
      const error = new Error('Rate limit');
      (error as any).status = 429;
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.OPENAI
      );
      expect(strategy).toBe(RecoveryStrategy.WAIT);
    });

    it('should return RETRY for network errors', () => {
      const error = new Error('Network error');
      (error as any).code = 'ECONNREFUSED';
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.OPENAI
      );
      expect(strategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should return SKIP for authentication errors', () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.OPENAI
      );
      expect(strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('should return SKIP for validation errors', () => {
      const error = new Error('Bad request');
      (error as any).status = 400;
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.OPENAI
      );
      expect(strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('should return CIRCUIT_BREAK for server errors when circuit is open', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.OPEN);
      const error = new Error('Server error');
      (error as any).status = 500;
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.EMBEDDING
      );
      expect(strategy).toBe(RecoveryStrategy.CIRCUIT_BREAK);
    });

    it('should return DEGRADE for server errors when circuit is not open', () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      const error = new Error('Server error');
      (error as any).status = 500;
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.EMBEDDING
      );
      expect(strategy).toBe(RecoveryStrategy.DEGRADE);
    });

    it('should return FALLBACK for unknown errors when fallback enabled', () => {
      const error = new Error('Unknown error');
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.OPENAI,
        { enableFallback: true }
      );
      expect(strategy).toBe(RecoveryStrategy.FALLBACK);
    });

    it('should return RETRY for unknown errors when fallback disabled', () => {
      const error = new Error('Unknown error');
      const strategy = ErrorRecoveryService.determineRecoveryStrategy(
        error,
        ServiceType.OPENAI,
        { enableFallback: false }
      );
      expect(strategy).toBe(RecoveryStrategy.RETRY);
    });
  });

  describe('attemptRecovery', () => {
    it('should retry operation successfully', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const primaryFn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return 'success';
      });

      const error = new Error('Network error');
      (error as any).code = 'ECONNREFUSED';

      const promise = ErrorRecoveryService.attemptRecovery(
        ServiceType.OPENAI,
        error,
        primaryFn,
        undefined,
        { maxAttempts: 3, retryDelay: 100 }
      );

      jest.advanceTimersByTime(500);
      const result = await promise;

      expect(result.recovered).toBe(true);
      expect(result.result).toBe('success');
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);

      jest.useRealTimers();
    });

    it('should use fallback function when strategy is FALLBACK', async () => {
      const primaryFn = jest.fn().mockRejectedValue(new Error('Unknown error'));
      const fallbackFn = jest.fn().mockResolvedValue('fallback result');

      const error = new Error('Unknown error');
      const result = await ErrorRecoveryService.attemptRecovery(
        ServiceType.OPENAI,
        error,
        primaryFn,
        fallbackFn,
        { enableFallback: true }
      );

      expect(result.recovered).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK);
      expect(fallbackFn).toHaveBeenCalled();
    });

    it('should degrade service when strategy is DEGRADE', async () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.CLOSED);
      (DegradationService.handleServiceError as jest.Mock).mockReturnValue(
        'PARTIAL' as any
      );

      const primaryFn = jest.fn().mockRejectedValue(new Error('Server error'));
      const fallbackFn = jest.fn().mockResolvedValue('degraded result');

      const error = new Error('Server error');
      (error as any).status = 500;

      const result = await ErrorRecoveryService.attemptRecovery(
        ServiceType.EMBEDDING,
        error,
        primaryFn,
        fallbackFn
      );

      expect(result.recovered).toBe(true);
      expect(result.result).toBe('degraded result');
      expect(result.strategy).toBe(RecoveryStrategy.DEGRADE);
      expect(DegradationService.handleServiceError).toHaveBeenCalled();
    });

    it('should fail when circuit breaker is open', async () => {
      (CircuitBreakerService.getState as jest.Mock).mockReturnValue(CircuitState.OPEN);

      const primaryFn = jest.fn().mockRejectedValue(new Error('Server error'));
      const error = new Error('Server error');
      (error as any).status = 500;

      const result = await ErrorRecoveryService.attemptRecovery(
        ServiceType.EMBEDDING,
        error,
        primaryFn
      );

      expect(result.recovered).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.CIRCUIT_BREAK);
    });

    it('should fail when strategy is SKIP', async () => {
      const primaryFn = jest.fn().mockRejectedValue(new Error('Validation error'));
      const error = new Error('Validation error');
      (error as any).status = 400;

      const result = await ErrorRecoveryService.attemptRecovery(
        ServiceType.OPENAI,
        error,
        primaryFn
      );

      expect(result.recovered).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.SKIP);
    });

    it('should wait and retry for rate limit errors', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const primaryFn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Rate limit');
        }
        return 'success';
      });

      const error = new Error('Rate limit');
      (error as any).status = 429;

      const promise = ErrorRecoveryService.attemptRecovery(
        ServiceType.OPENAI,
        error,
        primaryFn,
        undefined,
        { retryDelay: 100 }
      );

      jest.advanceTimersByTime(300);
      const result = await promise;

      expect(result.recovered).toBe(true);
      expect(result.result).toBe('success');
      expect(result.strategy).toBe(RecoveryStrategy.WAIT);

      jest.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should return recovery statistics', () => {
      const stats = ErrorRecoveryService.getStats();
      expect(stats).toHaveProperty('totalAttempts');
      expect(stats).toHaveProperty('successfulRecoveries');
      expect(stats).toHaveProperty('failedRecoveries');
      expect(stats).toHaveProperty('recoveriesByCategory');
      expect(stats).toHaveProperty('recoveriesByStrategy');
    });
  });

  describe('getRecoveryHistory', () => {
    it('should return recovery history', () => {
      const history = ErrorRecoveryService.getRecoveryHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit history size', async () => {
      // Make many recovery attempts
      const error = new Error('Test error');
      const primaryFn = jest.fn().mockResolvedValue('success');

      for (let i = 0; i < 100; i++) {
        await ErrorRecoveryService.attemptRecovery(
          ServiceType.OPENAI,
          error,
          primaryFn
        );
      }

      const history = ErrorRecoveryService.getRecoveryHistory();
      expect(history.length).toBeLessThanOrEqual(10000);
    });
  });
});
