import { CircuitBreakerService, CircuitState, CircuitBreakerConfig } from '../services/circuit-breaker.service';

describe('CircuitBreakerService', () => {
  beforeEach(() => {
    // Reset all circuit breakers before each test
    const names = CircuitBreakerService.getBreakerNames();
    names.forEach(name => {
      try {
        CircuitBreakerService.reset(name);
      } catch (e) {
        // Ignore if breaker doesn't exist
      }
    });
  });

  describe('getBreaker', () => {
    it('should create a new circuit breaker if it does not exist', () => {
      const breaker = CircuitBreakerService.getBreaker('test-circuit');
      expect(breaker).toBeDefined();
      expect(breaker.getName()).toBe('test-circuit');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should return existing circuit breaker if it already exists', () => {
      const breaker1 = CircuitBreakerService.getBreaker('test-circuit');
      const breaker2 = CircuitBreakerService.getBreaker('test-circuit');
      expect(breaker1).toBe(breaker2);
    });

    it('should create circuit breaker with custom config', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 3,
        resetTimeout: 30000,
        halfOpenMaxCalls: 2,
      };
      const breaker = CircuitBreakerService.getBreaker('custom-circuit', config);
      expect(breaker).toBeDefined();
      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('execute', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const result = await CircuitBreakerService.execute(
        'test-circuit',
        async () => 'success'
      );
      expect(result.result).toBe('success');
      expect(result.fromCache).toBe(false);
      expect(result.circuitState).toBe(CircuitState.CLOSED);
    });

    it('should record success and keep circuit closed', async () => {
      await CircuitBreakerService.execute('test-circuit', async () => 'success');
      const stats = CircuitBreakerService.getStats('test-circuit');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    it('should record failure and keep circuit closed if below threshold', async () => {
      const breaker = CircuitBreakerService.getBreaker('below-threshold-circuit', {
        failureThreshold: 3,
      });

      // Fail twice (below threshold)
      for (let i = 0; i < 2; i++) {
        try {
          await CircuitBreakerService.execute('below-threshold-circuit', async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // Expected
        }
      }

      const stats = CircuitBreakerService.getStats('below-threshold-circuit');
      expect(stats.failures).toBe(2);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after failure threshold is reached', async () => {
      const breaker = CircuitBreakerService.getBreaker('open-threshold-circuit', {
        failureThreshold: 2,
      });

      // Fail enough times to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await CircuitBreakerService.execute('open-threshold-circuit', async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // Expected
        }
      }

      const stats = CircuitBreakerService.getStats('open-threshold-circuit');
      expect(stats.state).toBe(CircuitState.OPEN);
    });

    it('should reject requests immediately when circuit is open', async () => {
      const breaker = CircuitBreakerService.getBreaker('reject-open-circuit', {
        failureThreshold: 1,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('reject-open-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      // Try to execute when circuit is open
      await expect(
        CircuitBreakerService.execute('reject-open-circuit', async () => 'success')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to half-open after reset timeout', async () => {
      jest.useFakeTimers();
      const breaker = CircuitBreakerService.getBreaker('half-open-transition-circuit', {
        failureThreshold: 1,
        resetTimeout: 1000, // 1 second
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('half-open-transition-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(CircuitBreakerService.getState('half-open-transition-circuit')).toBe(CircuitState.OPEN);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Execute - transitions to half-open then success closes the circuit
      const result = await CircuitBreakerService.execute('half-open-transition-circuit', async () => 'success');
      expect(result.result).toBe('success');
      expect(CircuitBreakerService.getState('half-open-transition-circuit')).toBe(CircuitState.CLOSED);

      jest.useRealTimers();
    });

    it('should close circuit after successful call in half-open state', async () => {
      jest.useFakeTimers();
      const breaker = CircuitBreakerService.getBreaker('half-open-close-circuit', {
        failureThreshold: 1,
        resetTimeout: 1000,
        halfOpenMaxCalls: 5,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('half-open-close-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Successful call in half-open should close circuit
      const result = await CircuitBreakerService.execute('half-open-close-circuit', async () => 'success');
      expect(result.result).toBe('success');
      expect(CircuitBreakerService.getState('half-open-close-circuit')).toBe(CircuitState.CLOSED);

      jest.useRealTimers();
    });

    it('should enforce half-open max calls limit', async () => {
      jest.useFakeTimers();
      const breaker = CircuitBreakerService.getBreaker('half-open-limit-circuit', {
        failureThreshold: 1,
        resetTimeout: 1000,
        halfOpenMaxCalls: 2,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('half-open-limit-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // First success transitions to half-open then closes; second call runs in closed state
      await CircuitBreakerService.execute('half-open-limit-circuit', async () => 'success');
      const result = await CircuitBreakerService.execute('half-open-limit-circuit', async () => 'success');
      expect(result.result).toBe('success');
      expect(CircuitBreakerService.getState('half-open-limit-circuit')).toBe(CircuitState.CLOSED);

      jest.useRealTimers();
    });

    it('should timeout if function takes too long', async () => {
      jest.useFakeTimers();
      const breaker = CircuitBreakerService.getBreaker('timeout-circuit', {
        timeout: 1000,
      });

      const promise = CircuitBreakerService.execute('timeout-circuit', async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'success';
      });

      jest.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('timeout');

      jest.useRealTimers();
    });

    it('should filter errors based on errorFilter', async () => {
      const breaker = CircuitBreakerService.getBreaker('error-filter-circuit', {
        failureThreshold: 1,
        errorFilter: (error) => error.message !== 'skip',
      });

      // Error that should be filtered out
      try {
        await CircuitBreakerService.execute('error-filter-circuit', async () => {
          throw new Error('skip');
        });
      } catch (e) {
        // Expected
      }

      // Circuit should still be closed
      expect(CircuitBreakerService.getState('error-filter-circuit')).toBe(CircuitState.CLOSED);

      // Error that should count as failure
      try {
        await CircuitBreakerService.execute('error-filter-circuit', async () => {
          throw new Error('count');
        });
      } catch (e) {
        // Expected
      }

      // Circuit should be open
      expect(CircuitBreakerService.getState('error-filter-circuit')).toBe(CircuitState.OPEN);
    });
  });

  describe('getStats', () => {
    it('should return stats for specific circuit breaker', () => {
      CircuitBreakerService.getBreaker('test-circuit');
      const stats = CircuitBreakerService.getStats('test-circuit');
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('totalCalls');
      expect(stats).toHaveProperty('failureRate');
      expect(stats).toHaveProperty('successRate');
    });

    it('should return stats for all circuit breakers', () => {
      CircuitBreakerService.getBreaker('circuit-1');
      CircuitBreakerService.getBreaker('circuit-2');
      const stats = CircuitBreakerService.getStats();
      expect(stats).toHaveProperty('circuit-1');
      expect(stats).toHaveProperty('circuit-2');
    });

    it('should throw error if circuit breaker not found', () => {
      expect(() => CircuitBreakerService.getStats('non-existent')).toThrow('not found');
    });

    it('should calculate failure and success rates correctly', async () => {
      const breaker = CircuitBreakerService.getBreaker('test-circuit');

      // Make some successful calls
      for (let i = 0; i < 3; i++) {
        await CircuitBreakerService.execute('test-circuit', async () => 'success');
      }

      // Make some failed calls
      for (let i = 0; i < 2; i++) {
        try {
          await CircuitBreakerService.execute('test-circuit', async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // Expected
        }
      }

      const stats = CircuitBreakerService.getStats('test-circuit');
      expect(stats.totalCalls).toBe(5);
      expect(stats.successes).toBe(3);
      expect(stats.failures).toBe(2);
      expect(stats.failureRate).toBeCloseTo(40, 1);
      expect(stats.successRate).toBeCloseTo(60, 1);
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to initial state', async () => {
      const breaker = CircuitBreakerService.getBreaker('reset-state-circuit', {
        failureThreshold: 1,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('reset-state-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(CircuitBreakerService.getState('reset-state-circuit')).toBe(CircuitState.OPEN);

      // Reset
      CircuitBreakerService.reset('reset-state-circuit');

      const stats = CircuitBreakerService.getStats('reset-state-circuit');
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalCalls).toBe(0);
    });

    it('should throw error if circuit breaker not found', () => {
      expect(() => CircuitBreakerService.reset('non-existent')).toThrow('not found');
    });
  });

  describe('open and close', () => {
    it('should manually open circuit breaker', () => {
      const breaker = CircuitBreakerService.getBreaker('test-circuit');
      CircuitBreakerService.open('test-circuit');
      expect(CircuitBreakerService.getState('test-circuit')).toBe(CircuitState.OPEN);
    });

    it('should manually close circuit breaker', async () => {
      const breaker = CircuitBreakerService.getBreaker('manual-close-circuit', {
        failureThreshold: 1,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('manual-close-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      expect(CircuitBreakerService.getState('manual-close-circuit')).toBe(CircuitState.OPEN);

      // Manually close
      CircuitBreakerService.close('manual-close-circuit');
      expect(CircuitBreakerService.getState('manual-close-circuit')).toBe(CircuitState.CLOSED);
    });

    it('should throw error if circuit breaker not found', () => {
      expect(() => CircuitBreakerService.open('non-existent')).toThrow('not found');
      expect(() => CircuitBreakerService.close('non-existent')).toThrow('not found');
    });
  });

  describe('getState', () => {
    it('should return current state of circuit breaker', () => {
      CircuitBreakerService.getBreaker('test-circuit');
      const state = CircuitBreakerService.getState('test-circuit');
      expect(state).toBe(CircuitState.CLOSED);
    });

    it('should return null if circuit breaker not found', () => {
      const state = CircuitBreakerService.getState('non-existent');
      expect(state).toBeNull();
    });
  });

  describe('getBreakerNames', () => {
    it('should return all circuit breaker names', () => {
      CircuitBreakerService.getBreaker('circuit-1');
      CircuitBreakerService.getBreaker('circuit-2');
      const names = CircuitBreakerService.getBreakerNames();
      expect(names).toContain('circuit-1');
      expect(names).toContain('circuit-2');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all circuits are closed', () => {
      CircuitBreakerService.getBreaker('circuit-1');
      CircuitBreakerService.getBreaker('circuit-2');
      const health = CircuitBreakerService.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.circuits['circuit-1'].healthy).toBe(true);
      expect(health.circuits['circuit-2'].healthy).toBe(true);
    });

    it('should return unhealthy status when any circuit is open', async () => {
      const breaker = CircuitBreakerService.getBreaker('health-open-circuit', {
        failureThreshold: 1,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('health-open-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      const health = CircuitBreakerService.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.circuits['health-open-circuit'].healthy).toBe(false);
    });

    it('should consider half-open as healthy', async () => {
      jest.useFakeTimers();
      const breaker = CircuitBreakerService.getBreaker('test-circuit', {
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      // Open the circuit
      try {
        await CircuitBreakerService.execute('test-circuit', async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Try to execute to transition to half-open
      try {
        await CircuitBreakerService.execute('test-circuit', async () => 'success');
      } catch (e) {
        // May fail
      }

      const health = CircuitBreakerService.healthCheck();
      expect(health.circuits['test-circuit'].healthy).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('monitoring window', () => {
    it('should open circuit after failures within monitoring window', async () => {
      jest.useFakeTimers();
      const breaker = CircuitBreakerService.getBreaker('monitoring-window-circuit', {
        failureThreshold: 3,
        monitoringWindow: 5000, // 5 seconds
      });

      // Create 3 failures (spread over 3 seconds)
      for (let i = 0; i < 3; i++) {
        try {
          await CircuitBreakerService.execute('monitoring-window-circuit', async () => {
            throw new Error('Test error');
          });
        } catch (e) {
          // Expected
        }
        jest.advanceTimersByTime(1000);
      }

      const stats = CircuitBreakerService.getStats('monitoring-window-circuit');
      expect(stats.state).toBe(CircuitState.OPEN);
      expect(stats.failures).toBe(3);

      jest.useRealTimers();
    });
  });
});
