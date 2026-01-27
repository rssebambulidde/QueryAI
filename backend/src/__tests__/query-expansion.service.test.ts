import { QueryExpansionService, ExpandedQuery, ExpansionStrategy } from '../services/query-expansion.service';
import { openai } from '../config/openai';

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

describe('QueryExpansionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QueryExpansionService.clearCache();
  });

  describe('expandQuery', () => {
    it('should return original query when strategy is none', async () => {
      const result = await QueryExpansionService.expandQuery('test query', {
        strategy: 'none',
      });

      expect(result.originalQuery).toBe('test query');
      expect(result.expandedQuery).toBe('test query');
      expect(result.expandedTerms).toEqual([]);
      expect(result.strategy).toBe('none');
    });

    it('should expand query using LLM strategy', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'related term, synonym, alternative phrase',
            },
          },
        ],
      });

      const result = await QueryExpansionService.expandQuery('artificial intelligence', {
        strategy: 'llm',
        maxExpansions: 3,
      });

      expect(result.originalQuery).toBe('artificial intelligence');
      expect(result.expandedTerms.length).toBeGreaterThan(0);
      expect(result.expandedQuery).toContain('artificial intelligence');
      expect(result.strategy).toBe('llm');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should expand query using embedding strategy', async () => {
      const result = await QueryExpansionService.expandQuery('help me learn AI', {
        strategy: 'embedding',
        maxExpansions: 5,
      });

      expect(result.originalQuery).toBe('help me learn AI');
      expect(result.strategy).toBe('embedding');
      // Embedding strategy may or may not find synonyms depending on the synonym map
      expect(result.expandedTerms).toBeDefined();
    });

    it('should expand query using hybrid strategy', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'machine learning, neural networks, deep learning',
            },
          },
        ],
      });

      const result = await QueryExpansionService.expandQuery('AI technology', {
        strategy: 'hybrid',
        maxExpansions: 5,
      });

      expect(result.originalQuery).toBe('AI technology');
      expect(result.strategy).toBe('hybrid');
      expect(result.expandedTerms).toBeDefined();
    });

    it('should use cache when available', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2, term3',
            },
          },
        ],
      });

      // First call - should hit LLM
      const result1 = await QueryExpansionService.expandQuery('test query', {
        strategy: 'llm',
        useCache: true,
      });

      // Second call - should use cache
      const result2 = await QueryExpansionService.expandQuery('test query', {
        strategy: 'llm',
        useCache: true,
      });

      expect(result1).toEqual(result2);
      // Should only call LLM once
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should not use cache when disabled', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2',
            },
          },
        ],
      });

      await QueryExpansionService.expandQuery('test query', {
        strategy: 'llm',
        useCache: false,
      });

      await QueryExpansionService.expandQuery('test query', {
        strategy: 'llm',
        useCache: false,
      });

      // Should call LLM twice
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should handle LLM errors gracefully', async () => {
      (openai.chat.completions.create as jest.Mock).mockRejectedValue(
        new Error('API error')
      );

      await expect(
        QueryExpansionService.expandQuery('test query', {
          strategy: 'llm',
        })
      ).rejects.toThrow();
    });

    it('should limit expansion terms to maxExpansions', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2, term3, term4, term5, term6, term7',
            },
          },
        ],
      });

      const result = await QueryExpansionService.expandQuery('test', {
        strategy: 'llm',
        maxExpansions: 3,
      });

      expect(result.expandedTerms.length).toBeLessThanOrEqual(3);
    });

    it('should filter out duplicate terms and original query', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2, test, term3', // 'test' is the original query
            },
          },
        ],
      });

      const result = await QueryExpansionService.expandQuery('test', {
        strategy: 'llm',
        maxExpansions: 10,
      });

      // Should not include the original query in expanded terms
      expect(result.expandedTerms).not.toContain('test');
      // All terms should be unique
      const uniqueTerms = new Set(result.expandedTerms);
      expect(result.expandedTerms.length).toBe(uniqueTerms.size);
    });
  });

  describe('expandQueries', () => {
    it('should expand multiple queries in batch', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2',
            },
          },
        ],
      });

      const queries = ['query1', 'query2', 'query3'];
      const results = await QueryExpansionService.expandQueries(queries, {
        strategy: 'llm',
      });

      expect(results.length).toBe(3);
      results.forEach((result, index) => {
        expect(result.originalQuery).toBe(queries[index]);
      });
    });

    it('should handle errors in batch expansion gracefully', async () => {
      (openai.chat.completions.create as jest.Mock)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'term1' } }],
        })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'term2' } }],
        });

      const queries = ['query1', 'query2', 'query3'];
      const results = await QueryExpansionService.expandQueries(queries, {
        strategy: 'llm',
      });

      expect(results.length).toBe(3);
      // First and third should succeed
      expect(results[0].expandedTerms.length).toBeGreaterThan(0);
      expect(results[2].expandedTerms.length).toBeGreaterThan(0);
      // Second should have no expansion due to error
      expect(results[1].expandedTerms).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      QueryExpansionService.clearCache();
      const stats = QueryExpansionService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toBe(0);
    });

    it('should return cache statistics', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2',
            },
          },
        ],
      });

      await QueryExpansionService.expandQuery('query1', { strategy: 'llm' });
      await QueryExpansionService.expandQuery('query2', { strategy: 'llm' });

      const stats = QueryExpansionService.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries).toBeGreaterThan(0);
    });
  });

  describe('query normalization', () => {
    it('should normalize queries for caching', async () => {
      (openai.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'term1, term2',
            },
          },
        ],
      });

      // First call with different casing/spacing
      await QueryExpansionService.expandQuery('  Test Query  ', {
        strategy: 'llm',
        useCache: true,
      });

      // Second call with normalized version
      const result = await QueryExpansionService.expandQuery('test query', {
        strategy: 'llm',
        useCache: true,
      });

      // Should use cache (only one LLM call)
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
      // originalQuery should be from the current call
      expect(result.originalQuery).toBe('test query');
      // But cache should be used (same expansion terms)
      expect(result.expandedTerms.length).toBeGreaterThan(0);
      // Expanded query should contain current query and expansion terms
      expect(result.expandedQuery).toContain('test query');
      expect(result.expandedQuery.length).toBeGreaterThan('test query'.length);
    });
  });
});
