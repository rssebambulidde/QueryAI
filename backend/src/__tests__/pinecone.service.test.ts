import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PineconeService, SearchResult, VectorMetadata } from '../services/pinecone.service';
import { AppError } from '../types/error';

// Mock Pinecone
jest.mock('../config/pinecone', () => ({
  getPineconeIndex: jest.fn(),
  isPineconeConfigured: jest.fn(() => true),
}));

// Mock ChunkService
jest.mock('../services/chunk.service', () => ({
  ChunkService: {
    getChunk: jest.fn(),
  },
}));

// Mock CircuitBreakerService
jest.mock('../services/circuit-breaker.service', () => ({
  CircuitBreakerService: {
    execute: jest.fn(),
  },
}));

import { getPineconeIndex, isPineconeConfigured } from '../config/pinecone';
import { ChunkService } from '../services/chunk.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';

describe('PineconeService', () => {
  const mockUserId = 'user-123';
  const mockDocumentId = 'doc-456';
  const mockChunkId = 'chunk-789';
  const mockEmbedding = new Array(1536).fill(0.1);

  const mockSearchResult: SearchResult = {
    chunkId: mockChunkId,
    documentId: mockDocumentId,
    content: 'Test content',
    chunkIndex: 0,
    score: 0.9,
    metadata: {
      userId: mockUserId,
      documentId: mockDocumentId,
      chunkId: mockChunkId,
      chunkIndex: 0,
      content: 'Test content',
      createdAt: '2024-01-01T00:00:00Z',
    },
  };

  const mockPineconeIndex = {
    upsert: jest.fn(),
    query: jest.fn(),
    deleteMany: jest.fn(),
    deleteOne: jest.fn(),
    fetch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (isPineconeConfigured as any).mockReturnValue(true);
    (getPineconeIndex as any).mockResolvedValue(mockPineconeIndex);
    (CircuitBreakerService.execute as any).mockImplementation(
      async (name: string, fn: any) => {
        return { result: await fn(), state: 'closed' };
      }
    );
  });

  describe('upsertVectors', () => {
    it('should upsert vectors to Pinecone', async () => {
      const chunks = [
        { id: mockChunkId, chunkIndex: 0, content: 'Content 1' },
      ];
      const embeddings = [mockEmbedding];

      (mockPineconeIndex.upsert as any).mockResolvedValue(undefined);

      const vectorIds = await PineconeService.upsertVectors(
        mockDocumentId,
        chunks,
        embeddings,
        mockUserId
      );

      expect(vectorIds).toBeDefined();
      expect(Array.isArray(vectorIds)).toBe(true);
      expect(mockPineconeIndex.upsert).toHaveBeenCalled();
    });

    it('should throw error if Pinecone not configured', async () => {
      (isPineconeConfigured as any).mockReturnValueOnce(false);

      await expect(
        PineconeService.upsertVectors(
          mockDocumentId,
          [{ id: mockChunkId, chunkIndex: 0, content: 'Content' }],
          [mockEmbedding],
          mockUserId
        )
      ).rejects.toThrow(AppError);
    });

    it('should throw error if chunks and embeddings mismatch', async () => {
      const chunks = [
        { id: mockChunkId, chunkIndex: 0, content: 'Content 1' },
        { id: 'chunk-2', chunkIndex: 1, content: 'Content 2' },
      ];
      const embeddings = [mockEmbedding]; // Only one embedding

      await expect(
        PineconeService.upsertVectors(mockDocumentId, chunks, embeddings, mockUserId)
      ).rejects.toThrow(AppError);
    });

    it('should validate embedding dimensions', async () => {
      const invalidEmbedding = new Array(100).fill(0.1); // Wrong dimensions
      const chunks = [{ id: mockChunkId, chunkIndex: 0, content: 'Content' }];

      await expect(
        PineconeService.upsertVectors(
          mockDocumentId,
          chunks,
          [invalidEmbedding],
          mockUserId,
          undefined,
          undefined,
          1536 // Expected 1536 dimensions
        )
      ).rejects.toThrow(AppError);
    });

    it('should include topic_id in metadata when provided', async () => {
      const topicId = 'topic-123';
      const chunks = [{ id: mockChunkId, chunkIndex: 0, content: 'Content' }];

      (mockPineconeIndex.upsert as any).mockResolvedValue(undefined);

      await PineconeService.upsertVectors(
        mockDocumentId,
        chunks,
        [mockEmbedding],
        mockUserId,
        topicId
      );

      expect(mockPineconeIndex.upsert).toHaveBeenCalled();
      const callArgs = mockPineconeIndex.upsert.mock.calls[0][0];
      expect(callArgs.vectors[0].metadata.topicId).toBe(topicId);
    });
  });

  describe('search', () => {
    it('should search Pinecone for similar vectors', async () => {
      (mockPineconeIndex.query as any).mockResolvedValue({
        matches: [
          {
            id: `${mockDocumentId}:${mockChunkId}`,
            score: 0.9,
            metadata: mockSearchResult.metadata,
          },
        ],
      });
      (ChunkService.getChunk as any).mockResolvedValue({
        content: 'Test content',
      });

      const results = await PineconeService.search(mockEmbedding, {
        userId: mockUserId,
        topK: 5,
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(mockPineconeIndex.query).toHaveBeenCalled();
    });

    it('should filter by topic_id when provided', async () => {
      const topicId = 'topic-123';
      (mockPineconeIndex.query as any).mockResolvedValue({
        matches: [],
      });

      await PineconeService.search(mockEmbedding, {
        userId: mockUserId,
        topicId,
        topK: 5,
      });

      expect(mockPineconeIndex.query).toHaveBeenCalled();
      const callArgs = mockPineconeIndex.query.mock.calls[0][0];
      expect(callArgs.filter).toBeDefined();
    });

    it('should filter by documentIds when provided', async () => {
      const documentIds = ['doc-1', 'doc-2'];
      (mockPineconeIndex.query as any).mockResolvedValue({
        matches: [],
      });

      await PineconeService.search(mockEmbedding, {
        userId: mockUserId,
        documentIds,
        topK: 5,
      });

      expect(mockPineconeIndex.query).toHaveBeenCalled();
    });

    it('should respect minScore threshold', async () => {
      (mockPineconeIndex.query as any).mockResolvedValue({
        matches: [
          {
            id: `${mockDocumentId}:${mockChunkId}`,
            score: 0.5, // Below threshold
            metadata: mockSearchResult.metadata,
          },
          {
            id: `${mockDocumentId}:chunk-2`,
            score: 0.9, // Above threshold
            metadata: mockSearchResult.metadata,
          },
        ],
      });
      (ChunkService.getChunk as any).mockResolvedValue({
        content: 'Test content',
      });

      const results = await PineconeService.search(mockEmbedding, {
        userId: mockUserId,
        topK: 5,
        minScore: 0.7,
      });

      // Should filter out low score results
      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should handle empty search results', async () => {
      (mockPineconeIndex.query as any).mockResolvedValue({
        matches: [],
      });

      const results = await PineconeService.search(mockEmbedding, {
        userId: mockUserId,
        topK: 5,
      });

      expect(results).toEqual([]);
    });

    it('should throw error if Pinecone not configured', async () => {
      (isPineconeConfigured as any).mockReturnValueOnce(false);

      await expect(
        PineconeService.search(mockEmbedding, {
          userId: mockUserId,
          topK: 5,
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteVectors', () => {
    it('should delete vectors by document ID', async () => {
      (mockPineconeIndex.deleteMany as any).mockResolvedValue(undefined);

      await PineconeService.deleteVectors(mockDocumentId, mockUserId);

      expect(mockPineconeIndex.deleteMany).toHaveBeenCalled();
    });

    it('should throw error if Pinecone not configured', async () => {
      (isPineconeConfigured as any).mockReturnValueOnce(false);

      await expect(
        PineconeService.deleteVectors(mockDocumentId, mockUserId)
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteVector', () => {
    it('should delete single vector by ID', async () => {
      (mockPineconeIndex.deleteOne as any).mockResolvedValue(undefined);

      await PineconeService.deleteVector(mockDocumentId, mockChunkId);

      expect(mockPineconeIndex.deleteOne).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle Pinecone API errors', async () => {
      (mockPineconeIndex.query as any).mockRejectedValue(new Error('Pinecone error'));

      await expect(
        PineconeService.search(mockEmbedding, {
          userId: mockUserId,
          topK: 5,
        })
      ).rejects.toThrow();
    });

    it('should handle chunk fetch errors gracefully', async () => {
      (mockPineconeIndex.query as any).mockResolvedValue({
        matches: [
          {
            id: `${mockDocumentId}:${mockChunkId}`,
            score: 0.9,
            metadata: mockSearchResult.metadata,
          },
        ],
      });
      (ChunkService.getChunk as any).mockRejectedValue(new Error('Chunk not found'));

      const results = await PineconeService.search(mockEmbedding, {
        userId: mockUserId,
        topK: 5,
      });

      // Should handle error and return partial results
      expect(results).toBeDefined();
    });
  });
});
