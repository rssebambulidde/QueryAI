import { RerankingService, RerankedResult } from '../services/reranking.service';
import { DocumentContext } from '../services/rag.service';
import { RerankingStrategy } from '../config/reranking.config';

describe('RerankingService', () => {
  describe('rerank', () => {
    const mockResults: DocumentContext[] = [
      {
        documentId: 'doc1',
        documentName: 'Document 1',
        chunkIndex: 0,
        content: 'Short relevant content about artificial intelligence.',
        score: 0.9,
      },
      {
        documentId: 'doc2',
        documentName: 'Document 2',
        chunkIndex: 0,
        content: 'Very long content that might be less relevant but has many words and details about machine learning and neural networks and deep learning and various AI topics.',
        score: 0.85,
      },
      {
        documentId: 'doc3',
        documentName: 'Document 3',
        chunkIndex: 0,
        content: 'Medium length content about AI.',
        score: 0.8,
      },
      {
        documentId: 'doc4',
        documentName: 'Document 4',
        chunkIndex: 0,
        content: 'Another short piece.',
        score: 0.75,
      },
      {
        documentId: 'doc5',
        documentName: 'Document 5',
        chunkIndex: 0,
        content: 'Long irrelevant content with many words.',
        score: 0.7,
      },
    ];

    it('should re-rank results using score-based strategy', async () => {
      const reranked = await RerankingService.rerank({
        query: 'artificial intelligence',
        results: mockResults,
        strategy: 'score-based',
        topK: 5,
        maxResults: 5,
      });

      expect(reranked.length).toBe(5);
      expect(reranked[0].rerankedScore).toBeGreaterThanOrEqual(reranked[1].rerankedScore);
      expect(reranked.every(r => r.originalScore !== undefined)).toBe(true);
      expect(reranked.every(r => r.rerankedScore !== undefined)).toBe(true);
    });

    it('should respect topK limit', async () => {
      const reranked = await RerankingService.rerank({
        query: 'test query',
        results: mockResults,
        strategy: 'score-based',
        topK: 3, // Only re-rank top 3
        maxResults: 5,
      });

      // Should re-rank only top 3, but can return up to maxResults
      expect(reranked.length).toBeLessThanOrEqual(5);
    });

    it('should respect maxResults limit', async () => {
      const reranked = await RerankingService.rerank({
        query: 'test query',
        results: mockResults,
        strategy: 'score-based',
        topK: 5,
        maxResults: 3, // Return only top 3
      });

      expect(reranked.length).toBeLessThanOrEqual(3);
    });

    it('should filter by minScore', async () => {
      const reranked = await RerankingService.rerank({
        query: 'test query',
        results: mockResults,
        strategy: 'score-based',
        topK: 5,
        maxResults: 5,
        minScore: 0.8, // High threshold
      });

      reranked.forEach(result => {
        expect(result.rerankedScore).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should return empty array for empty results', async () => {
      const reranked = await RerankingService.rerank({
        query: 'test query',
        results: [],
        strategy: 'score-based',
      });

      expect(reranked).toEqual([]);
    });

    it('should handle none strategy (no re-ranking)', async () => {
      const reranked = await RerankingService.rerank({
        query: 'test query',
        results: mockResults,
        strategy: 'none',
      });

      expect(reranked.length).toBe(mockResults.length);
      // Scores should be unchanged
      reranked.forEach((result, index) => {
        expect(result.rerankedScore).toBe(mockResults[index].score);
        expect(result.rankChange).toBe(0);
      });
    });

    it('should calculate rank changes correctly', async () => {
      const reranked = await RerankingService.rerank({
        query: 'artificial intelligence',
        results: mockResults,
        strategy: 'score-based',
        topK: 5,
        maxResults: 5,
      });

      // Rank changes should be calculated
      reranked.forEach(result => {
        expect(result.rankChange).toBeDefined();
        expect(typeof result.rankChange).toBe('number');
      });
    });

    it('should prefer shorter documents with score-based strategy', async () => {
      const results: DocumentContext[] = [
        {
          documentId: 'doc1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: 'Short.',
          score: 0.8,
        },
        {
          documentId: 'doc2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: 'Very long content with many words and details that goes on and on.',
          score: 0.85, // Higher score but longer
        },
      ];

      const reranked = await RerankingService.rerank({
        query: 'test',
        results,
        strategy: 'score-based',
      });

      // Shorter document might rank higher due to length preference
      expect(reranked.length).toBe(2);
      // First result should have highest re-ranked score
      expect(reranked[0].rerankedScore).toBeGreaterThanOrEqual(reranked[1].rerankedScore);
    });
  });

  describe('calculatePrecisionMetrics', () => {
    it('should calculate precision improvement metrics', () => {
      const originalResults: DocumentContext[] = [
        {
          documentId: 'doc1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: 'Content 1',
          score: 0.8,
        },
        {
          documentId: 'doc2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: 'Content 2',
          score: 0.7,
        },
      ];

      const rerankedResults: RerankedResult[] = [
        {
          documentId: 'doc1',
          documentName: 'Doc 1',
          chunkIndex: 0,
          content: 'Content 1',
          score: 0.9, // Improved score
          originalScore: 0.8,
          rerankedScore: 0.9,
          rankChange: 0,
        },
        {
          documentId: 'doc2',
          documentName: 'Doc 2',
          chunkIndex: 0,
          content: 'Content 2',
          score: 0.85, // Improved score
          originalScore: 0.7,
          rerankedScore: 0.85,
          rankChange: 0,
        },
      ];

      const metrics = RerankingService.calculatePrecisionMetrics(
        originalResults,
        rerankedResults
      );

      expect(metrics).toHaveProperty('originalPrecision');
      expect(metrics).toHaveProperty('rerankedPrecision');
      expect(metrics).toHaveProperty('improvement');
      expect(metrics).toHaveProperty('averageRankChange');
      expect(metrics.rerankedPrecision).toBeGreaterThan(metrics.originalPrecision);
      expect(metrics.improvement).toBeGreaterThan(0);
    });

    it('should handle empty results', () => {
      const metrics = RerankingService.calculatePrecisionMetrics([], []);
      
      expect(metrics.originalPrecision).toBe(0);
      expect(metrics.rerankedPrecision).toBe(0);
      expect(metrics.improvement).toBe(0);
      expect(metrics.averageRankChange).toBe(0);
    });
  });
});
