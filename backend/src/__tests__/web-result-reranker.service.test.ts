import {
  WebResultRerankerService,
  RerankingConfig,
  DEFAULT_RERANKING_CONFIG,
} from '../services/web-result-reranker.service';
import { SearchResult } from '../services/search.service';

describe('WebResultRerankerService', () => {
  beforeEach(() => {
    // Reset to default config
    WebResultRerankerService.setConfig(DEFAULT_RERANKING_CONFIG);
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig: Partial<RerankingConfig> = {
        relevanceWeight: 0.5,
        domainAuthorityWeight: 0.3,
        freshnessWeight: 0.2,
      };

      WebResultRerankerService.setConfig(customConfig);
      const config = WebResultRerankerService.getConfig();

      expect(config.relevanceWeight).toBe(0.5);
      expect(config.domainAuthorityWeight).toBe(0.3);
      expect(config.freshnessWeight).toBe(0.2);
    });

    it('should have valid default configuration', () => {
      const config = WebResultRerankerService.getConfig();

      expect(config.relevanceWeight).toBeGreaterThan(0);
      expect(config.domainAuthorityWeight).toBeGreaterThan(0);
      expect(config.freshnessWeight).toBeGreaterThan(0);
      expect(config.originalScoreWeight).toBeGreaterThan(0);
      // Weights should sum to approximately 1.0
      const totalWeight =
        config.relevanceWeight +
        config.domainAuthorityWeight +
        config.freshnessWeight +
        config.originalScoreWeight;
      expect(totalWeight).toBeCloseTo(1.0, 1);
    });
  });

  describe('domain authority scoring', () => {
    it('should score trusted domains higher', () => {
      const trustedResult: SearchResult = {
        title: 'Test',
        url: 'https://en.wikipedia.org/wiki/Test',
        content: 'Test content',
        score: 0.5,
      };

      const untrustedResult: SearchResult = {
        title: 'Test',
        url: 'https://random-blog.com/test',
        content: 'Test content',
        score: 0.5,
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults(
        [trustedResult, untrustedResult],
        query
      );

      // Wikipedia should have higher domain authority score
      const wikipediaResult = reranked.results.find(r => r.url.includes('wikipedia'));
      const randomResult = reranked.results.find(r => r.url.includes('random-blog'));

      expect(wikipediaResult?.domainAuthorityScore).toBeGreaterThan(
        randomResult?.domainAuthorityScore || 0
      );
    });

    it('should boost .edu domains', () => {
      const eduResult: SearchResult = {
        title: 'Test',
        url: 'https://mit.edu/test',
        content: 'Test content',
        score: 0.5,
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults([eduResult], query);

      expect(reranked.results[0].domainAuthorityScore).toBeGreaterThan(0.7);
    });

    it('should boost .gov domains', () => {
      const govResult: SearchResult = {
        title: 'Test',
        url: 'https://nih.gov/test',
        content: 'Test content',
        score: 0.5,
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults([govResult], query);

      expect(reranked.results[0].domainAuthorityScore).toBeGreaterThan(0.7);
    });

    it('should handle invalid URLs', () => {
      const invalidResult: SearchResult = {
        title: 'Test',
        url: 'invalid-url',
        content: 'Test content',
        score: 0.5,
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults([invalidResult], query);

      expect(reranked.results[0].domainAuthorityScore).toBeGreaterThanOrEqual(0);
      expect(reranked.results[0].domainAuthorityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('freshness scoring', () => {
    it('should score recent results higher', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000); // 400 days ago

      const recentResult: SearchResult = {
        title: 'Recent Test',
        url: 'https://example.com/recent',
        content: 'Recent content',
        score: 0.5,
        publishedDate: recentDate.toISOString(),
      };

      const oldResult: SearchResult = {
        title: 'Old Test',
        url: 'https://example.com/old',
        content: 'Old content',
        score: 0.5,
        publishedDate: oldDate.toISOString(),
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults(
        [recentResult, oldResult],
        query
      );

      const recentReranked = reranked.results.find(r => r.url.includes('recent'));
      const oldReranked = reranked.results.find(r => r.url.includes('old'));

      expect(recentReranked?.freshnessScore).toBeGreaterThan(oldReranked?.freshnessScore || 0);
    });

    it('should handle missing published dates', () => {
      const result: SearchResult = {
        title: 'Test',
        url: 'https://example.com/test',
        content: 'Test content',
        score: 0.5,
        // No publishedDate
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].freshnessScore).toBeGreaterThanOrEqual(0);
      expect(reranked.results[0].freshnessScore).toBeLessThanOrEqual(1);
    });

    it('should penalize future dates', () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year in future

      const result: SearchResult = {
        title: 'Test',
        url: 'https://example.com/test',
        content: 'Test content',
        score: 0.5,
        publishedDate: futureDate.toISOString(),
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].freshnessScore).toBeLessThan(0.5);
    });

    it('should handle invalid date formats', () => {
      const result: SearchResult = {
        title: 'Test',
        url: 'https://example.com/test',
        content: 'Test content',
        score: 0.5,
        publishedDate: 'invalid-date',
      };

      const query = 'test query';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].freshnessScore).toBeDefined();
      if (reranked.results[0].freshnessScore !== undefined) {
        expect(reranked.results[0].freshnessScore).toBeGreaterThanOrEqual(0);
        expect(reranked.results[0].freshnessScore).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('relevance scoring', () => {
    it('should score results with query keywords in title higher', () => {
      const relevantResult: SearchResult = {
        title: 'Artificial Intelligence Explained',
        url: 'https://example.com/ai',
        content: 'Some content',
        score: 0.5,
      };

      const lessRelevantResult: SearchResult = {
        title: 'Random Article',
        url: 'https://example.com/random',
        content: 'Some content',
        score: 0.5,
      };

      const query = 'artificial intelligence';
      const reranked = WebResultRerankerService.rerankResults(
        [relevantResult, lessRelevantResult],
        query
      );

      const relevantReranked = reranked.results.find(r => r.title.includes('Artificial'));
      const lessRelevantReranked = reranked.results.find(r => r.title.includes('Random'));

      expect(relevantReranked?.relevanceScore).toBeGreaterThan(
        lessRelevantReranked?.relevanceScore || 0
      );
    });

    it('should score results with query keywords in content', () => {
      const relevantResult: SearchResult = {
        title: 'Test Article',
        url: 'https://example.com/test',
        content: 'This article discusses machine learning and neural networks in detail.',
        score: 0.5,
      };

      const lessRelevantResult: SearchResult = {
        title: 'Test Article',
        url: 'https://example.com/test2',
        content: 'This article discusses something else.',
        score: 0.5,
      };

      const query = 'machine learning neural networks';
      const reranked = WebResultRerankerService.rerankResults(
        [relevantResult, lessRelevantResult],
        query
      );

      const relevantReranked = reranked.results.find(r => r.content.includes('machine learning'));
      const lessRelevantReranked = reranked.results.find(r => !r.content.includes('machine learning'));

      expect(relevantReranked?.relevanceScore).toBeGreaterThan(
        lessRelevantReranked?.relevanceScore || 0
      );
    });

    it('should boost exact phrase matches in title', () => {
      const exactMatch: SearchResult = {
        title: 'What is Artificial Intelligence?',
        url: 'https://example.com/exact',
        content: 'Content',
        score: 0.5,
      };

      const partialMatch: SearchResult = {
        title: 'Artificial and Intelligence',
        url: 'https://example.com/partial',
        content: 'Content',
        score: 0.5,
      };

      const query = 'artificial intelligence';
      const reranked = WebResultRerankerService.rerankResults(
        [exactMatch, partialMatch],
        query
      );

      const exactReranked = reranked.results.find(r => r.title.includes('What is'));
      const partialReranked = reranked.results.find(r => r.title.includes('Artificial and'));

      expect(exactReranked?.relevanceScore).toBeGreaterThan(
        partialReranked?.relevanceScore || 0
      );
    });
  });

  describe('rerankResults', () => {
    it('should re-rank results by combined score', () => {
      const results: SearchResult[] = [
        {
          title: 'Test Article 1',
          url: 'https://example.com/1',
          content: 'Test content 1',
          score: 0.5,
        },
        {
          title: 'Test Article 2',
          url: 'https://wikipedia.org/wiki/Test',
          content: 'Test content 2',
          score: 0.4,
        },
        {
          title: 'Test Article 3',
          url: 'https://mit.edu/test',
          content: 'Test content 3',
          score: 0.3,
        },
      ];

      const query = 'test article';
      const reranked = WebResultRerankerService.rerankResults(results, query);

      expect(reranked.results.length).toBe(3);
      expect(reranked.originalCount).toBe(3);
      expect(reranked.rerankingTimeMs).toBeGreaterThanOrEqual(0);

      // Results should be sorted by rerankedScore (descending)
      for (let i = 0; i < reranked.results.length - 1; i++) {
        expect(reranked.results[i].rerankedScore).toBeGreaterThanOrEqual(
          reranked.results[i + 1].rerankedScore
        );
      }
    });

    it('should include ranking factors', () => {
      const result: SearchResult = {
        title: 'Test Article',
        url: 'https://wikipedia.org/wiki/Test',
        content: 'Test content',
        score: 0.8,
        publishedDate: new Date().toISOString(),
      };

      const query = 'test article';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].rankingFactors).toBeDefined();
      expect(reranked.results[0].rankingFactors?.relevance).toBeGreaterThanOrEqual(0);
      expect(reranked.results[0].rankingFactors?.domainAuthority).toBeGreaterThanOrEqual(0);
      expect(reranked.results[0].rankingFactors?.freshness).toBeGreaterThanOrEqual(0);
      expect(reranked.results[0].rankingFactors?.originalScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty results', () => {
      const reranked = WebResultRerankerService.rerankResults([], 'test query');

      expect(reranked.results).toEqual([]);
      expect(reranked.originalCount).toBe(0);
    });

    it('should complete within performance threshold', () => {
      const results: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        title: `Test Article ${i}`,
        url: `https://example.com/${i}`,
        content: `Test content ${i}`,
        score: 0.5,
      }));

      const startTime = Date.now();
      const reranked = WebResultRerankerService.rerankResults(results, 'test query');
      const processingTime = Date.now() - startTime;

      expect(reranked.rerankingTimeMs).toBeLessThan(200);
      expect(processingTime).toBeLessThan(200);
    });

    it('should respect custom configuration', () => {
      const customConfig: Partial<RerankingConfig> = {
        relevanceWeight: 0.6,
        domainAuthorityWeight: 0.2,
        freshnessWeight: 0.1,
        originalScoreWeight: 0.1,
      };

      const result: SearchResult = {
        title: 'Test Article',
        url: 'https://example.com/test',
        content: 'Test content',
        score: 0.5,
      };

      const query = 'test article';
      const reranked = WebResultRerankerService.rerankResults([result], query, customConfig);

      // With higher relevance weight, relevance should have more impact
      expect(reranked.results[0].rerankedScore).toBeDefined();
    });
  });

  describe('quickRerank', () => {
    it('should quickly re-rank results', () => {
      const results: SearchResult[] = [
        {
          title: 'Test Article 1',
          url: 'https://example.com/1',
          content: 'Test content 1',
          score: 0.5,
        },
        {
          title: 'Test Article 2',
          url: 'https://example.com/2',
          content: 'Test content 2',
          score: 0.4,
        },
      ];

      const reranked = WebResultRerankerService.quickRerank(results, 'test article');

      expect(reranked.length).toBe(2);
      expect(reranked[0].rerankedScore).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle results without scores', () => {
      const result: SearchResult = {
        title: 'Test',
        url: 'https://example.com/test',
        content: 'Test content',
        // No score
      };

      const query = 'test';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].rerankedScore).toBeDefined();
      expect(reranked.results[0].rerankedScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long queries', () => {
      const longQuery = 'What is '.repeat(50) + 'AI?';
      const result: SearchResult = {
        title: 'Test',
        url: 'https://example.com/test',
        content: 'Test content',
        score: 0.5,
      };

      const reranked = WebResultRerankerService.rerankResults([result], longQuery);

      expect(reranked.results[0].rerankedScore).toBeDefined();
    });

    it('should handle special characters in URLs', () => {
      const result: SearchResult = {
        title: 'Test',
        url: 'https://example.com/test?param=value&other=123',
        content: 'Test content',
        score: 0.5,
      };

      const query = 'test';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].domainAuthorityScore).toBeDefined();
    });

    it('should handle unicode in titles and content', () => {
      const result: SearchResult = {
        title: 'Test 🚀 Article',
        url: 'https://example.com/test',
        content: 'Test content with émojis 🎉',
        score: 0.5,
      };

      const query = 'test article';
      const reranked = WebResultRerankerService.rerankResults([result], query);

      expect(reranked.results[0].rerankedScore).toBeDefined();
    });
  });
});
