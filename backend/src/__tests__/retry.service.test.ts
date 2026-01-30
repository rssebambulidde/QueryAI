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
      let callCount = 0;
      const err = new Error('Temporary error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) throw err;
        return 'success';
      });

      const result = await RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 5,
        maxDelay: 10,
        jitter: false,
      });

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should exhaust retries and throw error', async () => {
      const err = new Error('Persistent error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);

      await expect(
        RetryService.execute(fn, {
          maxRetries: 2,
          initialDelay: 5,
          maxDelay: 10,
          jitter: false,
        })
      ).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }, 10000);

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const err = new Error('Error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);
      const onRetry = jest.fn((_error, _attempt, delay) => {
        delays.push(delay);
      });

      try {
        await RetryService.execute(fn, {
          maxRetries: 3,
          initialDelay: 10,
          multiplier: 2,
          maxDelay: 100,
          jitter: false,
          onRetry,
        });
      } catch {
        // Expected
      }

      expect(delays.length).toBeGreaterThan(0);
      expect(onRetry).toHaveBeenCalled();
    }, 10000);

    it('should respect maxDelay', async () => {
      const delays: number[] = [];
      const err = new Error('Error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);
      const onRetry = jest.fn((_error, _attempt, delay) => {
        delays.push(delay);
      });

      try {
        await RetryService.execute(fn, {
          maxRetries: 5,
          initialDelay: 100,
          multiplier: 2,
          maxDelay: 200,
          jitter: false,
          onRetry,
        });
      } catch {
        // Expected
      }

      delays.forEach((d) => expect(d).toBeLessThanOrEqual(200));
    }, 15000);

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Validation error');
      (error as Error & { status?: number }).status = 400;

      const fn = jest.fn().mockRejectedValue(error);

      await expect(RetryService.execute(fn)).rejects.toThrow('Validation error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit errors', async () => {
      let callCount = 0;
      const error = new Error('Rate limit');
      (error as Error & { status?: number }).status = 429;
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) throw error;
        return 'success';
      });

      const result = await RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 5,
        maxDelay: 10,
        jitter: false,
      });
      expect(result.result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should retry on server errors', async () => {
      let callCount = 0;
      const error = new Error('Server error');
      (error as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) throw error;
        return 'success';
      });

      const result = await RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 5,
        maxDelay: 10,
        jitter: false,
      });
      expect(result.result).toBe('success');
    }, 10000);

    it('should retry on network errors', async () => {
      let callCount = 0;
      const error = new Error('Connection error');
      (error as Error & { code?: string }).code = 'ECONNRESET';
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) throw error;
        return 'success';
      });

      const result = await RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 5,
        maxDelay: 10,
        jitter: false,
      });
      expect(result.result).toBe('success');
    }, 10000);

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const err = new Error('Error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);

      try {
        await RetryService.execute(fn, {
          maxRetries: 2,
          initialDelay: 5,
          maxDelay: 10,
          jitter: false,
          onRetry,
        });
      } catch {
        // Expected
      }

      expect(onRetry).toHaveBeenCalled();
    }, 10000);

    it('should handle jitter', async () => {
      const delays: number[] = [];
      const err = new Error('Error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);
      const onRetry = jest.fn((_error, _attempt, delay) => {
        delays.push(delay);
      });

      try {
        await RetryService.execute(fn, {
          maxRetries: 2,
          initialDelay: 10,
          maxDelay: 50,
          jitter: true,
          onRetry,
        });
      } catch {
        // Expected
      }

      expect(delays.length).toBeGreaterThan(0);
    }, 10000);

    it('should calculate totalTime correctly', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await RetryService.execute(fn);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStats', () => {
    it('should return retry statistics', async () => {
      let callCount = 0;
      const err = new Error('Error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) throw err;
        return 'success';
      });

      await RetryService.execute(fn, {
        maxRetries: 3,
        initialDelay: 5,
        maxDelay: 10,
        jitter: false,
      });

      const stats = RetryService.getStats();
      expect(stats.totalAttempts).toBeGreaterThan(0);
      expect(stats.successfulRetries).toBeGreaterThan(0);
    }, 10000);

    it('should track failed retries', async () => {
      const err = new Error('Persistent error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);

      try {
        await RetryService.execute(fn, {
          maxRetries: 2,
          initialDelay: 5,
          maxDelay: 10,
          jitter: false,
        });
      } catch {
        // Expected
      }

      const stats = RetryService.getStats();
      expect(stats.failedRetries).toBeGreaterThan(0);
    }, 10000);

    it('should track retries by error type', async () => {
      const err = new Error('Error');
      (err as Error & { status?: number }).status = 500;
      const fn = jest.fn().mockRejectedValue(err);

      try {
        await RetryService.execute(fn, {
          maxRetries: 1,
          initialDelay: 5,
          maxDelay: 10,
          jitter: false,
        });
      } catch {
        // Expected
      }

      const stats = RetryService.getStats();
      expect(stats.retriesByError).toBeDefined();
    }, 10000);
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      await RetryService.execute(fn);

      let stats = RetryService.getStats();
      expect(stats.totalAttempts).toBeGreaterThan(0);

      RetryService.resetStats();

      stats = RetryService.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.successfulRetries).toBe(0);
      expect(stats.failedRetries).toBe(0);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const error = new Error('Rate limit');
      (error as Error & { status?: number }).status = 429;
      expect(RetryService.isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const error = new Error('Validation error');
      (error as Error & { status?: number }).status = 400;
      expect(RetryService.isRetryableError(error)).toBe(false);
    });

    it('should check error codes', () => {
      const error = new Error('Connection error');
      (error as Error & { code?: string }).code = 'ECONNRESET';
      expect(RetryService.isRetryableError(error)).toBe(true);
    });

    it('should check error messages', () => {
      const error = new Error('rate_limit_exceeded');
      expect(RetryService.isRetryableError(error)).toBe(true);
    });

    it('should check OpenAI error types', () => {
      const error = new Error('Error');
      (error as Error & { type?: string }).type = 'rate_limit_error';
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
