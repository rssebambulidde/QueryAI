/**
 * Unit tests for ContextPipelineService
 *
 * Tests the post-retrieval processing pipeline extracted from rag.service.ts:
 *   - processRetrievalResults (re-ranking, dedup, diversity, adaptive)
 *   - formatContextForPrompt (ordering, summarization, compression, prioritization, budgeting)
 */

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../reranking.service', () => ({
  RerankingService: {
    rerank: jest.fn(),
  },
}));

jest.mock('../deduplication.service', () => ({
  DeduplicationService: {
    deduplicate: jest.fn(),
  },
}));

jest.mock('../diversity-filter.service', () => ({
  DiversityFilterService: {
    applyMMR: jest.fn(),
  },
}));

jest.mock('../adaptive-context.service', () => ({
  AdaptiveContextService: {
    selectAdaptiveContext: jest.fn().mockReturnValue({
      documentChunks: 5,
      webResults: 3,
      complexity: { intentComplexity: 'medium', queryType: 'factual' },
      tokenBudget: { remaining: { total: 4000 } },
      reasoning: 'default',
      adjustments: [],
    }),
    refineContextSelection: jest.fn().mockReturnValue({
      documentChunks: 5,
      webResults: 3,
    }),
  },
}));

jest.mock('../relevance-ordering.service', () => ({
  RelevanceOrderingService: {
    orderContext: jest.fn().mockImplementation((context) => ({
      context,
      stats: { performanceWarning: false, processingTimeMs: 5 },
    })),
  },
}));

jest.mock('../context-summarizer.service', () => ({
  ContextSummarizerService: {
    summarizeContext: jest.fn(),
    compressContext: jest.fn(),
  },
}));

jest.mock('../source-prioritizer.service', () => ({
  SourcePrioritizerService: {
    prioritizeContext: jest.fn(),
  },
}));

jest.mock('../token-budget.service', () => ({
  TokenBudgetService: {
    calculateBudget: jest.fn(),
    checkBudget: jest.fn(),
    trimContextToBudget: jest.fn(),
    getBudgetSummary: jest.fn(),
  },
}));

jest.mock('../latency-tracker.service', () => ({
  LatencyTrackerService: {
    trackOperation: jest.fn().mockImplementation(async (_type, fn) => fn()),
  },
  OperationType: {
    RERANKING: 'RERANKING',
    DEDUPLICATION: 'DEDUPLICATION',
    DIVERSITY_FILTERING: 'DIVERSITY_FILTERING',
    CONTEXT_FORMATTING: 'CONTEXT_FORMATTING',
    CONTEXT_COMPRESSION: 'CONTEXT_COMPRESSION',
    CONTEXT_SUMMARIZATION: 'CONTEXT_SUMMARIZATION',
  },
}));

jest.mock('../../config/thresholds.config', () => ({
  RetrievalConfig: {
    highPriorityThreshold: 0.8,
    processingTargets: {
      orderingTargetMs: 100,
      summarizationTimeoutMs: 5000,
      compressionTimeoutMs: 3000,
    },
  },
}));

import { ContextPipelineService } from '../context-pipeline.service';
import { RerankingService } from '../reranking.service';
import { DeduplicationService } from '../deduplication.service';
import { DiversityFilterService } from '../diversity-filter.service';

import type { DocumentContext, RAGContext } from '../rag.service';

const mockDocs: DocumentContext[] = [
  {
    documentId: 'doc-1',
    documentName: 'Research Paper A',
    chunkIndex: 0,
    content: 'Machine learning is a branch of artificial intelligence...',
    score: 0.95,
    documentType: 'pdf',
    author: 'Dr. Smith',
  },
  {
    documentId: 'doc-2',
    documentName: 'Tutorial B',
    chunkIndex: 1,
    content: 'Neural networks are inspired by biological neurons...',
    score: 0.85,
    documentType: 'md',
  },
];

const mockWebResults: RAGContext['webSearchResults'] = [
  {
    title: 'Web Article',
    url: 'https://example.com/ml',
    content: 'A web article about machine learning...',
    publishedDate: '2024-01-15',
    author: 'Jane Doe',
  },
];

describe('ContextPipelineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processRetrievalResults', () => {
    it('should pass through results when no pipeline stages are enabled', async () => {
      const result = await ContextPipelineService.processRetrievalResults(
        mockDocs,
        mockWebResults,
        {}
      );

      expect(result.documentContexts).toEqual(mockDocs);
      expect(result.webSearchResults).toEqual(mockWebResults);
    });

    it('should apply re-ranking when enabled', async () => {
      const rerankedDocs = [
        { documentId: 'doc-2', documentName: 'Tutorial B', chunkIndex: 1, content: 'Neural...', rerankedScore: 0.92 },
        { documentId: 'doc-1', documentName: 'Research Paper A', chunkIndex: 0, content: 'ML...', rerankedScore: 0.88 },
      ];
      (RerankingService.rerank as jest.Mock).mockResolvedValue(rerankedDocs);

      const result = await ContextPipelineService.processRetrievalResults(
        mockDocs,
        mockWebResults,
        { enableReranking: true, query: 'neural networks' }
      );

      expect(RerankingService.rerank).toHaveBeenCalled();
      expect(result.documentContexts).toHaveLength(2);
      expect(result.documentContexts[0].documentId).toBe('doc-2');
    });

    it('should apply deduplication when enabled', async () => {
      const dedupResult = {
        results: [mockDocs[0]],
        stats: {
          exactDuplicatesRemoved: 0,
          nearDuplicatesRemoved: 1,
          similarityDuplicatesRemoved: 0,
          totalRemoved: 1,
          processingTimeMs: 5,
        },
      };
      (DeduplicationService.deduplicate as jest.Mock).mockResolvedValue(dedupResult);

      const result = await ContextPipelineService.processRetrievalResults(
        mockDocs,
        mockWebResults,
        { enableResultDeduplication: true }
      );

      expect(DeduplicationService.deduplicate).toHaveBeenCalled();
      expect(result.documentContexts).toHaveLength(1);
    });

    it('should apply diversity filtering when enabled', async () => {
      (DiversityFilterService.applyMMR as jest.Mock).mockResolvedValue([
        { documentId: 'doc-1', documentName: 'Research Paper A', chunkIndex: 0, content: 'ML...', score: 0.95 },
      ]);

      const result = await ContextPipelineService.processRetrievalResults(
        mockDocs,
        mockWebResults,
        { enableDiversityFilter: true, diversityLambda: 0.5 }
      );

      expect(DiversityFilterService.applyMMR).toHaveBeenCalled();
      expect(result.documentContexts).toHaveLength(1);
    });

    it('should gracefully handle re-ranking failure', async () => {
      (RerankingService.rerank as jest.Mock).mockRejectedValue(new Error('Reranking failed'));

      const result = await ContextPipelineService.processRetrievalResults(
        mockDocs,
        mockWebResults,
        { enableReranking: true, query: 'test' }
      );

      // Should fall back to original results
      expect(result.documentContexts).toEqual(mockDocs);
    });

    it('should not apply pipeline stages on empty documents', async () => {
      const result = await ContextPipelineService.processRetrievalResults(
        [],
        mockWebResults,
        { enableReranking: true, enableResultDeduplication: true, enableDiversityFilter: true }
      );

      expect(RerankingService.rerank).not.toHaveBeenCalled();
      expect(DeduplicationService.deduplicate).not.toHaveBeenCalled();
      expect(DiversityFilterService.applyMMR).not.toHaveBeenCalled();
      expect(result.documentContexts).toEqual([]);
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format document contexts into a prompt string', async () => {
      const context: RAGContext = {
        documentContexts: mockDocs,
        webSearchResults: [],
      };

      const result = await ContextPipelineService.formatContextForPrompt(context);

      expect(result).toContain('Relevant Document Excerpts:');
      expect(result).toContain('Research Paper A');
      expect(result).toContain('Tutorial B');
    });

    it('should format web results into a prompt string', async () => {
      const context: RAGContext = {
        documentContexts: [],
        webSearchResults: mockWebResults,
      };

      const result = await ContextPipelineService.formatContextForPrompt(context);

      expect(result).toContain('Web Search Results:');
      expect(result).toContain('Web Article');
      expect(result).toContain('https://example.com/ml');
      expect(result).toContain('CITING');
    });

    it('should include both document and web results', async () => {
      const context: RAGContext = {
        documentContexts: mockDocs,
        webSearchResults: mockWebResults,
      };

      const result = await ContextPipelineService.formatContextForPrompt(context);

      expect(result).toContain('Relevant Document Excerpts:');
      expect(result).toContain('Web Search Results:');
    });

    it('should return empty string for empty context', async () => {
      const context: RAGContext = {
        documentContexts: [],
        webSearchResults: [],
      };

      const result = await ContextPipelineService.formatContextForPrompt(context);
      expect(result).toBe('');
    });
  });
});
