/**
 * Tests for Cohere Rerank integration in RerankingService.
 *
 * Mocks the cohere-ai SDK and LatencyTrackerService so no real API calls are made.
 */

// ── Mocks (must come before imports) ────────────────────────────────────────

const mockRerank = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClient: jest.fn().mockImplementation(() => ({
    v2: { rerank: mockRerank },
  })),
}));

jest.mock('../services/latency-tracker.service', () => ({
  LatencyTrackerService: {
    trackOperation: jest.fn((_type: any, fn: () => Promise<any>) => fn()),
  },
  OperationType: { RERANKING: 'reranking' },
}));

jest.mock('../config/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  __esModule: true,
}));

jest.mock('../config/database', () => ({ supabaseAdmin: {} }));

jest.mock('../config/env', () => ({
  default: {
    COHERE_API_KEY: 'test-key',
  },
  __esModule: true,
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import { RerankingService, RerankedResult } from '../services/reranking.service';
import { DocumentContext } from '../services/rag.service';

// Get the mocked config so we can toggle COHERE_API_KEY per test
const config = jest.requireMock('../config/env').default;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build N fake document chunks with descending scores */
function makeChunks(n: number): DocumentContext[] {
  return Array.from({ length: n }, (_, i) => ({
    documentId: `doc${i}`,
    documentName: `Document ${i}`,
    chunkIndex: 0,
    content: `Content for chunk ${i}. ${'x'.repeat((i + 1) * 20)}`,
    score: 1 - i * 0.05, // 1.0, 0.95, 0.90 …
  }));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('RerankingService – Cohere cross-encoder', () => {
  const tenChunks = makeChunks(10);

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure API key is present so the Cohere path runs
    (config as any).COHERE_API_KEY = 'test-key';
    // Reset the cached client so each test gets a fresh one
    (RerankingService as any).cohereClient = null;
  });

  afterAll(() => {
    delete (config as any).COHERE_API_KEY;
  });

  // ── 1. Returned order follows Cohere relevance scores ───────────────────
  it('should reorder 10 chunks by Cohere relevance scores', async () => {
    // Cohere returns reversed relevance (last doc is most relevant)
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: i * 0.1, // 0.0, 0.1, 0.2, …, 0.9
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const reranked = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
      minScore: 0, // disable min-score filter so all 10 come back
    });

    expect(reranked).toHaveLength(10);

    // The chunk originally at index 9 (score 0.9) should now be first
    expect(reranked[0].documentId).toBe('doc9');
    expect(reranked[9].documentId).toBe('doc0');

    // Verify monotonically descending rerankedScore
    for (let i = 1; i < reranked.length; i++) {
      expect(reranked[i - 1].rerankedScore).toBeGreaterThanOrEqual(reranked[i].rerankedScore);
    }
  });

  // ── 2. Order differs from score-based ───────────────────────────────────
  it('should produce different order than score-based when Cohere scores differ', async () => {
    // Cohere says the middle chunk is best
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: i === 5 ? 1.0 : 0.1,
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const crossEncoder = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
    });

    const scoreBased = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'score-based',
      topK: 10,
      maxResults: 10,
    });

    // cross-encoder should put doc5 first (highest Cohere score)
    expect(crossEncoder[0].documentId).toBe('doc5');
    // score-based keeps original-score ordering => doc0 first
    expect(scoreBased[0].documentId).toBe('doc0');
  });

  // ── 3. Rank-change values are correct ───────────────────────────────────
  it('should calculate correct rankChange values', async () => {
    // Give high Cohere scores to high-index docs (reverse of original order)
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: i * 0.1, // doc0=0.0, doc1=0.1, …, doc9=0.9
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const reranked = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
      minScore: 0, // disable min-score filter
    });

    // doc9 was at index 9, now at index 0 => rankChange = 9 - 0 = 9
    expect(reranked[0].documentId).toBe('doc9');
    expect(reranked[0].rankChange).toBe(9);

    // doc0 was at index 0, now at index 9 => rankChange = 0 - 9 = -9
    expect(reranked[9].documentId).toBe('doc0');
    expect(reranked[9].rankChange).toBe(-9);
  });

  // ── 4. Falls back to score-based when no API key ────────────────────────
  it('should fallback to score-based when COHERE_API_KEY is missing', async () => {
    (config as any).COHERE_API_KEY = '';
    (RerankingService as any).cohereClient = null;

    const reranked = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
    });

    expect(mockRerank).not.toHaveBeenCalled();
    expect(reranked).toHaveLength(10);
    // First result should be doc0 (highest original score in score-based)
    expect(reranked[0].documentId).toBe('doc0');
  });

  // ── 5. Falls back to score-based on Cohere API error ────────────────────
  it('should fallback to score-based when Cohere API throws', async () => {
    mockRerank.mockRejectedValueOnce(new Error('rate limited'));

    const reranked = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
    });

    expect(mockRerank).toHaveBeenCalledTimes(1);
    expect(reranked).toHaveLength(10);
    // Falls back to score-based ⇒ doc0 first
    expect(reranked[0].documentId).toBe('doc0');
  });

  // ── 6. Latency tracking is invoked ──────────────────────────────────────
  it('should invoke LatencyTrackerService.trackOperation', async () => {
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: 0.5,
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const { LatencyTrackerService } = require('../services/latency-tracker.service');

    await RerankingService.rerank({
      query: 'latency test',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
    });

    expect(LatencyTrackerService.trackOperation).toHaveBeenCalledWith(
      'reranking',
      expect.any(Function),
      expect.objectContaining({
        metadata: expect.objectContaining({ provider: 'cohere' }),
      }),
    );
  });

  // ── 7. minScore filter applies to Cohere results ────────────────────────
  it('should filter results below minScore after Cohere reranking', async () => {
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: i * 0.1, // 0.0 through 0.9
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const reranked = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 10,
      minScore: 0.5,
    });

    // Only chunks with Cohere score >= 0.5 should remain (indices 5–9 → scores 0.5–0.9)
    expect(reranked.length).toBe(5);
    reranked.forEach(r => {
      expect(r.rerankedScore).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ── 8. Hybrid strategy uses Cohere ──────────────────────────────────────
  it('should use Cohere results in hybrid strategy', async () => {
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: i === 9 ? 1.0 : 0.5,
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const reranked = await RerankingService.rerank({
      query: 'hybrid test',
      results: tenChunks,
      strategy: 'hybrid',
      topK: 10,
      maxResults: 10,
      minScore: 0,
    });

    expect(mockRerank).toHaveBeenCalled();
    expect(reranked).toHaveLength(10);
  });

  // ── 9. maxResults limits Cohere output ──────────────────────────────────
  it('should respect maxResults after Cohere reranking', async () => {
    const cohereResults = tenChunks.map((_, i) => ({
      index: i,
      relevanceScore: 0.9 - i * 0.05,
    }));
    mockRerank.mockResolvedValueOnce({ results: cohereResults });

    const reranked = await RerankingService.rerank({
      query: 'test query',
      results: tenChunks,
      strategy: 'cross-encoder',
      topK: 10,
      maxResults: 3,
    });

    expect(reranked).toHaveLength(3);
  });
});
