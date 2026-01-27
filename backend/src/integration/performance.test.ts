/**
 * RAG Pipeline Performance Tests
 * Tests system performance under load, concurrent requests, and scalability
 */

import { RAGService, RAGOptions } from '../services/rag.service';
import { AIService, QuestionRequest } from '../services/ai.service';
import { EmbeddingService } from '../services/embedding.service';
import { PineconeService } from '../services/pinecone.service';
import { SearchService } from '../services/search.service';
import { LatencyTrackerService, OperationType } from '../services/latency-tracker.service';

// Mock all external dependencies
jest.mock('../services/embedding.service');
jest.mock('../services/pinecone.service');
jest.mock('../services/search.service');
jest.mock('../config/openai');
jest.mock('../config/pinecone');
jest.mock('../config/redis.config');
jest.mock('../config/database');

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number; // Median
  p95ResponseTime: number; // 95th percentile
  p99ResponseTime: number; // 99th percentile
  throughput: number; // Requests per second
  errorRate: number; // Percentage
  responseTimes: number[];
}

/**
 * Calculate performance metrics from response times
 */
function calculateMetrics(
  responseTimes: number[],
  totalRequests: number,
  failedRequests: number
): PerformanceMetrics {
  const successfulRequests = totalRequests - failedRequests;
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
    minResponseTime: Math.min(...responseTimes) || 0,
    maxResponseTime: Math.max(...responseTimes) || 0,
    p50ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0,
    p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
    p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0,
    throughput: successfulRequests > 0 ? successfulRequests / (Math.max(...responseTimes) / 1000) : 0,
    errorRate: (failedRequests / totalRequests) * 100 || 0,
    responseTimes: sortedTimes,
  };
}

/**
 * Run concurrent requests
 */
async function runConcurrentRequests<T>(
  fn: () => Promise<T>,
  concurrency: number,
  totalRequests: number
): Promise<{ results: T[]; responseTimes: number[]; errors: Error[] }> {
  const results: T[] = [];
  const responseTimes: number[] = [];
  const errors: Error[] = [];

  const batches = Math.ceil(totalRequests / concurrency);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const startTime = Date.now();
          try {
            const result = await fn();
            const endTime = Date.now();
            results.push(result);
            responseTimes.push(endTime - startTime);
          } catch (error) {
            const endTime = Date.now();
            errors.push(error as Error);
            responseTimes.push(endTime - startTime);
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  return { results, responseTimes, errors };
}

describe('RAG Pipeline Performance Tests', () => {
  const testUserId = 'test-user-perf';
  const testTopicId = 'test-topic-perf';

  // Performance targets
  const PERFORMANCE_TARGETS = {
    singleRequestMaxTime: 5000, // 5 seconds for single request
    concurrentRequestMaxTime: 10000, // 10 seconds for concurrent requests
    p95ResponseTime: 8000, // 8 seconds for 95th percentile
    p99ResponseTime: 12000, // 12 seconds for 99th percentile
    errorRate: 1, // 1% maximum error rate
    minThroughput: 0.1, // Minimum 0.1 requests per second
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup fast mocks for performance testing
    (EmbeddingService.generateEmbedding as jest.Mock).mockImplementation(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate 50ms
        return new Array(1536).fill(0.1);
      }
    );
    (EmbeddingService.getCurrentModel as jest.Mock).mockReturnValue('text-embedding-3-small');
    (EmbeddingService.getCurrentDimensions as jest.Mock).mockReturnValue(1536);

    (PineconeService.search as jest.Mock).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate 100ms
      return [
        {
          id: 'chunk-1',
          score: 0.9,
          metadata: {
            documentId: 'doc-1',
            chunkIndex: 0,
            content: 'Test content',
          },
        },
      ];
    });

    (SearchService.search as jest.Mock).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200)); // Simulate 200ms
      return {
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            content: 'Test content',
            score: 0.85,
          },
        ],
        query: 'test',
        totalResults: 1,
      };
    });

    // Mock OpenAI with realistic delays
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate 500ms
            return {
              choices: [{
                message: {
                  content: 'Test answer',
                  role: 'assistant',
                },
              }],
              usage: {
                prompt_tokens: 500,
                completion_tokens: 100,
                total_tokens: 600,
              },
            };
          }),
        },
      },
    };

    jest.doMock('../config/openai', () => ({
      openai: mockOpenAI,
    }));
  });

  describe('Single Request Performance', () => {
    it('should complete single request within target time', async () => {
      const query = 'What is artificial intelligence?';
      const startTime = Date.now();

      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        maxDocumentChunks: 5,
        maxWebResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };
      const response = await AIService.answerQuestion(questionRequest);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(ragContext).toBeDefined();
      expect(response).toBeDefined();
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.singleRequestMaxTime);

      console.log(`Single request completed in ${duration}ms`);
    });

    it('should measure document-only request performance', async () => {
      const query = 'What is machine learning?';
      const startTime = Date.now();

      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: false,
        maxDocumentChunks: 5,
      };

      await RAGService.retrieveContext(query, ragOptions);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.singleRequestMaxTime);
      console.log(`Document-only request completed in ${duration}ms`);
    });

    it('should measure web-only request performance', async () => {
      const query = 'Latest AI news';
      const startTime = Date.now();

      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        maxWebResults: 5,
      };

      await RAGService.retrieveContext(query, ragOptions);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.singleRequestMaxTime);
      console.log(`Web-only request completed in ${duration}ms`);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 5 concurrent requests', async () => {
      const query = 'What is AI?';
      const concurrency = 5;
      const totalRequests = 5;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
          maxDocumentChunks: 5,
          maxWebResults: 5,
        };
        const ragContext = await RAGService.retrieveContext(query, ragOptions);
        const questionRequest: QuestionRequest = {
          question: query,
          enableDocumentSearch: true,
          enableWebSearch: true,
        };
        return await AIService.answerQuestion(questionRequest);
      };

      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      expect(results.length).toBe(totalRequests);
      expect(metrics.averageResponseTime).toBeLessThan(PERFORMANCE_TARGETS.concurrentRequestMaxTime);
      expect(metrics.errorRate).toBeLessThan(PERFORMANCE_TARGETS.errorRate);

      console.log(`5 concurrent requests - Avg: ${metrics.averageResponseTime}ms, P95: ${metrics.p95ResponseTime}ms, Errors: ${errors.length}`);
    });

    it('should handle 10 concurrent requests', async () => {
      const query = 'What is machine learning?';
      const concurrency = 10;
      const totalRequests = 10;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      expect(results.length).toBe(totalRequests);
      expect(metrics.p95ResponseTime).toBeLessThan(PERFORMANCE_TARGETS.p95ResponseTime);
      expect(metrics.errorRate).toBeLessThan(PERFORMANCE_TARGETS.errorRate);

      console.log(`10 concurrent requests - Avg: ${metrics.averageResponseTime}ms, P95: ${metrics.p95ResponseTime}ms, P99: ${metrics.p99ResponseTime}ms`);
    });

    it('should handle 20 concurrent requests', async () => {
      const query = 'What is deep learning?';
      const concurrency = 20;
      const totalRequests = 20;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: false, // Faster without web search
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      expect(results.length).toBe(totalRequests);
      expect(metrics.p99ResponseTime).toBeLessThan(PERFORMANCE_TARGETS.p99ResponseTime);
      expect(metrics.errorRate).toBeLessThan(PERFORMANCE_TARGETS.errorRate);

      console.log(`20 concurrent requests - Avg: ${metrics.averageResponseTime}ms, P95: ${metrics.p95ResponseTime}ms, P99: ${metrics.p99ResponseTime}ms, Throughput: ${metrics.throughput.toFixed(2)} req/s`);
    });

    it('should handle 50 concurrent requests', async () => {
      const query = 'What is neural networks?';
      const concurrency = 50;
      const totalRequests = 50;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: false,
          enableWebSearch: true,
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      expect(metrics.errorRate).toBeLessThan(PERFORMANCE_TARGETS.errorRate);
      expect(metrics.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.minThroughput);

      console.log(`50 concurrent requests - Avg: ${metrics.averageResponseTime}ms, P95: ${metrics.p95ResponseTime}ms, P99: ${metrics.p99ResponseTime}ms, Throughput: ${metrics.throughput.toFixed(2)} req/s, Error Rate: ${metrics.errorRate.toFixed(2)}%`);
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load of 100 requests', async () => {
      const query = 'What is artificial intelligence?';
      const concurrency = 10;
      const totalRequests = 100;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
          maxDocumentChunks: 5,
          maxWebResults: 5,
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      const startTime = Date.now();
      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      expect(results.length).toBe(totalRequests);
      expect(metrics.errorRate).toBeLessThan(PERFORMANCE_TARGETS.errorRate);
      expect(metrics.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.minThroughput);

      console.log(`Load test (100 requests):`);
      console.log(`  Total duration: ${totalDuration}ms`);
      console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  P95 response time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
      console.log(`  P99 response time: ${metrics.p99ResponseTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${metrics.throughput.toFixed(2)} req/s`);
      console.log(`  Error rate: ${metrics.errorRate.toFixed(2)}%`);
      console.log(`  Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
    });

    it('should handle burst load of 200 requests', async () => {
      const query = 'What is machine learning?';
      const concurrency = 50; // High concurrency for burst
      const totalRequests = 200;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: false, // Faster
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      const startTime = Date.now();
      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );
      const endTime = Date.now();

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      expect(metrics.errorRate).toBeLessThan(5); // Allow slightly higher error rate for burst
      expect(metrics.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.minThroughput);

      console.log(`Burst test (200 requests, 50 concurrent):`);
      console.log(`  Total duration: ${endTime - startTime}ms`);
      console.log(`  Throughput: ${metrics.throughput.toFixed(2)} req/s`);
      console.log(`  Error rate: ${metrics.errorRate.toFixed(2)}%`);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with increasing concurrent requests', async () => {
      const query = 'What is AI?';
      const concurrencyLevels = [5, 10, 20, 30];
      const results: { concurrency: number; avgTime: number; throughput: number }[] = [];

      for (const concurrency of concurrencyLevels) {
        const fn = async () => {
          const ragOptions: RAGOptions = {
            userId: testUserId,
            enableDocumentSearch: true,
            enableWebSearch: false,
          };
          return await RAGService.retrieveContext(query, ragOptions);
        };

        const { responseTimes, errors } = await runConcurrentRequests(
          fn,
          concurrency,
          concurrency
        );

        const metrics = calculateMetrics(responseTimes, concurrency, errors.length);
        results.push({
          concurrency,
          avgTime: metrics.averageResponseTime,
          throughput: metrics.throughput,
        });
      }

      // Validate scalability - throughput should not degrade significantly
      const firstThroughput = results[0].throughput;
      const lastThroughput = results[results.length - 1].throughput;
      const degradation = ((firstThroughput - lastThroughput) / firstThroughput) * 100;

      expect(degradation).toBeLessThan(50); // Allow up to 50% degradation

      console.log('Scalability test results:');
      results.forEach(r => {
        console.log(`  ${r.concurrency} concurrent: ${r.avgTime.toFixed(2)}ms avg, ${r.throughput.toFixed(2)} req/s`);
      });
    });

    it('should handle increasing request volume', async () => {
      const query = 'What is machine learning?';
      const volumes = [50, 100, 200, 500];
      const concurrency = 20;

      for (const volume of volumes) {
        const fn = async () => {
          const ragOptions: RAGOptions = {
            userId: testUserId,
            enableDocumentSearch: true,
            enableWebSearch: true,
          };
          return await RAGService.retrieveContext(query, ragOptions);
        };

        const startTime = Date.now();
        const { responseTimes, errors } = await runConcurrentRequests(
          fn,
          concurrency,
          volume
        );
        const endTime = Date.now();

        const metrics = calculateMetrics(responseTimes, volume, errors.length);
        const duration = endTime - startTime;

        expect(metrics.errorRate).toBeLessThan(5); // Allow up to 5% error rate for high volume

        console.log(`Volume test (${volume} requests):`);
        console.log(`  Duration: ${duration}ms`);
        console.log(`  Throughput: ${metrics.throughput.toFixed(2)} req/s`);
        console.log(`  Error rate: ${metrics.errorRate.toFixed(2)}%`);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should establish baseline performance benchmarks', async () => {
      const query = 'What is artificial intelligence?';
      const iterations = 10;

      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
          maxDocumentChunks: 5,
          maxWebResults: 5,
        };
        await RAGService.retrieveContext(query, ragOptions);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const metrics = calculateMetrics(responseTimes, iterations, 0);

      console.log('Baseline Performance Benchmarks:');
      console.log(`  Min: ${metrics.minResponseTime}ms`);
      console.log(`  Max: ${metrics.maxResponseTime}ms`);
      console.log(`  Average: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  P50 (Median): ${metrics.p50ResponseTime}ms`);
      console.log(`  P95: ${metrics.p95ResponseTime}ms`);
      console.log(`  P99: ${metrics.p99ResponseTime}ms`);

      // Store benchmarks for comparison
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.p95ResponseTime).toBeLessThan(PERFORMANCE_TARGETS.p95ResponseTime);
    });

    it('should benchmark document-only performance', async () => {
      const query = 'What is machine learning?';
      const iterations = 10;

      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: false,
          maxDocumentChunks: 5,
        };
        await RAGService.retrieveContext(query, ragOptions);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const metrics = calculateMetrics(responseTimes, iterations, 0);

      console.log('Document-Only Performance Benchmarks:');
      console.log(`  Average: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  P95: ${metrics.p95ResponseTime}ms`);
    });

    it('should benchmark web-only performance', async () => {
      const query = 'Latest AI news';
      const iterations = 10;

      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: false,
          enableWebSearch: true,
          maxWebResults: 5,
        };
        await RAGService.retrieveContext(query, ragOptions);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const metrics = calculateMetrics(responseTimes, iterations, 0);

      console.log('Web-Only Performance Benchmarks:');
      console.log(`  Average: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  P95: ${metrics.p95ResponseTime}ms`);
    });

    it('should benchmark full pipeline performance', async () => {
      const query = 'What is artificial intelligence?';
      const iterations = 5; // Fewer iterations for full pipeline

      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
          maxDocumentChunks: 5,
          maxWebResults: 5,
        };
        const ragContext = await RAGService.retrieveContext(query, ragOptions);
        const questionRequest: QuestionRequest = {
          question: query,
          enableDocumentSearch: true,
          enableWebSearch: true,
        };
        await AIService.answerQuestion(questionRequest);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const metrics = calculateMetrics(responseTimes, iterations, 0);

      console.log('Full Pipeline Performance Benchmarks:');
      console.log(`  Average: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  P95: ${metrics.p95ResponseTime}ms`);
      console.log(`  Min: ${metrics.minResponseTime}ms`);
      console.log(`  Max: ${metrics.maxResponseTime}ms`);
    });
  });

  describe('Component Performance', () => {
    it('should measure embedding generation performance', async () => {
      const queries = ['What is AI?', 'What is ML?', 'What is DL?'];
      const responseTimes: number[] = [];

      for (const query of queries) {
        const startTime = Date.now();
        await EmbeddingService.generateEmbedding(query);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      console.log(`Embedding generation average: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(1000); // Should be fast with mocks
    });

    it('should measure Pinecone search performance', async () => {
      const embedding = new Array(1536).fill(0.1);
      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await PineconeService.search(embedding, {
          userId: testUserId,
          topK: 5,
        });
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      console.log(`Pinecone search average: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(1000);
    });

    it('should measure web search performance', async () => {
      const queries = ['AI', 'Machine Learning', 'Deep Learning'];
      const responseTimes: number[] = [];

      for (const query of queries) {
        const startTime = Date.now();
        await SearchService.search(query, {
          userId: testUserId,
          maxResults: 5,
        });
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      console.log(`Web search average: ${avgTime.toFixed(2)}ms`);
      expect(avgTime).toBeLessThan(2000);
    });
  });

  describe('Performance Under Stress', () => {
    it('should maintain performance under high concurrency', async () => {
      const query = 'What is AI?';
      const concurrency = 100;
      const totalRequests = 100;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: false, // Faster
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      const { results, responseTimes, errors } = await runConcurrentRequests(
        fn,
        concurrency,
        totalRequests
      );

      const metrics = calculateMetrics(responseTimes, totalRequests, errors.length);

      // Under stress, allow higher error rate but should still complete most requests
      expect(metrics.successfulRequests).toBeGreaterThan(totalRequests * 0.8); // At least 80% success
      expect(metrics.throughput).toBeGreaterThan(0);

      console.log(`Stress test (100 concurrent):`);
      console.log(`  Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
      console.log(`  Throughput: ${metrics.throughput.toFixed(2)} req/s`);
      console.log(`  P95: ${metrics.p95ResponseTime}ms`);
    });

    it('should handle memory efficiently under load', async () => {
      const query = 'What is machine learning?';
      const concurrency = 50;
      const totalRequests = 200;

      const initialMemory = process.memoryUsage().heapUsed;

      const fn = async () => {
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
        };
        return await RAGService.retrieveContext(query, ragOptions);
      };

      await runConcurrentRequests(fn, concurrency, totalRequests);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory usage increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      // Memory should not increase excessively (allow up to 500MB for test)
      expect(memoryIncreaseMB).toBeLessThan(500);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const query = 'What is artificial intelligence?';
      const iterations = 20;

      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const ragOptions: RAGOptions = {
          userId: testUserId,
          enableDocumentSearch: true,
          enableWebSearch: true,
          maxDocumentChunks: 5,
          maxWebResults: 5,
        };
        await RAGService.retrieveContext(query, ragOptions);
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const metrics = calculateMetrics(responseTimes, iterations, 0);

      // Check for performance regression
      // P95 should not exceed target significantly
      expect(metrics.p95ResponseTime).toBeLessThan(PERFORMANCE_TARGETS.p95ResponseTime * 1.5); // Allow 50% margin

      console.log('Performance regression check:');
      console.log(`  P95: ${metrics.p95ResponseTime}ms (target: ${PERFORMANCE_TARGETS.p95ResponseTime}ms)`);
      console.log(`  Regression: ${metrics.p95ResponseTime > PERFORMANCE_TARGETS.p95ResponseTime ? 'YES' : 'NO'}`);
    });
  });
});
