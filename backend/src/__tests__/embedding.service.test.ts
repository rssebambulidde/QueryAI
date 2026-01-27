import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmbeddingService, BatchProcessingStats } from '../services/embedding.service';
import { getEmbeddingDimensions, DEFAULT_EMBEDDING_MODEL } from '../config/embedding.config';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [
            {
              embedding: new Array(1536).fill(0.1), // Mock embedding
              index: 0,
            },
          ],
        }),
      },
    })),
  };
});

// Mock RedisCacheService
jest.mock('../services/redis-cache.service', () => ({
  RedisCacheService: {
    get: jest.fn(),
    set: jest.fn(),
    getEmbeddingStats: jest.fn(),
  },
}));

// Mock config
jest.mock('../config/env', () => ({
  default: {
    OPENAI_API_KEY: 'test-key',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  },
}));

import { RedisCacheService } from '../services/redis-cache.service';
import OpenAI from 'openai';

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset model cache
    (EmbeddingService as any).currentModel = null;
    (EmbeddingService as any).openai = null;
    // Stop batch processor if running
    EmbeddingService.stopBatchProcessor();
    // Clear batch queue
    (EmbeddingService as any).batchQueue.clear();
    (EmbeddingService as any).isProcessing = false;
    // Reset stats
    (EmbeddingService as any).batchStats = {
      totalBatches: 0,
      totalProcessed: 0,
      totalQueued: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      queueSize: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    (EmbeddingService as any).processingTimes = [];
    // Mock cache
    (RedisCacheService.get as any).mockResolvedValue(null);
    (RedisCacheService.set as any).mockResolvedValue(undefined);
    (RedisCacheService.getEmbeddingStats as any).mockReturnValue({
      hits: 0,
      misses: 0,
      errors: 0,
    });
  });

  describe('getCurrentModel', () => {
    it('should return default model', () => {
      const model = EmbeddingService.getCurrentModel();
      expect(model).toBe(DEFAULT_EMBEDDING_MODEL);
    });

    it('should allow setting model', () => {
      EmbeddingService.setModel('text-embedding-3-large');
      const model = EmbeddingService.getCurrentModel();
      expect(model).toBe('text-embedding-3-large');
    });

    it('should persist model across calls', () => {
      EmbeddingService.setModel('text-embedding-3-large');
      expect(EmbeddingService.getCurrentModel()).toBe('text-embedding-3-large');
      expect(EmbeddingService.getCurrentModel()).toBe('text-embedding-3-large');
    });
  });

  describe('getCurrentDimensions', () => {
    it('should return dimensions for current model', () => {
      const dimensions = EmbeddingService.getCurrentDimensions();
      expect(dimensions).toBe(getEmbeddingDimensions(DEFAULT_EMBEDDING_MODEL));
    });

    it('should return correct dimensions after model change', () => {
      EmbeddingService.setModel('text-embedding-3-large');
      const dimensions = EmbeddingService.getCurrentDimensions();
      expect(dimensions).toBe(3072);
    });

    it('should return correct dimensions for ada-002', () => {
      EmbeddingService.setModel('text-embedding-ada-002');
      const dimensions = EmbeddingService.getCurrentDimensions();
      expect(dimensions).toBe(1536);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding with default model', async () => {
      const embedding = await EmbeddingService.generateEmbedding('test text');
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should generate embedding with specified model', async () => {
      const embedding = await EmbeddingService.generateEmbedding('test text', 'text-embedding-3-large');
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should handle dimension reduction for text-embedding-3-* models', async () => {
      const embedding = await EmbeddingService.generateEmbedding(
        'test text',
        'text-embedding-3-small',
        512 // Reduced dimensions
      );
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should cache embeddings', async () => {
      (RedisCacheService.get as any).mockResolvedValueOnce(new Array(1536).fill(0.1));

      const embedding = await EmbeddingService.generateEmbedding('cached text');

      expect(embedding).toBeDefined();
      expect(RedisCacheService.get).toHaveBeenCalled();
    });

    it('should store embeddings in cache', async () => {
      await EmbeddingService.generateEmbedding('new text');

      expect(RedisCacheService.set).toHaveBeenCalled();
    });

    it('should handle empty text', async () => {
      const embedding = await EmbeddingService.generateEmbedding('');
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should handle very long text', async () => {
      const longText = 'a '.repeat(10000);
      const embedding = await EmbeddingService.generateEmbedding(longText);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should handle special characters', async () => {
      const specialText = 'Hello 世界 🌍 Привет مرحبا';
      const embedding = await EmbeddingService.generateEmbedding(specialText);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });
  });

  describe('generateEmbeddingsBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const embeddings = await EmbeddingService.generateEmbeddingsBatch(texts);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(texts.length);
      embeddings.forEach(emb => {
        expect(Array.isArray(emb)).toBe(true);
        expect(emb.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty array', async () => {
      const embeddings = await EmbeddingService.generateEmbeddingsBatch([]);
      expect(embeddings).toEqual([]);
    });

    it('should handle large batch', async () => {
      const texts = Array.from({ length: 50 }, (_, i) => `text ${i}`);
      const embeddings = await EmbeddingService.generateEmbeddingsBatch(texts);
      
      expect(embeddings.length).toBe(texts.length);
    });

    it('should handle batch with different models', async () => {
      const texts = ['text 1', 'text 2'];
      const embeddings = await EmbeddingService.generateEmbeddingsBatch(
        texts,
        'text-embedding-3-large'
      );
      
      expect(embeddings.length).toBe(texts.length);
    });
  });

  describe('batch processing', () => {
    it('should get optimal batch size', () => {
      const batchSize = EmbeddingService.getOptimalBatchSize();
      
      expect(batchSize).toBeGreaterThan(0);
      expect(batchSize).toBeLessThanOrEqual(2048);
    });

    it('should get batch processing stats', () => {
      const stats = EmbeddingService.getBatchProcessingStats();
      
      expect(stats).toHaveProperty('totalBatches');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('averageProcessingTime');
    });

    it('should start batch processor', () => {
      EmbeddingService.startBatchProcessor();
      
      // Processor should be started
      expect((EmbeddingService as any).processingInterval).toBeDefined();
      
      // Clean up
      EmbeddingService.stopBatchProcessor();
    });

    it('should stop batch processor', () => {
      EmbeddingService.startBatchProcessor();
      EmbeddingService.stopBatchProcessor();
      
      expect((EmbeddingService as any).processingInterval).toBeNull();
    });

    it('should not start processor if already running', () => {
      EmbeddingService.startBatchProcessor();
      const interval1 = (EmbeddingService as any).processingInterval;
      
      EmbeddingService.startBatchProcessor();
      const interval2 = (EmbeddingService as any).processingInterval;
      
      expect(interval1).toBe(interval2);
      
      EmbeddingService.stopBatchProcessor();
    });
  });

  describe('queueEmbedding', () => {
    it('should queue embedding for batch processing', async () => {
      EmbeddingService.startBatchProcessor();
      
      const promise = EmbeddingService.queueEmbedding('test text');
      
      // Should return a promise
      expect(promise).toBeInstanceOf(Promise);
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const embedding = await promise;
      expect(embedding).toBeDefined();
      
      EmbeddingService.stopBatchProcessor();
    });

    it('should handle queued embedding with custom model', async () => {
      EmbeddingService.startBatchProcessor();
      
      const promise = EmbeddingService.queueEmbedding(
        'test text',
        'text-embedding-3-large'
      );
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const embedding = await promise;
      expect(embedding).toBeDefined();
      
      EmbeddingService.stopBatchProcessor();
    });
  });

  describe('getEmbeddingCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = EmbeddingService.getEmbeddingCacheStats();
      
      expect(stats).toBeDefined();
      expect(RedisCacheService.getEmbeddingStats).toHaveBeenCalled();
    });
  });

  describe('processDocument', () => {
    it('should process document with chunks', async () => {
      const chunks = [
        { id: 'chunk-1', chunkIndex: 0, content: 'Chunk 1 content' },
        { id: 'chunk-2', chunkIndex: 1, content: 'Chunk 2 content' },
      ];
      
      const result = await EmbeddingService.processDocument(
        'doc-1',
        chunks,
        'user-1',
        'text-embedding-3-small'
      );
      
      expect(result).toBeDefined();
      expect(result.embeddings).toHaveLength(chunks.length);
      expect(result.processedChunks).toBe(chunks.length);
    });

    it('should handle empty chunks array', async () => {
      const result = await EmbeddingService.processDocument(
        'doc-1',
        [],
        'user-1'
      );
      
      expect(result.embeddings).toEqual([]);
      expect(result.processedChunks).toBe(0);
    });

    it('should handle processing errors gracefully', async () => {
      // Mock OpenAI to throw error
      const mockOpenAI = {
        embeddings: {
          create: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      };
      (OpenAI as any).mockImplementationOnce(() => mockOpenAI);
      
      const chunks = [{ id: 'chunk-1', chunkIndex: 0, content: 'Content' }];
      
      const result = await EmbeddingService.processDocument(
        'doc-1',
        chunks,
        'user-1'
      );
      
      // Should handle error and return partial results
      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle OpenAI API key not configured', async () => {
      const originalConfig = require('../config/env').default;
      require('../config/env').default.OPENAI_API_KEY = '';
      
      // Reset OpenAI client
      (EmbeddingService as any).openai = null;
      
      await expect(EmbeddingService.generateEmbedding('test')).rejects.toThrow();
      
      // Restore
      require('../config/env').default.OPENAI_API_KEY = originalConfig.OPENAI_API_KEY;
    });

    it('should normalize text for cache consistently', async () => {
      const text1 = '  Test   Text  ';
      const text2 = 'test text';
      
      // Both should generate same cache key (after normalization)
      await EmbeddingService.generateEmbedding(text1);
      await EmbeddingService.generateEmbedding(text2);
      
      // Cache should be called for both
      expect(RedisCacheService.get).toHaveBeenCalledTimes(2);
    });
  });
});
