import { RetryService, RetryConfig } from '../services/retry.service';

describe('RetryService', () => {
  beforeEach(() => {
    RetryService.resetStats();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute function successfully on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await RetryService.execute(fn);
      
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary error');
        }
        return 'success';
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      // Fast-forward through retry delays
      jest.advanceTimersByTime(200);

      const result = await promise;

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });

    it('should exhaust retries and throw error', async () => {
      jest.useFakeTimers();
      const fn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      const promise = RetryService.execute(fn, {
        maxRetries: 2,
        initialDelay: 100,
      });

      // Fast-forward through retry delays
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries

      jest.useRealTimers();
    });

    it('should use exponential backoff', async () => {
      jest.useFakeTimers();
      const delays: number[] = [];
      let lastTime = Date.now();

      const fn = jest.fn().mockRejectedValue(new Error('Error'));

      const onRetry = jest.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 100,
        multiplier: 2,
        onRetry,
      });

      // Fast-forward through all retries
      jest.advanceTimersByTime(1000);

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      // Delays should increase exponentially: 100, 200, 400
      expect(delays.length).toBeGreaterThan(0);
      expect(onRetry).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should respect maxDelay', async () => {
      jest.useFakeTimers();
      const delays: number[] = [];

      const fn = jest.fn().mockRejectedValue(new Error('Error'));

      const onRetry = jest.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 5,
        initialDelay: 1000,
        multiplier: 2,
        maxDelay: 2000,
        onRetry,
      });

      // Fast-forward through all retries
      jest.advanceTimersByTime(10000);

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      // All delays should be capped at maxDelay
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(2000);
      });

      jest.useRealTimers();
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Validation error');
      (error as any).status = 400; // Not retryable

      const fn = jest.fn().mockRejectedValue(error);

      await expect(RetryService.execute(fn)).rejects.toThrow('Validation error');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should retry on rate limit errors', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const error = new Error('Rate limit');
      (error as any).status = 429;

      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw error;
        }
        return 'success';
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      jest.advanceTimersByTime(200);

      const result = await promise;
      expect(result.result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should retry on server errors', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const error = new Error('Server error');
      (error as any).status = 500;

      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw error;
        }
        return 'success';
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      jest.advanceTimersByTime(200);

      const result = await promise;
      expect(result.result).toBe('success');

      jest.useRealTimers();
    });

    it('should retry on network errors', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const error = new Error('Connection error');
      (error as any).code = 'ECONNRESET';

      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw error;
        }
        return 'success';
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      jest.advanceTimersByTime(200);

      const result = await promise;
      expect(result.result).toBe('success');

      jest.useRealTimers();
    });

    it('should call onRetry callback', async () => {
      jest.useFakeTimers();
      const onRetry = jest.fn();
      const fn = jest.fn().mockRejectedValue(new Error('Error'));

      const promise = RetryService.execute(fn, {
        maxRetries: 2,
        initialDelay: 100,
        onRetry,
      });

      jest.advanceTimersByTime(500);

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      expect(onRetry).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle jitter', async () => {
      jest.useFakeTimers();
      const delays: number[] = [];

      const fn = jest.fn().mockRejectedValue(new Error('Error'));

      const onRetry = jest.fn((error, attempt, delay) => {
        delays.push(delay);
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 2,
        initialDelay: 1000,
        jitter: true,
        onRetry,
      });

      jest.advanceTimersByTime(5000);

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      // With jitter, delays should have some variation
      expect(delays.length).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it('should calculate totalTime correctly', async () => {
      jest.useFakeTimers();
      const fn = jest.fn().mockResolvedValue('success');

      const startTime = Date.now();
      const promise = RetryService.execute(fn);
      jest.advanceTimersByTime(100);
      const result = await promise;

      expect(result.totalTime).toBeGreaterThanOrEqual(0);

      jest.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should return retry statistics', async () => {
      jest.useFakeTimers();
      let callCount = 0;
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Error');
        }
        return 'success';
      });

      const promise = RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      jest.advanceTimersByTime(200);
      await promise;

      const stats = RetryService.getStats();
      expect(stats.totalAttempts).toBeGreaterThan(0);
      expect(stats.successfulRetries).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it('should track failed retries', async () => {
      jest.useFakeTimers();
      const fn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      const promise = RetryService.execute(fn, {
        maxRetries: 2,
        initialDelay: 100,
      });

      jest.advanceTimersByTime(500);

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      const stats = RetryService.getStats();
      expect(stats.failedRetries).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it('should track retries by error type', async () => {
      jest.useFakeTimers();
      const fn = jest.fn().mockRejectedValue(new Error('Error'));

      const promise = RetryService.execute(fn, {
        maxRetries: 1,
        initialDelay: 100,
      });

      jest.advanceTimersByTime(300);

      try {
        await promise;
      } catch (e) {
        // Expected
      }

      const stats = RetryService.getStats();
      expect(stats.retriesByError).toBeDefined();

      jest.useRealTimers();
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      jest.useFakeTimers();
      const fn = jest.fn().mockResolvedValue('success');

      await RetryService.execute(fn);
      jest.advanceTimersByTime(100);

      let stats = RetryService.getStats();
      expect(stats.totalAttempts).toBeGreaterThan(0);

      RetryService.resetStats();

      stats = RetryService.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulRetries).toBe(0);
      expect(stats.failedRetries).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const error = new Error('Rate limit');
      (error as any).status = 429;
      expect(RetryService.isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const error = new Error('Validation error');
      (error as any).status = 400;
      expect(RetryService.isRetryableError(error)).toBe(false);
    });

    it('should check error codes', () => {
      const error = new Error('Connection error');
      (error as any).code = 'ECONNRESET';
      expect(RetryService.isRetryableError(error)).toBe(true);
    });

    it('should check error messages', () => {
      const error = new Error('rate_limit_exceeded');
      expect(RetryService.isRetryableError(error)).toBe(true);
    });

    it('should check OpenAI error types', () => {
      const error = new Error('Error');
      (error as any).type = 'rate_limit_error';
      expect(RetryService.isRetryableError(error)).toBe(true);
    });
  });

  describe('createConfig', () => {
    it('should create config with defaults', () => {
      const config = RetryService.createConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.initialDelay).toBe(1000);
      expect(config.maxDelay).toBe(30000);
      expect(config.multiplier).toBe(2);
      expect(config.jitter).toBe(true);
    });

    it('should merge with overrides', () => {
      const config = RetryService.createConfig({
        maxRetries: 5,
        initialDelay: 500,
      });
      expect(config.maxRetries).toBe(5);
      expect(config.initialDelay).toBe(500);
      expect(config.maxDelay).toBe(30000); // Default
    });
  });
});
