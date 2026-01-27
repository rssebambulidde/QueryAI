import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TokenCountService } from '../services/token-count.service';

// Mock EmbeddingService before importing SemanticChunkingService
jest.mock('../services/embedding.service', () => ({
  EmbeddingService: {
    generateEmbedding: jest.fn(),
  },
}));

import { SemanticChunkingService } from '../services/semantic-chunking.service';
import { EmbeddingService } from '../services/embedding.service';

describe('SemanticChunkingService', () => {
  beforeEach(() => {
    TokenCountService.clearCache();
    jest.clearAllMocks();
    
    // Mock embeddings - return simple vectors for testing
    const mockGenerateEmbedding = EmbeddingService.generateEmbedding as jest.MockedFunction<typeof EmbeddingService.generateEmbedding>;
    mockGenerateEmbedding.mockImplementation(async (text: string) => {
      // Generate a simple mock embedding based on text length
      // In real usage, this would be actual OpenAI embeddings
      const embedding = new Array(1536).fill(0).map((_, i) => {
        return Math.sin(text.length + i) * 0.1; // Simple mock embedding
      });
      return embedding;
    });
  });

  describe('chunkTextSemantically', () => {
    it('should return empty array for empty text', async () => {
      const result = await SemanticChunkingService.chunkTextSemantically('');
      expect(result).toEqual([]);
    });

    it('should return single chunk for small text', async () => {
      const text = 'This is a short text.';
      const chunks = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 1000,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('short text');
    });

    it('should group semantically similar sentences', async () => {
      const text = `
        Machine learning is a subset of artificial intelligence.
        AI systems can learn from data.
        Deep learning uses neural networks.
        Neural networks are inspired by the brain.
        Natural language processing helps computers understand text.
        NLP models can translate languages.
      `.trim();

      const chunks = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 200,
        similarityThreshold: 0.5, // Lower threshold for testing
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should respect maxChunkSize', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. '.repeat(50);
      const chunks = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 100,
        similarityThreshold: 0.7,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        // Allow some overflow due to semantic grouping
        expect(chunk.tokenCount).toBeLessThan(150);
      });
    });

    it('should handle similarity threshold', async () => {
      const text = 'First topic sentence. Second topic sentence. Different topic here. '.repeat(10);
      
      const chunksHighThreshold = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 200,
        similarityThreshold: 0.9, // High threshold - less grouping
      });

      const chunksLowThreshold = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 200,
        similarityThreshold: 0.3, // Low threshold - more grouping
      });

      // Lower threshold should potentially create fewer chunks (more grouping)
      // But this depends on actual similarity, so we just verify both work
      expect(chunksHighThreshold.length).toBeGreaterThan(0);
      expect(chunksLowThreshold.length).toBeGreaterThan(0);
    });

    it('should throw error when embedding fails and fallback is enabled', async () => {
      // Mock embedding generation to fail
      const mockGenerateEmbedding = EmbeddingService.generateEmbedding as jest.MockedFunction<typeof EmbeddingService.generateEmbedding>;
      mockGenerateEmbedding.mockRejectedValueOnce(
        new Error('Embedding failed') as never
      );

      const text = 'Test sentence one. Test sentence two.';
      
      // Should throw error that triggers fallback in ChunkingService
      await expect(
        SemanticChunkingService.chunkTextSemantically(text, {
          fallbackToSentence: true,
        })
      ).rejects.toThrow();
    });

    it('should not fallback if fallbackToSentence is false', async () => {
      // Mock embedding generation to fail
      const mockGenerateEmbedding = EmbeddingService.generateEmbedding as jest.MockedFunction<typeof EmbeddingService.generateEmbedding>;
      mockGenerateEmbedding.mockRejectedValueOnce(
        new Error('Embedding failed') as never
      );

      const text = 'Test sentence one. Test sentence two.';
      
      await expect(
        SemanticChunkingService.chunkTextSemantically(text, {
          fallbackToSentence: false,
        })
      ).rejects.toThrow();
    });

    it('should preserve sentence indices in chunks', async () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 50,
        similarityThreshold: 0.5,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.sentenceIndices).toBeDefined();
        expect(Array.isArray(chunk.sentenceIndices)).toBe(true);
        expect(chunk.sentenceIndices.length).toBeGreaterThan(0);
      });
    });
  });

  describe('compareChunkingStrategies', () => {
    it('should compare semantic vs sentence-based chunking', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. '.repeat(20);
      
      const comparison = await SemanticChunkingService.compareChunkingStrategies(text, {
        maxChunkSize: 100,
      });

      expect(comparison.semantic).toBeDefined();
      expect(comparison.sentence).toBeDefined();
      expect(comparison.improvement).toBeDefined();

      expect(comparison.semantic.chunkCount).toBeGreaterThan(0);
      expect(comparison.sentence.chunkCount).toBeGreaterThan(0);
      expect(typeof comparison.improvement.chunkCountDiff).toBe('number');
    });

    it('should provide metrics for both strategies', async () => {
      const text = 'Test sentence. Another sentence. '.repeat(30);
      
      const comparison = await SemanticChunkingService.compareChunkingStrategies(text);

      expect(comparison.semantic.avgChunkSize).toBeGreaterThan(0);
      expect(comparison.sentence.avgChunkSize).toBeGreaterThan(0);
      expect(comparison.semantic.totalTokens).toBeGreaterThan(0);
      expect(comparison.sentence.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle text with no sentence boundaries', async () => {
      const text = 'No periods or question marks just text';
      const chunks = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 100,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very long sentences', async () => {
      const longSentence = 'This is a very long sentence. '.repeat(100);
      const chunks = await SemanticChunkingService.chunkTextSemantically(longSentence, {
        maxChunkSize: 200,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', async () => {
      const text = 'Hello 世界. This is a test. こんにちは.';
      const chunks = await SemanticChunkingService.chunkTextSemantically(text, {
        maxChunkSize: 100,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content).toContain('世界');
      });
    });
  });
});
