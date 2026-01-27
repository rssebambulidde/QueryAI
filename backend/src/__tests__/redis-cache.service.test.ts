import { RedisCacheService } from '../services/redis-cache.service';
import { getRedisClient, isRedisConfigured } from '../config/redis.config';

jest.mock('../config/redis.config');

describe('RedisCacheService', () => {
  const mockRedisClient = {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    expire: jest.fn(),
    scan: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    RedisCacheService.resetStats();
    RedisCacheService.resetEmbeddingStats();
    RedisCacheService.resetRAGStats();

    (isRedisConfigured as jest.Mock).mockReturnValue(true);
    (getRedisClient as jest.Mock).mockResolvedValue(mockRedisClient);
  });

  describe('get', () => {
    it('should return cached value', async () => {
      const cachedValue = JSON.stringify({ data: 'test' });
      mockRedisClient.get.mockResolvedValue(cachedValue);

      const result = await RedisCacheService.get('test-key');
      
      expect(result).toEqual({ data: 'test' });
      expect(mockRedisClient.get).toHaveBeenCalledWith('cache:test-key');
      
      const stats = RedisCacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should return null on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await RedisCacheService.get('test-key');
      
      expect(result).toBeNull();
      
      const stats = RedisCacheService.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('should handle custom prefix', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify('value'));

      await RedisCacheService.get('test-key', { prefix: 'custom' });
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('custom:test-key');
    });

    it('should handle similarity cache entries', async () => {
      const similarityEntry = JSON.stringify({
        value: 'test',
        embedding: [0.1, 0.2, 0.3],
        timestamp: Date.now(),
      });
      mockRedisClient.get.mockResolvedValue(similarityEntry);

      const result = await RedisCacheService.get('test-key');
      
      expect(result).toBe('test');
    });

    it('should return null when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const result = await RedisCacheService.get('test-key');
      
      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should handle parse errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await RedisCacheService.get('test-key');
      
      expect(result).toBeNull();
      
      const stats = RedisCacheService.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await RedisCacheService.get('test-key');
      
      expect(result).toBeNull();
      
      const stats = RedisCacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('set', () => {
    it('should set value in cache', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await RedisCacheService.set('test-key', { data: 'test' });
      
      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'cache:test-key',
        3600,
        JSON.stringify({ data: 'test' })
      );
      
      const stats = RedisCacheService.getStats();
      expect(stats.sets).toBe(1);
    });

    it('should use custom TTL', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await RedisCacheService.set('test-key', 'value', { ttl: 7200 });
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'cache:test-key',
        7200,
        JSON.stringify('value')
      );
    });

    it('should return false when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const result = await RedisCacheService.set('test-key', 'value');
      
      expect(result).toBe(false);
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await RedisCacheService.set('test-key', 'value');
      
      expect(result).toBe(false);
      
      const stats = RedisCacheService.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete key from cache', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await RedisCacheService.delete('test-key');
      
      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('cache:test-key');
      
      const stats = RedisCacheService.getStats();
      expect(stats.deletes).toBe(1);
    });

    it('should return false if key does not exist', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await RedisCacheService.delete('test-key');
      
      expect(result).toBe(false);
    });

    it('should return false when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const result = await RedisCacheService.delete('test-key');
      
      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await RedisCacheService.exists('test-key');
      
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await RedisCacheService.exists('test-key');
      
      expect(result).toBe(false);
    });
  });

  describe('getTTL', () => {
    it('should return TTL for key', async () => {
      mockRedisClient.ttl.mockResolvedValue(3600);

      const result = await RedisCacheService.getTTL('test-key');
      
      expect(result).toBe(3600);
    });

    it('should return -1 when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const result = await RedisCacheService.getTTL('test-key');
      
      expect(result).toBe(-1);
    });
  });

  describe('extendTTL', () => {
    it('should extend TTL for key', async () => {
      mockRedisClient.expire.mockResolvedValue(true);

      const result = await RedisCacheService.extendTTL('test-key', 7200);
      
      expect(result).toBe(true);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('cache:test-key', 7200);
    });

    it('should return false when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const result = await RedisCacheService.extendTTL('test-key', 7200);
      
      expect(result).toBe(false);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce({ cursor: 0, keys: ['cache:test-1', 'cache:test-2'] })
        .mockResolvedValueOnce({ cursor: 0, keys: [] });
      mockRedisClient.del.mockResolvedValue(2);

      const result = await RedisCacheService.deletePattern('test-*');
      
      expect(result).toBe(2);
      expect(mockRedisClient.del).toHaveBeenCalledWith(['cache:test-1', 'cache:test-2']);
    });

    it('should return 0 when no keys match', async () => {
      mockRedisClient.scan.mockResolvedValue({ cursor: 0, keys: [] });

      const result = await RedisCacheService.deletePattern('test-*');
      
      expect(result).toBe(0);
    });

    it('should return 0 when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const result = await RedisCacheService.deletePattern('test-*');
      
      expect(result).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all cache entries', async () => {
      mockRedisClient.scan
        .mockResolvedValueOnce({ cursor: 0, keys: ['cache:key1', 'cache:key2'] })
        .mockResolvedValueOnce({ cursor: 0, keys: [] });
      mockRedisClient.del.mockResolvedValue(2);

      const result = await RedisCacheService.clearAll();
      
      expect(result).toBe(2);
    });
  });

  describe('embedding cache stats', () => {
    it('should record embedding cache hit', () => {
      RedisCacheService.recordEmbeddingHit();
      RedisCacheService.recordEmbeddingHit();
      
      const stats = RedisCacheService.getEmbeddingStats();
      expect(stats.hits).toBe(2);
      expect(stats.hitRate).toBe(100);
    });

    it('should record embedding cache miss', () => {
      RedisCacheService.recordEmbeddingMiss();
      
      const stats = RedisCacheService.getEmbeddingStats();
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      RedisCacheService.recordEmbeddingHit();
      RedisCacheService.recordEmbeddingHit();
      RedisCacheService.recordEmbeddingMiss();
      
      const stats = RedisCacheService.getEmbeddingStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should reset embedding stats', () => {
      RedisCacheService.recordEmbeddingHit();
      RedisCacheService.resetEmbeddingStats();
      
      const stats = RedisCacheService.getEmbeddingStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('RAG cache stats', () => {
    it('should record RAG cache hit', () => {
      RedisCacheService.recordRAGHit();
      RedisCacheService.recordRAGHit();
      
      const stats = RedisCacheService.getRAGStats();
      expect(stats.hits).toBe(2);
    });

    it('should record similarity hit', () => {
      RedisCacheService.recordRAGSimilarityHit();
      
      const stats = RedisCacheService.getRAGStats();
      expect(stats.similarityHits).toBe(1);
    });

    it('should reset RAG stats', () => {
      RedisCacheService.recordRAGHit();
      RedisCacheService.resetRAGStats();
      
      const stats = RedisCacheService.getRAGStats();
      expect(stats.hits).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = RedisCacheService.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('errors');
    });

    it('should reset statistics', () => {
      // Make some operations
      RedisCacheService.getStats(); // This doesn't change stats, but let's test reset
      
      RedisCacheService.resetStats();
      const stats = RedisCacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });
  });

  describe('findSimilarEntries', () => {
    it('should find similar cache entries', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];
      const entry1 = JSON.stringify({
        value: 'result1',
        embedding: [0.1, 0.2, 0.3],
        timestamp: Date.now(),
      });
      const entry2 = JSON.stringify({
        value: 'result2',
        embedding: [0.9, 0.8, 0.7],
        timestamp: Date.now(),
      });

      mockRedisClient.scan
        .mockResolvedValueOnce({
          cursor: 0,
          keys: ['rag:key1', 'rag:key2'],
        })
        .mockResolvedValueOnce({ cursor: 0, keys: [] });
      mockRedisClient.get
        .mockResolvedValueOnce(entry1)
        .mockResolvedValueOnce(entry2);

      const results = await RedisCacheService.findSimilarEntries(queryEmbedding, {
        similarityThreshold: 0.5,
        maxResults: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0.5);
    });

    it('should return empty array when Redis is not configured', async () => {
      (isRedisConfigured as jest.Mock).mockReturnValue(false);

      const results = await RedisCacheService.findSimilarEntries([0.1, 0.2, 0.3]);
      
      expect(results).toEqual([]);
    });
  });
});
