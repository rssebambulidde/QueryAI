import {
  DiversityFilterService,
  DiversityConfig,
  DEFAULT_DIVERSITY_CONFIG,
  DiversityResult,
} from '../services/diversity-filter.service';
import { DocumentContext } from '../services/rag.service';

describe('DiversityFilterService', () => {
  beforeEach(() => {
    // Reset to default config
    DiversityFilterService.setConfig(DEFAULT_DIVERSITY_CONFIG);
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig: Partial<DiversityConfig> = {
        lambda: 0.8,
        maxResults: 15,
      };

      DiversityFilterService.setConfig(customConfig);
      const config = DiversityFilterService.getConfig();

      expect(config.lambda).toBe(0.8);
      expect(config.maxResults).toBe(15);
      // Other values should remain from default
      expect(config.enabled).toBe(DEFAULT_DIVERSITY_CONFIG.enabled);
    });

    it('should have valid default configuration', () => {
      const config = DiversityFilterService.getConfig();

      expect(config.lambda).toBeGreaterThanOrEqual(0);
      expect(config.lambda).toBeLessThanOrEqual(1);
      expect(config.maxResults).toBeGreaterThan(0);
      expect(config.similarityThreshold).toBeGreaterThanOrEqual(0);
      expect(config.similarityThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe('applyMMR', () => {
    const createMockDocument = (
      id: string,
      content: string,
      score: number
    ): DocumentContext => ({
      documentId: `doc-${id}`,
      documentName: `Document ${id}`,
      chunkIndex: 0,
      content,
      score,
    });

    it('should return empty array for empty input', () => {
      const results = DiversityFilterService.applyMMR([]);
      expect(results).toEqual([]);
    });

    it('should return single result unchanged', () => {
      const doc = createMockDocument('1', 'test content', 0.9);
      const results = DiversityFilterService.applyMMR([doc]);
      
      expect(results.length).toBe(1);
      expect(results[0].documentId).toBe(doc.documentId);
    });

    it('should return original results when diversity disabled', () => {
      DiversityFilterService.setConfig({ enabled: false });
      
      const docs = [
        createMockDocument('1', 'content 1', 0.9),
        createMockDocument('2', 'content 2', 0.8),
        createMockDocument('3', 'content 3', 0.7),
      ];

      const results = DiversityFilterService.applyMMR(docs);
      
      expect(results.length).toBe(3);
      expect(results.map(r => r.documentId)).toEqual(docs.map(d => d.documentId));
    });

    it('should select highest relevance document first', () => {
      const docs = [
        createMockDocument('1', 'content 1', 0.7),
        createMockDocument('2', 'content 2', 0.9), // Highest
        createMockDocument('3', 'content 3', 0.8),
      ];

      const results = DiversityFilterService.applyMMR(docs, { maxResults: 1 });
      
      expect(results.length).toBe(1);
      expect(results[0].documentId).toBe('doc-2');
      expect(results[0].score).toBe(0.9);
    });

    it('should diversify results with different content', () => {
      const docs = [
        createMockDocument('1', 'artificial intelligence machine learning', 0.9),
        createMockDocument('2', 'artificial intelligence deep learning', 0.8), // Similar to 1
        createMockDocument('3', 'quantum computing algorithms', 0.7), // Different
        createMockDocument('4', 'artificial intelligence neural networks', 0.6), // Similar to 1,2
        createMockDocument('5', 'database systems SQL', 0.5), // Different
      ];

      const results = DiversityFilterService.applyMMR(docs, {
        lambda: 0.5, // Balance relevance and diversity
        maxResults: 3,
      });

      expect(results.length).toBe(3);
      // Should include diverse topics
      const contents = results.map(r => r.content);
      expect(contents.some(c => c.includes('artificial intelligence'))).toBe(true);
      expect(contents.some(c => c.includes('quantum') || c.includes('database'))).toBe(true);
    });

    it('should respect maxResults limit', () => {
      const docs = Array.from({ length: 10 }, (_, i) =>
        createMockDocument(`${i}`, `content ${i}`, 0.9 - i * 0.05)
      );

      const results = DiversityFilterService.applyMMR(docs, { maxResults: 5 });
      
      expect(results.length).toBe(5);
    });

    it('should favor relevance with high lambda', () => {
      const docs = [
        createMockDocument('1', 'topic A content', 0.9),
        createMockDocument('2', 'topic A similar', 0.8), // Similar to 1
        createMockDocument('3', 'topic B different', 0.7), // Different but lower score
      ];

      // High lambda = more weight on relevance
      const resultsHighLambda = DiversityFilterService.applyMMR(docs, {
        lambda: 0.9,
        maxResults: 2,
      });

      // Should prefer high relevance even if similar
      expect(resultsHighLambda[0].score).toBeGreaterThanOrEqual(0.8);
    });

    it('should favor diversity with low lambda', () => {
      const docs = [
        createMockDocument('1', 'topic A content', 0.9),
        createMockDocument('2', 'topic A similar', 0.8), // Similar to 1
        createMockDocument('3', 'topic B different', 0.7), // Different
      ];

      // Low lambda = more weight on diversity
      const resultsLowLambda = DiversityFilterService.applyMMR(docs, {
        lambda: 0.3,
        maxResults: 2,
      });

      // Should include diverse topics
      const contents = resultsLowLambda.map(r => r.content);
      expect(contents.some(c => c.includes('topic A'))).toBe(true);
      expect(contents.some(c => c.includes('topic B'))).toBe(true);
    });

    it('should calculate diversity scores', () => {
      const docs = [
        createMockDocument('1', 'content 1', 0.9),
        createMockDocument('2', 'content 2', 0.8),
        createMockDocument('3', 'content 3', 0.7),
      ];

      const results = DiversityFilterService.applyMMR(docs);
      
      // All results should have diversity scores
      results.forEach(result => {
        expect(result.diversityScore).toBeDefined();
        expect(typeof result.diversityScore).toBe('number');
      });
    });

    it('should handle documents with no score', () => {
      const docs = [
        { ...createMockDocument('1', 'content 1', 0.9), score: 0 },
        { ...createMockDocument('2', 'content 2', 0.8), score: 0 },
      ];

      const results = DiversityFilterService.applyMMR(docs);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('calculateDiversityMetrics', () => {
    const createMockDocument = (content: string, score: number): DocumentContext => ({
      documentId: 'doc-1',
      documentName: 'Document',
      chunkIndex: 0,
      content,
      score,
    });

    it('should calculate metrics for diverse results', () => {
      const docs = [
        createMockDocument('artificial intelligence machine learning', 0.9),
        createMockDocument('quantum computing algorithms', 0.8),
        createMockDocument('database systems SQL', 0.7),
      ];

      const metrics = DiversityFilterService.calculateDiversityMetrics(docs);

      expect(metrics.averageSimilarity).toBeLessThan(0.5); // Low similarity = high diversity
      expect(metrics.diversityScore).toBeGreaterThan(0.5); // High diversity score
      expect(metrics.maxSimilarity).toBeLessThan(1.0);
      expect(metrics.minSimilarity).toBeGreaterThanOrEqual(0.0);
    });

    it('should calculate metrics for similar results', () => {
      const docs = [
        createMockDocument('artificial intelligence machine learning', 0.9),
        createMockDocument('artificial intelligence deep learning', 0.8),
        createMockDocument('artificial intelligence neural networks', 0.7),
      ];

      const metrics = DiversityFilterService.calculateDiversityMetrics(docs);

      expect(metrics.averageSimilarity).toBeGreaterThan(0.3); // Higher similarity
      expect(metrics.diversityScore).toBeLessThan(0.7); // Lower diversity score
    });

    it('should handle single result', () => {
      const docs = [createMockDocument('content', 0.9)];
      const metrics = DiversityFilterService.calculateDiversityMetrics(docs);

      expect(metrics.averageSimilarity).toBe(0);
      expect(metrics.maxSimilarity).toBe(0);
      expect(metrics.minSimilarity).toBe(0);
      expect(metrics.diversityScore).toBe(1.0); // Perfectly diverse (only one)
    });

    it('should handle empty array', () => {
      const metrics = DiversityFilterService.calculateDiversityMetrics([]);

      expect(metrics.averageSimilarity).toBe(0);
      expect(metrics.diversityScore).toBe(1.0);
    });
  });

  describe('filterForDiversity', () => {
    it('should be an alias for applyMMR', () => {
      const docs = [
        {
          documentId: 'doc-1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: 'content 1',
          score: 0.9,
        },
        {
          documentId: 'doc-2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: 'content 2',
          score: 0.8,
        },
      ];

      const mmrResults = DiversityFilterService.applyMMR(docs);
      const filterResults = DiversityFilterService.filterForDiversity(docs);

      expect(filterResults.length).toBe(mmrResults.length);
    });
  });

  describe('edge cases', () => {
    it('should handle documents with identical content', () => {
      const docs = [
        {
          documentId: 'doc-1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: 'identical content',
          score: 0.9,
        },
        {
          documentId: 'doc-2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: 'identical content',
          score: 0.8,
        },
      ];

      const results = DiversityFilterService.applyMMR(docs, { maxResults: 2 });
      
      // Should still return results (MMR will penalize similarity)
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle very long content', () => {
      const longContent = 'word '.repeat(1000);
      const docs = [
        {
          documentId: 'doc-1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: longContent + 'topic A',
          score: 0.9,
        },
        {
          documentId: 'doc-2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: longContent + 'topic B',
          score: 0.8,
        },
      ];

      const results = DiversityFilterService.applyMMR(docs);
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      const docs = [
        {
          documentId: 'doc-1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: '',
          score: 0.9,
        },
        {
          documentId: 'doc-2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: '',
          score: 0.8,
        },
      ];

      const results = DiversityFilterService.applyMMR(docs);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
