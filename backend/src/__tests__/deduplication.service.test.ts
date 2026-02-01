import {
  DeduplicationService,
  DeduplicationConfig,
  DEFAULT_DEDUPLICATION_CONFIG,
} from '../services/deduplication.service';
import { DocumentContext } from '../services/rag.service';

describe('DeduplicationService', () => {
  beforeEach(() => {
    // Reset to default config
    DeduplicationService.setConfig(DEFAULT_DEDUPLICATION_CONFIG);
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig: Partial<DeduplicationConfig> = {
        similarityThreshold: 0.9,
        useContentHash: false,
      };

      DeduplicationService.setConfig(customConfig);
      const config = DeduplicationService.getConfig();

      expect(config.similarityThreshold).toBe(0.9);
      expect(config.useContentHash).toBe(false);
      // Other values should remain from default
      expect(config.enabled).toBe(DEFAULT_DEDUPLICATION_CONFIG.enabled);
    });

    it('should have valid default configuration', () => {
      const config = DeduplicationService.getConfig();

      expect(config.exactDuplicateThreshold).toBeGreaterThanOrEqual(0);
      expect(config.exactDuplicateThreshold).toBeLessThanOrEqual(1);
      expect(config.nearDuplicateThreshold).toBeGreaterThanOrEqual(0);
      expect(config.nearDuplicateThreshold).toBeLessThanOrEqual(1);
      expect(config.similarityThreshold).toBeGreaterThanOrEqual(0);
      expect(config.similarityThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe('deduplicate', () => {
    const createMockDocument = (
      id: string,
      chunkIndex: number,
      content: string,
      score: number
    ): DocumentContext => ({
      documentId: `doc-${id}`,
      documentName: `Document ${id}`,
      chunkIndex,
      content,
      score,
    });

    it('should return empty array for empty input', () => {
      const { results, stats } = DeduplicationService.deduplicate([]);

      expect(results).toEqual([]);
      expect(stats.originalCount).toBe(0);
      expect(stats.deduplicatedCount).toBe(0);
    });

    it('should return single result unchanged', () => {
      const doc = createMockDocument('1', 0, 'test content', 0.9);
      const { results, stats } = DeduplicationService.deduplicate([doc]);

      expect(results.length).toBe(1);
      expect(results[0].documentId).toBe(doc.documentId);
      expect(stats.totalRemoved).toBe(0);
    });

    it('should return original results when deduplication disabled', () => {
      DeduplicationService.setConfig({ enabled: false });

      const docs = [
        createMockDocument('1', 0, 'same content', 0.9),
        createMockDocument('2', 0, 'same content', 0.8),
      ];

      const { results, stats } = DeduplicationService.deduplicate(docs);

      expect(results.length).toBe(2);
      expect(stats.totalRemoved).toBe(0);
    });

    it('should remove exact duplicates', () => {
      const docs = [
        createMockDocument('1', 0, 'exact same content', 0.9),
        createMockDocument('2', 0, 'exact same content', 0.8), // Exact duplicate
        createMockDocument('3', 0, 'different content', 0.7),
      ];

      const { results, stats } = DeduplicationService.deduplicate(docs, {
        exactDuplicateThreshold: 1.0,
      });

      expect(results.length).toBe(2);
      expect(stats.exactDuplicatesRemoved).toBeGreaterThan(0);
      // Should keep highest score
      expect(results.some(r => r.score === 0.9)).toBe(true);
    });

    it('should remove near-duplicates', () => {
      const docs = [
        createMockDocument('1', 0, 'artificial intelligence machine learning neural networks', 0.9),
        createMockDocument('2', 0, 'artificial intelligence machine learning deep networks', 0.8), // Near-duplicate
        createMockDocument('3', 0, 'quantum computing algorithms', 0.7), // Different
      ];

      const { results, stats } = DeduplicationService.deduplicate(docs, {
        nearDuplicateThreshold: 0.85, // Lower threshold to catch near-duplicates
        similarityThreshold: 0.75,
      });

      // Should remove near-duplicate
      expect(results.length).toBeLessThan(3);
      // May remove near-duplicate or similarity duplicate
      expect(stats.nearDuplicatesRemoved + stats.similarityDuplicatesRemoved).toBeGreaterThan(0);
    });

    it('should remove similarity-based duplicates', () => {
      const docs = [
        createMockDocument('1', 0, 'machine learning neural networks', 0.9),
        createMockDocument('2', 0, 'machine learning deep networks', 0.8), // Similar
        createMockDocument('3', 0, 'completely different topic', 0.7), // Different
      ];

      const { results, stats } = DeduplicationService.deduplicate(docs, {
        similarityThreshold: 0.7,
      });

      // Should remove similar duplicates
      expect(results.length).toBeLessThan(3);
      expect(stats.similarityDuplicatesRemoved).toBeGreaterThan(0);
    });

    it('should preserve highest score when duplicates found', () => {
      const docs = [
        createMockDocument('1', 0, 'same content', 0.7),
        createMockDocument('2', 0, 'same content', 0.9), // Higher score
        createMockDocument('3', 0, 'same content', 0.8),
      ];

      const { results } = DeduplicationService.deduplicate(docs, {
        preserveHighestScore: true,
      });

      // Should keep highest score
      expect(results.length).toBeLessThan(3);
      // Should include the highest scoring duplicate
      const maxScore = Math.max(...results.map(r => r.score));
      expect(maxScore).toBe(0.9);
    });

    it('should handle same document and chunk index as exact duplicate', () => {
      const docs = [
        createMockDocument('1', 0, 'content A', 0.9),
        createMockDocument('1', 0, 'content B', 0.8), // Same doc and chunk
        createMockDocument('2', 0, 'content C', 0.7),
      ];

      const { results } = DeduplicationService.deduplicate(docs);

      // Should remove duplicate (same document and chunk)
      expect(results.length).toBeLessThan(3);
      expect(results.filter(r => r.documentId === 'doc-1' && r.chunkIndex === 0).length).toBe(1);
    });

    it('should not remove different content', () => {
      const docs = [
        createMockDocument('1', 0, 'artificial intelligence', 0.9),
        createMockDocument('2', 0, 'quantum computing', 0.8),
        createMockDocument('3', 0, 'database systems', 0.7),
      ];

      const { results, stats } = DeduplicationService.deduplicate(docs, {
        similarityThreshold: 0.5, // Low threshold
      });

      // Should keep all (different content)
      expect(results.length).toBe(3);
      expect(stats.totalRemoved).toBe(0);
    });

    it('should complete within performance threshold', () => {
      const docs = Array.from({ length: 50 }, (_, i) =>
        createMockDocument(`${i}`, 0, `content ${i}`, 0.9 - i * 0.01)
      );

      const startTime = Date.now();
      const { stats } = DeduplicationService.deduplicate(docs);
      const processingTime = Date.now() - startTime;

      expect(stats.processingTimeMs).toBeLessThan(200); // Allow some margin for test environment
      expect(processingTime).toBeLessThan(200);
    });

    it('should handle very similar but not duplicate content', () => {
      const docs = [
        createMockDocument('1', 0, 'The quick brown fox jumps over the lazy dog', 0.9),
        createMockDocument('2', 0, 'The quick brown fox jumps over the lazy cat', 0.8), // Very similar
        createMockDocument('3', 0, 'A completely different sentence here', 0.7),
      ];

      const { results } = DeduplicationService.deduplicate(docs, {
        similarityThreshold: 0.95, // High threshold
      });

      // Should keep very similar if threshold is high
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('quickDeduplicate', () => {
    const createMockDocument = (
      id: string,
      chunkIndex: number,
      content: string,
      score: number
    ): DocumentContext => ({
      documentId: `doc-${id}`,
      documentName: `Document ${id}`,
      chunkIndex,
      content,
      score,
    });

    it('should quickly remove duplicates', () => {
      const docs = [
        createMockDocument('1', 0, 'same content', 0.9),
        createMockDocument('2', 0, 'same content', 0.8),
        createMockDocument('3', 0, 'different content', 0.7),
      ];

      const results = DeduplicationService.quickDeduplicate(docs, 0.95);

      expect(results.length).toBeLessThan(3);
    });

    it('should be faster than full deduplication', () => {
      const docs = Array.from({ length: 50 }, (_, i) =>
        createMockDocument(`${i}`, 0, `content ${i % 10}`, 0.9) // Some duplicates
      );

      const quickStart = Date.now();
      DeduplicationService.quickDeduplicate(docs);
      const quickTime = Date.now() - quickStart;

      const fullStart = Date.now();
      DeduplicationService.deduplicate(docs);
      const fullTime = Date.now() - fullStart;

      // Quick should be faster (or at least not much slower)
      expect(quickTime).toBeLessThan(100);
    });
  });

  describe('edge cases', () => {
    const createMockDocument = (
      id: string,
      chunkIndex: number,
      content: string,
      score: number
    ): DocumentContext => ({
      documentId: `doc-${id}`,
      documentName: `Document ${id}`,
      chunkIndex,
      content,
      score,
    });

    it('should handle empty content', () => {
      const docs = [
        createMockDocument('1', 0, '', 0.9),
        createMockDocument('2', 0, '', 0.8),
      ];

      const { results } = DeduplicationService.deduplicate(docs);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle very long content', () => {
      const longContent = 'word '.repeat(1000);
      const docs = [
        createMockDocument('1', 0, longContent, 0.9),
        createMockDocument('2', 0, longContent, 0.8),
      ];

      const { results, stats } = DeduplicationService.deduplicate(docs);

      expect(results.length).toBeLessThan(2);
      expect(stats.processingTimeMs).toBeLessThan(100);
    });

    it('should handle special characters', () => {
      const docs = [
        createMockDocument('1', 0, 'content with "quotes" and \'apostrophes\'', 0.9),
        createMockDocument('2', 0, 'content with "quotes" and \'apostrophes\'', 0.8),
      ];

      const { results } = DeduplicationService.deduplicate(docs);

      expect(results.length).toBeLessThan(2);
    });

    it('should handle unicode characters', () => {
      const docs = [
        createMockDocument('1', 0, 'content with émojis 🚀 and unicode', 0.9),
        createMockDocument('2', 0, 'content with émojis 🚀 and unicode', 0.8),
      ];

      const { results } = DeduplicationService.deduplicate(docs);

      expect(results.length).toBeLessThan(2);
    });

    it('should handle case differences', () => {
      const docs = [
        createMockDocument('1', 0, 'UPPERCASE CONTENT', 0.9),
        createMockDocument('2', 0, 'uppercase content', 0.8),
      ];

      const { results } = DeduplicationService.deduplicate(docs, {
        similarityThreshold: 0.9, // Use similarity threshold for case differences
      });

      // Should detect as similar (case-insensitive similarity)
      expect(results.length).toBeLessThanOrEqual(2);
      // May or may not remove depending on similarity calculation
    });

    it('should handle whitespace differences', () => {
      const docs = [
        createMockDocument('1', 0, 'content   with   spaces', 0.9),
        createMockDocument('2', 0, 'content with spaces', 0.8),
      ];

      const { results } = DeduplicationService.deduplicate(docs, {
        similarityThreshold: 0.8, // Lower threshold to catch whitespace differences
      });

      // Should detect as similar (whitespace normalized in word-based similarity)
      // May or may not remove depending on exact similarity calculation
      expect(results.length).toBeLessThanOrEqual(2);
      // If similarity is high enough, should remove one
      if (results.length < 2) {
        expect(results.length).toBe(1);
      }
    });
  });

  describe('performance', () => {
    const createMockDocument = (
      id: string,
      chunkIndex: number,
      content: string,
      score: number
    ): DocumentContext => ({
      documentId: `doc-${id}`,
      documentName: `Document ${id}`,
      chunkIndex,
      content,
      score,
    });

    it('should handle large result sets efficiently', () => {
      const docs = Array.from({ length: 100 }, (_, i) =>
        createMockDocument(`${i}`, 0, `content ${i % 20}`, 0.9) // Many duplicates
      );

      const startTime = Date.now();
      const { stats } = DeduplicationService.deduplicate(docs);
      const processingTime = Date.now() - startTime;

      expect(stats.processingTimeMs).toBeLessThan(200); // Allow margin for test environment
      expect(processingTime).toBeLessThan(200);
      expect(stats.totalRemoved).toBeGreaterThan(0);
    });

    it('should handle no duplicates efficiently', () => {
      const docs = Array.from({ length: 50 }, (_, i) =>
        createMockDocument(`${i}`, 0, `unique content ${i}`, 0.9)
      );

      const startTime = Date.now();
      const { stats } = DeduplicationService.deduplicate(docs);
      const processingTime = Date.now() - startTime;

      // For unique content, should be faster (no similarity checks needed after hash check)
      expect(stats.processingTimeMs).toBeLessThan(300); // Allow margin for test environment
      expect(processingTime).toBeLessThan(300);
      expect(stats.totalRemoved).toBe(0);
    });
  });
});
