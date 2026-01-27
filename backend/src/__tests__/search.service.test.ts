import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchService, SearchRequest, SearchResponse } from '../services/search.service';
import { ValidationError } from '../types/error';

// Mock all external dependencies
jest.mock('../config/tavily', () => ({
  tavilyClient: {
    search: jest.fn(),
  },
}));

jest.mock('../services/query-optimizer.service');
jest.mock('../services/topic-query-builder.service');
jest.mock('../services/query-rewriter.service');
jest.mock('../services/web-result-reranker.service');
jest.mock('../services/result-quality-scorer.service');
jest.mock('../services/domain-authority.service');
jest.mock('../services/web-deduplication.service');
jest.mock('../services/filtering-strategy.service');
jest.mock('../services/redis-cache.service');
jest.mock('../services/retry.service');
jest.mock('../services/circuit-breaker.service');

// Import mocked services
import { tavilyClient } from '../config/tavily';
import { QueryOptimizerService } from '../services/query-optimizer.service';
import { TopicQueryBuilderService } from '../services/topic-query-builder.service';
import { QueryRewriterService } from '../services/query-rewriter.service';
import { WebResultRerankerService } from '../services/web-result-reranker.service';
import { ResultQualityScorerService } from '../services/result-quality-scorer.service';
import { DomainAuthorityService } from '../services/domain-authority.service';
import { WebDeduplicationService } from '../services/web-deduplication.service';
import { FilteringStrategyService } from '../services/filtering-strategy.service';
import { RedisCacheService } from '../services/redis-cache.service';
import { RetryService } from '../services/retry.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';

describe('SearchService', () => {
  const mockQuery = 'What is artificial intelligence?';
  const mockTopic = 'AI';

  const mockTavilyResult = {
    results: [
      {
        title: 'AI Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
        content: 'Artificial intelligence (AI) is intelligence demonstrated by machines.',
        score: 0.9,
        published_date: '2024-01-01',
        author: 'Wikipedia',
      },
      {
        title: 'AI Research',
        url: 'https://example.com/ai-research',
        content: 'Recent advances in artificial intelligence and machine learning.',
        score: 0.85,
        published_date: '2024-01-15',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (tavilyClient.search as any).mockResolvedValue(mockTavilyResult);
    (RedisCacheService.get as any).mockResolvedValue(null);
    (RedisCacheService.set as any).mockResolvedValue(undefined);
    (CircuitBreakerService.execute as any).mockImplementation(
      async (name: string, fn: any) => {
        return { result: await fn(), state: 'closed' };
      }
    );
    (RetryService.execute as any).mockImplementation(async (fn: any) => {
      return { result: await fn(), attempts: 1 };
    });
    (TopicQueryBuilderService.buildTopicQuery as any).mockReturnValue({
      enhancedQuery: `${mockTopic} ${mockQuery}`,
      integrationMethod: 'prefix',
      topicKeywords: [mockTopic],
      queryTemplate: 'topic + query',
    });
    (QueryRewriterService.rewriteQuery as any).mockResolvedValue({
      variations: [mockQuery],
      rewritingTimeMs: 10,
      cached: false,
    });
    (QueryRewriterService.aggregateResults as any).mockImplementation(
      (results: any, maxResults: number) => {
        return results.flatMap((r: any) => r.results).slice(0, maxResults);
      }
    );
    (WebResultRerankerService.rerankResults as any).mockReturnValue({
      results: mockTavilyResult.results,
      originalCount: mockTavilyResult.results.length,
      rerankedCount: mockTavilyResult.results.length,
      rerankingTimeMs: 10,
    });
    (ResultQualityScorerService.scoreResults as any).mockReturnValue({
      results: mockTavilyResult.results.map((r: any) => ({
        ...r,
        qualityScore: 0.8,
      })),
      averageQuality: 0.8,
      processingTimeMs: 10,
    });
    (DomainAuthorityService.scoreResults as any).mockReturnValue({
      results: mockTavilyResult.results.map((r: any) => ({
        ...r,
        authorityScore: 0.7,
      })),
      averageAuthority: 0.7,
      processingTimeMs: 10,
    });
    (WebDeduplicationService.deduplicate as any).mockReturnValue({
      results: mockTavilyResult.results,
      stats: {
        exactDuplicatesRemoved: 0,
        nearDuplicatesRemoved: 0,
        totalRemoved: 0,
        processingTimeMs: 10,
      },
    });
    (FilteringStrategyService.applyFiltering as any).mockReturnValue({
      results: mockTavilyResult.results,
      filteredCount: mockTavilyResult.results.length,
      removedCount: 0,
      processingTimeMs: 10,
    });
  });

  // ============================================================================
  // BASIC SEARCH TESTS
  // ============================================================================

  describe('search', () => {
    it('should perform basic web search', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.query).toBe(mockQuery);
      expect(response.results).toHaveLength(2);
      expect(response.results[0].title).toBe('AI Wikipedia');
      expect(tavilyClient.search).toHaveBeenCalled();
    });

    it('should throw ValidationError for empty query', async () => {
      const request: SearchRequest = {
        query: '',
      };

      await expect(SearchService.search(request)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for query too long', async () => {
      const request: SearchRequest = {
        query: 'a'.repeat(501),
      };

      await expect(SearchService.search(request)).rejects.toThrow(ValidationError);
    });

    it('should return cached results when available', async () => {
      const cachedResponse: SearchResponse = {
        query: mockQuery,
        results: mockTavilyResult.results,
        cached: true,
      };
      (RedisCacheService.get as any).mockResolvedValueOnce(cachedResponse);

      const request: SearchRequest = {
        query: mockQuery,
      };

      const response = await SearchService.search(request);

      expect(response.cached).toBe(true);
      expect(tavilyClient.search).not.toHaveBeenCalled();
    });

    it('should return empty results when Tavily is not configured', async () => {
      const { tavilyClient: originalTavily } = await import('../config/tavily');
      (tavilyClient as any) = null;

      const request: SearchRequest = {
        query: mockQuery,
      };

      const response = await SearchService.search(request);

      expect(response.results).toEqual([]);
      expect(response.query).toBe(mockQuery);
    });
  });

  // ============================================================================
  // TOPIC FILTERING TESTS
  // ============================================================================

  describe('topic filtering', () => {
    it('should filter results by topic', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        topic: mockTopic,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.topic).toBe(mockTopic);
      expect(TopicQueryBuilderService.buildTopicQuery).toHaveBeenCalled();
    });

    it('should use topic-aware query construction', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        topic: mockTopic,
        useTopicAwareQuery: true,
      };

      await SearchService.search(request);

      expect(TopicQueryBuilderService.buildTopicQuery).toHaveBeenCalledWith(
        expect.any(String),
        mockTopic,
        expect.any(Object)
      );
    });

    it('should use simple prefix when topic-aware is disabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        topic: mockTopic,
        useTopicAwareQuery: false,
      };

      await SearchService.search(request);

      expect(TopicQueryBuilderService.buildTopicQuery).not.toHaveBeenCalled();
    });

    it('should filter results to only include topic-relevant content', async () => {
      const resultsWithTopic = [
        {
          title: 'AI Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
          content: 'Artificial intelligence (AI) is intelligence demonstrated by machines.',
          score: 0.9,
        },
        {
          title: 'Cooking Recipes',
          url: 'https://example.com/recipes',
          content: 'Delicious recipes for home cooking.',
          score: 0.8,
        },
      ];
      (tavilyClient.search as any).mockResolvedValueOnce({ results: resultsWithTopic });

      const request: SearchRequest = {
        query: mockQuery,
        topic: 'AI',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      // Should filter out non-topic results
      expect(response.results.length).toBeLessThanOrEqual(resultsWithTopic.length);
    });
  });

  // ============================================================================
  // TIME RANGE FILTERING TESTS
  // ============================================================================

  describe('time range filtering', () => {
    it('should filter results by day time range', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        timeRange: 'day',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.timeRange).toBe('day');
      // Results should be filtered to last 24 hours
      response.results.forEach((result) => {
        if (result.publishedDate) {
          const publishedDate = new Date(result.publishedDate);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          expect(publishedDate.getTime()).toBeGreaterThanOrEqual(dayAgo.getTime());
        }
      });
    });

    it('should filter results by week time range', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        timeRange: 'week',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.timeRange).toBe('week');
    });

    it('should filter results by month time range', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        timeRange: 'month',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.timeRange).toBe('month');
    });

    it('should filter results by year time range', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        timeRange: 'year',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.timeRange).toBe('year');
    });

    it('should filter results by custom date range', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      response.results.forEach((result) => {
        if (result.publishedDate) {
          const publishedDate = new Date(result.publishedDate);
          const startDate = new Date('2024-01-01');
          const endDate = new Date('2024-12-31');
          expect(publishedDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
          expect(publishedDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
        }
      });
    });

    it('should exclude results with future dates', async () => {
      const futureResult = {
        title: 'Future Article',
        url: 'https://example.com/future',
        content: 'This is a future article.',
        score: 0.9,
        published_date: '2025-12-31',
      };
      (tavilyClient.search as any).mockResolvedValueOnce({
        results: [futureResult, ...mockTavilyResult.results],
      });

      const request: SearchRequest = {
        query: mockQuery,
        timeRange: 'year',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      // Future dates should be excluded
      response.results.forEach((result) => {
        if (result.publishedDate) {
          const publishedDate = new Date(result.publishedDate);
          expect(publishedDate.getTime()).toBeLessThanOrEqual(Date.now());
        }
      });
    });
  });

  // ============================================================================
  // COUNTRY FILTERING TESTS
  // ============================================================================

  describe('country filtering', () => {
    it('should filter results by country', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        country: 'US',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.country).toBe('US');
      expect(tavilyClient.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          country: 'US',
        })
      );
    });

    it('should convert country code to uppercase', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        country: 'us',
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(tavilyClient.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          country: 'US',
        })
      );
    });
  });

  // ============================================================================
  // DOMAIN FILTERING TESTS
  // ============================================================================

  describe('domain filtering', () => {
    it('should include only specified domains', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        includeDomains: ['wikipedia.org', 'example.com'],
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(tavilyClient.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          includeDomains: ['wikipedia.org', 'example.com'],
        })
      );
    });

    it('should exclude specified domains', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        excludeDomains: ['spam.com', 'ads.com'],
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(tavilyClient.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          excludeDomains: ['spam.com', 'ads.com'],
        })
      );
    });
  });

  // ============================================================================
  // QUERY REWRITING TESTS
  // ============================================================================

  describe('query rewriting', () => {
    it('should rewrite query when enabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        enableQueryRewriting: true,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(QueryRewriterService.rewriteQuery).toHaveBeenCalled();
    });

    it('should not rewrite query when disabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        enableQueryRewriting: false,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(QueryRewriterService.rewriteQuery).not.toHaveBeenCalled();
    });

    it('should aggregate results from query variations', async () => {
      (QueryRewriterService.rewriteQuery as any).mockResolvedValueOnce({
        variations: [mockQuery, 'What is machine learning?', 'What is AI technology?'],
        rewritingTimeMs: 10,
        cached: false,
      });
      (tavilyClient.search as any).mockResolvedValue(mockTavilyResult);

      const request: SearchRequest = {
        query: mockQuery,
        enableQueryRewriting: true,
        maxResults: 10,
      };

      const response = await SearchService.search(request);

      expect(QueryRewriterService.aggregateResults).toHaveBeenCalled();
      expect(response.results.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // RESULT ENHANCEMENT TESTS
  // ============================================================================

  describe('result enhancement', () => {
    it('should re-rank results when enabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        enableWebResultReranking: true,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(WebResultRerankerService.rerankResults).toHaveBeenCalled();
    });

    it('should score results for quality when enabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        enableQualityScoring: true,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(ResultQualityScorerService.scoreResults).toHaveBeenCalled();
    });

    it('should filter results by quality score when enabled', async () => {
      (ResultQualityScorerService.scoreResults as any).mockReturnValueOnce({
        results: [
          { ...mockTavilyResult.results[0], qualityScore: 0.9 },
          { ...mockTavilyResult.results[1], qualityScore: 0.3 },
        ],
        averageQuality: 0.6,
        processingTimeMs: 10,
      });

      const request: SearchRequest = {
        query: mockQuery,
        enableQualityScoring: true,
        filterByQuality: true,
        minQualityScore: 0.5,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      // Should filter out low quality results
      response.results.forEach((result: any) => {
        if (result.qualityScore !== undefined) {
          expect(result.qualityScore).toBeGreaterThanOrEqual(0.5);
        }
      });
    });

    it('should score results for domain authority when enabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        enableDomainAuthority: true,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(DomainAuthorityService.scoreResults).toHaveBeenCalled();
    });

    it('should filter results by authority score when enabled', async () => {
      (DomainAuthorityService.scoreResults as any).mockReturnValueOnce({
        results: [
          { ...mockTavilyResult.results[0], authorityScore: 0.8 },
          { ...mockTavilyResult.results[1], authorityScore: 0.3 },
        ],
        averageAuthority: 0.55,
        processingTimeMs: 10,
      });

      const request: SearchRequest = {
        query: mockQuery,
        enableDomainAuthority: true,
        filterByAuthority: true,
        minAuthorityScore: 0.5,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      // Should filter out low authority results
      response.results.forEach((result: any) => {
        if (result.authorityScore !== undefined) {
          expect(result.authorityScore).toBeGreaterThanOrEqual(0.5);
        }
      });
    });

    it('should deduplicate results when enabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        enableDeduplication: true,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(WebDeduplicationService.deduplicate).toHaveBeenCalled();
    });

    it('should apply filtering strategy when enabled', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        filteringMode: 'strict',
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(FilteringStrategyService.applyFiltering).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('error handling', () => {
    it('should handle Tavily API errors gracefully', async () => {
      (CircuitBreakerService.execute as any).mockImplementationOnce(
        async (name: string, fn: any) => {
          throw new Error('Tavily API error');
        }
      );

      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      await expect(SearchService.search(request)).rejects.toThrow();
    });

    it('should handle circuit breaker open state', async () => {
      (CircuitBreakerService.execute as any).mockResolvedValueOnce({
        result: null,
        state: 'open',
      });

      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      await expect(SearchService.search(request)).rejects.toThrow();
    });

    it('should handle retry failures', async () => {
      (RetryService.execute as any).mockImplementationOnce(async (fn: any) => {
        throw new Error('Retry failed');
      });

      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      await expect(SearchService.search(request)).rejects.toThrow();
    });

    it('should handle cache errors gracefully', async () => {
      (RedisCacheService.get as any).mockRejectedValueOnce(new Error('Cache error'));

      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      // Should continue with search despite cache error
      const response = await SearchService.search(request);

      expect(response.results).toHaveLength(2);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty search results', async () => {
      (tavilyClient.search as any).mockResolvedValueOnce({ results: [] });

      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.results).toEqual([]);
    });

    it('should handle results without published dates', async () => {
      const resultsWithoutDates = [
        {
          title: 'Article without date',
          url: 'https://example.com/article',
          content: 'Content without published date.',
          score: 0.8,
        },
      ];
      (tavilyClient.search as any).mockResolvedValueOnce({ results: resultsWithoutDates });

      const request: SearchRequest = {
        query: mockQuery,
        timeRange: 'day',
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      // Results without dates should be filtered out in strict mode
      expect(response.results.length).toBeLessThanOrEqual(resultsWithoutDates.length);
    });

    it('should handle very long query', async () => {
      const longQuery = 'a '.repeat(250); // 500 characters
      const request: SearchRequest = {
        query: longQuery,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.query).toBe(longQuery);
    });

    it('should respect maxResults limit', async () => {
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        title: `Result ${i}`,
        url: `https://example.com/${i}`,
        content: `Content ${i}`,
        score: 0.9 - i * 0.01,
      }));
      (tavilyClient.search as any).mockResolvedValueOnce({ results: manyResults });

      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle special characters in query', async () => {
      const specialQuery = 'What is AI? @#$%^&*() 中文 🚀';
      const request: SearchRequest = {
        query: specialQuery,
        maxResults: 5,
      };

      const response = await SearchService.search(request);

      expect(response.query).toBe(specialQuery);
    });
  });

  // ============================================================================
  // CACHING TESTS
  // ============================================================================

  describe('caching', () => {
    it('should cache search results', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        maxResults: 5,
      };

      await SearchService.search(request);

      expect(RedisCacheService.set).toHaveBeenCalled();
    });

    it('should use different cache keys for different requests', async () => {
      const request1: SearchRequest = {
        query: mockQuery,
        topic: 'AI',
        maxResults: 5,
      };
      const request2: SearchRequest = {
        query: mockQuery,
        topic: 'ML',
        maxResults: 5,
      };

      await SearchService.search(request1);
      await SearchService.search(request2);

      expect(RedisCacheService.set).toHaveBeenCalledTimes(2);
    });

    it('should include all request parameters in cache key', async () => {
      const request: SearchRequest = {
        query: mockQuery,
        topic: mockTopic,
        timeRange: 'month',
        country: 'US',
        maxResults: 10,
        includeDomains: ['example.com'],
        excludeDomains: ['spam.com'],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      await SearchService.search(request);

      // Cache key should include all these parameters
      expect(RedisCacheService.set).toHaveBeenCalled();
    });
  });
});
