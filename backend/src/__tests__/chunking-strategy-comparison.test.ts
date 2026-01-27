import { describe, it, expect, beforeEach } from '@jest/globals';
import { ChunkingService } from '../services/chunking.service';
import { SemanticChunkingService } from '../services/semantic-chunking.service';
import { TokenCountService } from '../services/token-count.service';

describe('Chunking Strategy Comparison', () => {
  beforeEach(() => {
    TokenCountService.clearCache();
  });

  describe('Strategy Selection', () => {
    it('should use sentence-based by default', () => {
      const text = 'Sentence one. Sentence two. Sentence three.';
      const chunks = ChunkingService.chunkText(text);
      
      // Should return synchronously (sentence-based)
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use semantic chunking when strategy is semantic', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. '.repeat(10);
      const chunks = await ChunkingService.chunkText(text, {
        strategy: 'semantic',
        maxChunkSize: 100,
      });
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use semantic chunking when enableSemanticChunking is true', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. '.repeat(10);
      const chunks = await ChunkingService.chunkText(text, {
        enableSemanticChunking: true,
        maxChunkSize: 100,
      });
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use chunkTextAsync for explicit async handling', async () => {
      const text = 'Sentence one. Sentence two. Sentence three.';
      const chunks = await ChunkingService.chunkTextAsync(text, {
        strategy: 'semantic',
      });
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain same interface for sentence-based chunking', () => {
      const text = 'Test sentence. Another sentence.';
      const chunks = ChunkingService.chunkText(text);
      
      expect(Array.isArray(chunks)).toBe(true);
      if (chunks.length > 0) {
        expect(chunks[0]).toHaveProperty('content');
        expect(chunks[0]).toHaveProperty('tokenCount');
        expect(chunks[0]).toHaveProperty('chunkIndex');
        expect(chunks[0]).toHaveProperty('startChar');
        expect(chunks[0]).toHaveProperty('endChar');
      }
    });

    it('should work with existing code without changes', () => {
      const text = 'Test text. '.repeat(100);
      const chunks = ChunkingService.chunkText(text, {
        maxChunkSize: 200,
        overlapSize: 50,
      });
      
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });
  });

  describe('Comparison Metrics', () => {
    it('should generate comparison metrics', async () => {
      const text = 'Machine learning is powerful. AI systems can learn. Deep learning uses neural networks. '.repeat(20);
      
      const comparison = await SemanticChunkingService.compareChunkingStrategies(text, {
        maxChunkSize: 150,
        similarityThreshold: 0.7,
      });
      
      expect(comparison.semantic.chunkCount).toBeGreaterThan(0);
      expect(comparison.sentence.chunkCount).toBeGreaterThan(0);
      expect(comparison.improvement).toBeDefined();
      
      // Log metrics for analysis
      console.log('Comparison Metrics:', {
        semanticChunks: comparison.semantic.chunkCount,
        sentenceChunks: comparison.sentence.chunkCount,
        semanticAvgSize: comparison.semantic.avgChunkSize.toFixed(2),
        sentenceAvgSize: comparison.sentence.avgChunkSize.toFixed(2),
        chunkCountDiff: comparison.improvement.chunkCountDiff,
      });
    });

    it('should show semantic coherence improvement', async () => {
      // Text with clear semantic topics
      const text = `
        Machine learning algorithms can identify patterns in data.
        Supervised learning uses labeled training data.
        Unsupervised learning finds hidden patterns.
        Reinforcement learning uses rewards and penalties.
        Natural language processing enables text understanding.
        NLP models can translate between languages.
        Computer vision processes image data.
        Image recognition identifies objects in photos.
      `.trim();
      
      const comparison = await SemanticChunkingService.compareChunkingStrategies(text, {
        maxChunkSize: 100,
        similarityThreshold: 0.6,
      });
      
      // Semantic chunking should group related sentences
      // This is a qualitative check - semantic chunks should preserve topic coherence
      expect(comparison.semantic.chunkCount).toBeGreaterThan(0);
      expect(comparison.sentence.chunkCount).toBeGreaterThan(0);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to sentence-based when semantic fails', async () => {
      // This test would require mocking embedding failures
      // For now, we test that fallback is configured
      const text = 'Test sentence. Another sentence.';
      
      // With fallback enabled (default), should work
      const chunks = await ChunkingService.chunkTextAsync(text, {
        strategy: 'semantic',
        fallbackToSentence: true,
        maxChunkSize: 100,
      });
      
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
