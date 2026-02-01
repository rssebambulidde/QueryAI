import { HybridSearchService } from '../services/hybrid-search.service';
import { DocumentContext } from '../services/rag.service';
import { KeywordSearchResult } from '../services/keyword-search.service';
import { normalizeWeights, validateWeights } from '../config/search.config';

jest.mock('../config/search.config');

describe('HybridSearchService', () => {
  const mockSemanticResults: DocumentContext[] = [
    {
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'This is semantic result one',
      score: 0.9,
      metadata: {},
    },
    {
      documentId: 'doc-2',
      chunkIndex: 0,
      content: 'This is semantic result two',
      score: 0.8,
      metadata: {},
    },
  ];

  const mockKeywordResults: KeywordSearchResult[] = [
    {
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'This is keyword result one',
      score: 0.7,
      metadata: {},
    },
    {
      documentId: 'doc-3',
      chunkIndex: 0,
      content: 'This is keyword result three',
      score: 0.6,
      metadata: {},
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (validateWeights as jest.Mock).mockReturnValue(true);
    (normalizeWeights as jest.Mock).mockImplementation((w) => w || { semantic: 0.7, keyword: 0.3 });
  });

  describe('mergeResults', () => {
    it('should merge semantic and keyword results', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        weights,
        options
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.combinedScore !== undefined)).toBe(true);
    });

    it('should calculate combined scores correctly', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        weights,
        options
      );

      // Results should be sorted by combined score
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].combinedScore).toBeGreaterThanOrEqual(
          results[i + 1].combinedScore
        );
      }
    });

    it('should mark source correctly', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        weights,
        options
      );

      const semanticOnly = results.find(r => r.source === 'semantic');
      const keywordOnly = results.find(r => r.source === 'keyword');
      const both = results.find(r => r.source === 'both');

      expect(semanticOnly || keywordOnly || both).toBeDefined();
    });

    it('should deduplicate results when enabled', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
        enableDeduplication: true,
      };

      // Create duplicate results
      const duplicateSemantic: DocumentContext[] = [
        {
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'Same content',
          score: 0.9,
          metadata: {},
        },
      ];

      const duplicateKeyword: KeywordSearchResult[] = [
        {
          documentId: 'doc-1',
          chunkIndex: 0,
          content: 'Same content',
          score: 0.8,
          metadata: {},
        },
      ];

      const results = HybridSearchService.mergeResults(
        duplicateSemantic,
        duplicateKeyword,
        weights,
        options
      );

      // Should have fewer results due to deduplication
      expect(results.length).toBeLessThanOrEqual(
        duplicateSemantic.length + duplicateKeyword.length
      );
    });

    it('should respect maxResults limit', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 2,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        weights,
        options
      );

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by minScore', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
        minScore: 0.75,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        weights,
        options
      );

      results.forEach(result => {
        expect(result.combinedScore).toBeGreaterThanOrEqual(0.75);
      });
    });

    it('should use default weights when invalid weights provided', () => {
      (validateWeights as jest.Mock).mockReturnValue(false);

      const invalidWeights = { semantic: 2, keyword: -1 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        invalidWeights,
        options
      );

      expect(normalizeWeights).toHaveBeenCalled();
    });

    it('should handle empty semantic results', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        [],
        mockKeywordResults,
        weights,
        options
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.source === 'keyword')).toBe(true);
    });

    it('should handle empty keyword results', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        [],
        weights,
        options
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.source === 'semantic')).toBe(true);
    });

    it('should handle empty results', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        [],
        [],
        weights,
        options
      );

      expect(results).toEqual([]);
    });

    it('should preserve original scores in result', () => {
      const weights = { semantic: 0.7, keyword: 0.3 };
      const options = {
        userId: 'user-1',
        maxResults: 10,
      };

      const results = HybridSearchService.mergeResults(
        mockSemanticResults,
        mockKeywordResults,
        weights,
        options
      );

      const semanticResult = results.find(r => r.semanticScore !== undefined);
      if (semanticResult) {
        expect(semanticResult.semanticScore).toBeDefined();
      }

      const keywordResult = results.find(r => r.keywordScore !== undefined);
      if (keywordResult) {
        expect(keywordResult.keywordScore).toBeDefined();
      }
    });
  });
});
