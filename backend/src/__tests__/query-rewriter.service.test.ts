import {
  QueryRewriterService,
  QueryRewritingOptions,
} from '../services/query-rewriter.service';

// Mock OpenAI
jest.mock('../config/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

import { openai } from '../config/openai';

describe('QueryRewriterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QueryRewriterService.clearCache();
  });

  describe('rewriteQuery', () => {
    it('should rewrite query into multiple variations', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: [
                  'What is artificial intelligence?',
                  'Explain artificial intelligence',
                  'Define AI',
                ],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery('What is AI?');

      expect(result.originalQuery).toBe('What is AI?');
      expect(result.variations.length).toBeGreaterThan(0);
      expect(result.rewritingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.cached).toBe(false);
    });

    it('should use cached rewrite if available', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['query variation 1', 'query variation 2'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      // First call
      await QueryRewriterService.rewriteQuery('What is AI?', { useCache: true });

      // Second call should use cache
      const cached = await QueryRewriterService.rewriteQuery('What is AI?', { useCache: true });

      expect(cached.cached).toBe(true);
      // Should not call OpenAI again
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should not use cache if disabled', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['query variation 1', 'query variation 2'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      await QueryRewriterService.rewriteQuery('What is AI?', { useCache: false });
      await QueryRewriterService.rewriteQuery('What is AI?', { useCache: false });

      // Should call OpenAI twice
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle empty query', async () => {
      const result = await QueryRewriterService.rewriteQuery('');

      expect(result.originalQuery).toBe('');
      expect(result.variations).toEqual(['']);
      expect(result.rewritingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle LLM errors gracefully', async () => {
      (openai.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      const result = await QueryRewriterService.rewriteQuery('What is AI?');

      // Should fallback to original query
      expect(result.variations).toEqual(['What is AI?']);
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON response',
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery('What is AI?');

      // Should fallback to original query
      expect(result.variations).toEqual(['What is AI?']);
    });

    it('should parse array response format', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify(['variation 1', 'variation 2', 'variation 3']),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery('What is AI?');

      expect(result.variations.length).toBe(3);
      expect(result.variations).toContain('variation 1');
    });

    it('should respect maxVariations option', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['v1', 'v2', 'v3', 'v4', 'v5'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery('What is AI?', {
        maxVariations: 3,
      });

      expect(result.variations.length).toBeLessThanOrEqual(3);
    });

    it('should complete within performance threshold', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['variation 1', 'variation 2'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const startTime = Date.now();
      const result = await QueryRewriterService.rewriteQuery('What is AI?');
      const processingTime = Date.now() - startTime;

      expect(result.rewritingTimeMs).toBeLessThan(1000);
      expect(processingTime).toBeLessThan(1000);
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate results from multiple queries', () => {
      const resultsByQuery = [
        {
          query: 'query 1',
          results: [
            { title: 'Result 1', url: 'http://example.com/1', content: 'Content 1', score: 0.9 },
            { title: 'Result 2', url: 'http://example.com/2', content: 'Content 2', score: 0.8 },
          ],
        },
        {
          query: 'query 2',
          results: [
            { title: 'Result 2', url: 'http://example.com/2', content: 'Content 2', score: 0.85 },
            { title: 'Result 3', url: 'http://example.com/3', content: 'Content 3', score: 0.7 },
          ],
        },
      ];

      const aggregated = QueryRewriterService.aggregateResults(resultsByQuery);

      expect(aggregated.length).toBe(3); // 3 unique results
      expect(aggregated[0].url).toBe('http://example.com/1'); // Highest score
      expect(aggregated[0].aggregatedScore).toBe(0.9);
      // Result 2 should have aggregated score (max of 0.8 and 0.85)
      const result2 = aggregated.find(r => r.url === 'http://example.com/2');
      expect(result2?.aggregatedScore).toBe(0.85);
    });

    it('should deduplicate results by URL', () => {
      const resultsByQuery = [
        {
          query: 'query 1',
          results: [
            { title: 'Result 1', url: 'http://example.com/1', content: 'Content 1', score: 0.9 },
          ],
        },
        {
          query: 'query 2',
          results: [
            { title: 'Result 1 Duplicate', url: 'http://example.com/1', content: 'Content 1', score: 0.8 },
          ],
        },
      ];

      const aggregated = QueryRewriterService.aggregateResults(resultsByQuery);

      expect(aggregated.length).toBe(1);
      expect(aggregated[0].url).toBe('http://example.com/1');
      expect(aggregated[0].aggregatedScore).toBe(0.9); // Max score
    });

    it('should limit results if maxResults specified', () => {
      const resultsByQuery = [
        {
          query: 'query 1',
          results: Array.from({ length: 10 }, (_, i) => ({
            title: `Result ${i}`,
            url: `http://example.com/${i}`,
            content: `Content ${i}`,
            score: 0.9 - i * 0.1,
          })),
        },
      ];

      const aggregated = QueryRewriterService.aggregateResults(resultsByQuery, 5);

      expect(aggregated.length).toBe(5);
    });

    it('should track source queries', () => {
      const resultsByQuery = [
        {
          query: 'query 1',
          results: [
            { title: 'Result 1', url: 'http://example.com/1', content: 'Content 1', score: 0.9 },
          ],
        },
        {
          query: 'query 2',
          results: [
            { title: 'Result 1', url: 'http://example.com/1', content: 'Content 1', score: 0.8 },
          ],
        },
      ];

      const aggregated = QueryRewriterService.aggregateResults(resultsByQuery);

      expect(aggregated[0].sourceQuery).toBeDefined();
      expect(aggregated[0].sourceQuery).toContain('query');
    });

    it('should sort by aggregated score', () => {
      const resultsByQuery = [
        {
          query: 'query 1',
          results: [
            { title: 'Result 1', url: 'http://example.com/1', content: 'Content 1', score: 0.5 },
            { title: 'Result 2', url: 'http://example.com/2', content: 'Content 2', score: 0.9 },
          ],
        },
      ];

      const aggregated = QueryRewriterService.aggregateResults(resultsByQuery);

      expect(aggregated[0].url).toBe('http://example.com/2'); // Higher score first
      expect(aggregated[0].aggregatedScore).toBe(0.9);
    });

    it('should handle empty results', () => {
      const aggregated = QueryRewriterService.aggregateResults([]);

      expect(aggregated).toEqual([]);
    });

    it('should handle results without scores', () => {
      const resultsByQuery = [
        {
          query: 'query 1',
          results: [
            { title: 'Result 1', url: 'http://example.com/1', content: 'Content 1' },
          ],
        },
      ];

      const aggregated = QueryRewriterService.aggregateResults(resultsByQuery);

      expect(aggregated.length).toBe(1);
      expect(aggregated[0].score).toBe(0);
      expect(aggregated[0].aggregatedScore).toBe(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      QueryRewriterService.clearCache();
      const stats = QueryRewriterService.getCacheStats();

      expect(stats.size).toBe(0);
    });

    it('should get cache statistics', () => {
      const stats = QueryRewriterService.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(typeof stats.size).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('should handle very long queries', async () => {
      const longQuery = 'What is '.repeat(100) + 'AI?';
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['variation 1'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery(longQuery);

      expect(result.variations.length).toBeGreaterThan(0);
    });

    it('should handle special characters in queries', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['variation 1'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery('What is AI? 🚀');

      expect(result.variations.length).toBeGreaterThan(0);
    });

    it('should remove duplicate variations', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                variations: ['variation 1', 'variation 1', 'variation 2'],
              }),
            },
          },
        ],
      };

      (openai.chat.completions.create as jest.Mock).mockResolvedValue(mockResponse);

      const result = await QueryRewriterService.rewriteQuery('What is AI?');

      // Should remove duplicates
      const uniqueVariations = Array.from(new Set(result.variations));
      expect(result.variations.length).toBe(uniqueVariations.length);
    });
  });
});
