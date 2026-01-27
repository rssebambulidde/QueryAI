import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RAGService, RAGOptions, RAGContext, DocumentContext } from '../rag.service';

// Mock all external dependencies
jest.mock('../embedding.service');
jest.mock('../pinecone.service');
jest.mock('../search.service');
jest.mock('../document.service');
jest.mock('../hybrid-search.service');
jest.mock('../keyword-search.service');
jest.mock('../query-expansion.service');
jest.mock('../reranking.service');
jest.mock('../threshold-optimizer.service');
jest.mock('../diversity-filter.service');
jest.mock('../deduplication.service');
jest.mock('../context-selector.service');
jest.mock('../relevance-ordering.service');
jest.mock('../context-compressor.service');
jest.mock('../context-summarizer.service');
jest.mock('../source-prioritizer.service');
jest.mock('../token-budget.service');
jest.mock('../adaptive-context.service');
jest.mock('../redis-cache.service');
jest.mock('../degradation.service');
jest.mock('../error-recovery.service');
jest.mock('../metrics.service');
jest.mock('../latency-tracker.service');
jest.mock('../error-tracker.service');
jest.mock('../../config/pinecone', () => ({
  isPineconeConfigured: jest.fn(() => true),
}));

// Import mocked services
import { EmbeddingService } from '../embedding.service';
import { PineconeService } from '../pinecone.service';
import { SearchService } from '../search.service';
import { DocumentService } from '../document.service';
import { HybridSearchService } from '../hybrid-search.service';
import { KeywordSearchService } from '../keyword-search.service';
import { QueryExpansionService } from '../query-expansion.service';
import { RerankingService } from '../reranking.service';
import { ThresholdOptimizerService } from '../threshold-optimizer.service';
import { DiversityFilterService } from '../diversity-filter.service';
import { DeduplicationService } from '../deduplication.service';
import { ContextSelectorService } from '../context-selector.service';
import { RelevanceOrderingService } from '../relevance-ordering.service';
import { ContextCompressorService } from '../context-compressor.service';
import { ContextSummarizerService } from '../context-summarizer.service';
import { SourcePrioritizerService } from '../source-prioritizer.service';
import { TokenBudgetService } from '../token-budget.service';
import { AdaptiveContextService } from '../adaptive-context.service';
import { RedisCacheService } from '../redis-cache.service';
import { DegradationService, DegradationLevel } from '../degradation.service';
import { ErrorRecoveryService } from '../error-recovery.service';
import { MetricsService } from '../metrics.service';
import { LatencyTrackerService, OperationType } from '../latency-tracker.service';
import { isPineconeConfigured } from '../../config/pinecone';

describe('RAGService', () => {
  const mockUserId = 'user-123';
  const mockTopicId = 'topic-456';
  const mockQuery = 'What is artificial intelligence?';

  // Mock data
  const mockDocumentContext: DocumentContext = {
    documentId: 'doc-1',
    documentName: 'AI Document',
    chunkIndex: 0,
    content: 'Artificial intelligence is the simulation of human intelligence by machines.',
    score: 0.9,
    timestamp: '2024-01-01T00:00:00Z',
    author: 'John Doe',
    documentType: 'pdf',
    fileSize: 1024,
    fileSizeFormatted: '1 KB',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockWebSearchResult = {
    title: 'AI Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    content: 'Artificial intelligence (AI) is intelligence demonstrated by machines.',
    publishedDate: '2024-01-01',
    author: 'Wikipedia',
    accessDate: new Date().toISOString(),
  };

  const mockKeywordSearchResult = {
    documentId: 'doc-1',
    documentName: 'AI Document',
    chunkIndex: 0,
    content: 'Artificial intelligence is the simulation of human intelligence by machines.',
    score: 0.85,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (EmbeddingService.generateEmbedding as any).mockResolvedValue(new Array(1536).fill(0.1));
    (EmbeddingService.getCurrentDimensions as any).mockReturnValue(1536);
    (EmbeddingService.getCurrentModel as any).mockReturnValue('text-embedding-3-small');

    (PineconeService.search as any).mockResolvedValue([
      {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        content: mockDocumentContext.content,
        chunkIndex: 0,
        score: 0.9,
        metadata: {
          userId: mockUserId,
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          chunkIndex: 0,
          content: mockDocumentContext.content,
          createdAt: '2024-01-01T00:00:00Z',
        },
      },
    ]);

    (SearchService.search as any).mockResolvedValue({
      results: [mockWebSearchResult],
    });

    (DocumentService.getDocumentsBatch as any).mockResolvedValue(
      new Map([
        [
          'doc-1',
          {
            id: 'doc-1',
            filename: 'AI Document',
            file_type: 'pdf',
            file_size: 1024,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            metadata: {
              author: 'John Doe',
            },
          },
        ],
      ])
    );

    (KeywordSearchService.search as any).mockResolvedValue([mockKeywordSearchResult]);

    (QueryExpansionService.expandQuery as any).mockResolvedValue({
      expandedQuery: mockQuery,
      expandedTerms: ['machine learning', 'neural networks'],
      strategy: 'hybrid',
    });

    (ThresholdOptimizerService.calculateThreshold as any).mockReturnValue({
      threshold: 0.7,
      strategy: 'adaptive',
      queryType: 'factual',
      reasoning: 'Standard threshold',
    });

    (ThresholdOptimizerService.getConfig as any).mockReturnValue({
      minThreshold: 0.3,
      fallbackEnabled: true,
    });

    (HybridSearchService.performHybridSearch as any).mockImplementation(
      async (semantic: any, keyword: any) => {
        return semantic.map((doc: DocumentContext) => ({
          ...doc,
          combinedScore: doc.score,
        }));
      }
    );

    (RerankingService.rerank as any).mockImplementation(async ({ results }: any) => {
      return results.map((r: DocumentContext) => ({
        ...r,
        rerankedScore: r.score,
        originalScore: r.score,
      }));
    });

    (DeduplicationService.deduplicate as any).mockImplementation(async (results: any) => {
      return {
        results,
        stats: {
          exactDuplicatesRemoved: 0,
          nearDuplicatesRemoved: 0,
          similarityDuplicatesRemoved: 0,
          totalRemoved: 0,
          processingTimeMs: 10,
        },
      };
    });

    (DiversityFilterService.applyMMR as any).mockImplementation(async (results: any) => {
      return results;
    });

    (ContextSelectorService.selectContextSize as any).mockReturnValue({
      chunkCount: 5,
      complexity: {
        intentComplexity: 'medium',
        queryType: 'factual',
      },
      reasoning: 'Standard selection',
    });

    (RelevanceOrderingService.orderContext as any).mockReturnValue({
      context: {
        documentContexts: [],
        webSearchResults: [],
      },
      stats: {
        processingTimeMs: 10,
        performanceWarning: false,
      },
    });

    (ContextCompressorService.compressContext as any).mockReturnValue({
      wasCompressed: false,
      context: {
        documentContexts: [],
        webSearchResults: [],
      },
    });

    (ContextSummarizerService.summarizeContext as any).mockResolvedValue({
      wasSummarized: false,
      context: {
        documentContexts: [],
        webSearchResults: [],
      },
    });

    (SourcePrioritizerService.prioritizeContext as any).mockReturnValue({
      context: {
        documentContexts: [],
        webSearchResults: [],
      },
      stats: {
        documentCount: 0,
        webResultCount: 0,
        averageDocumentPriority: 0.5,
        averageWebPriority: 0.5,
        highPriorityDocuments: 0,
        highPriorityWebResults: 0,
        processingTimeMs: 10,
      },
    });

    (TokenBudgetService.calculateBudget as any).mockReturnValue({
      model: 'gpt-4',
      modelLimit: 8192,
      usage: {
        userPrompt: 100,
        systemPrompt: 50,
        context: 500,
        total: 650,
      },
      remaining: {
        total: 7542,
        context: 7542,
      },
    });

    (TokenBudgetService.checkBudget as any).mockReturnValue({
      fits: true,
      contextTokens: {
        documentContext: 300,
        webResults: 200,
        total: 500,
      },
      warnings: [],
      errors: [],
    });

    (TokenBudgetService.trimContextToBudget as any).mockImplementation((context: any) => context);

    (TokenBudgetService.getBudgetSummary as any).mockReturnValue('Budget OK');

    (AdaptiveContextService.selectAdaptiveContext as any).mockReturnValue({
      documentChunks: 5,
      webResults: 5,
      complexity: {
        intentComplexity: 'medium',
        queryType: 'factual',
      },
      tokenBudget: {
        remaining: { total: 7000 },
      },
      reasoning: 'Standard selection',
      adjustments: [],
    });

    (AdaptiveContextService.refineContextSelection as any).mockReturnValue({
      documentChunks: 5,
      webResults: 5,
      complexity: {
        intentComplexity: 'medium',
        queryType: 'factual',
      },
      tokenBudget: {
        remaining: { total: 7000 },
      },
      reasoning: 'Refined selection',
      adjustments: [],
    });

    (RedisCacheService.get as any).mockResolvedValue(null);
    (RedisCacheService.setWithEmbedding as any).mockResolvedValue(undefined);
    (RedisCacheService.findSimilarEntries as any).mockResolvedValue([]);
    (RedisCacheService.deletePattern as any).mockResolvedValue(0);
    (RedisCacheService.clearAll as any).mockResolvedValue(0);
    (RedisCacheService.recordRAGHit as any).mockReturnValue(undefined);
    (RedisCacheService.recordRAGMiss as any).mockReturnValue(undefined);
    (RedisCacheService.recordRAGError as any).mockReturnValue(undefined);
    (RedisCacheService.recordRAGSet as any).mockReturnValue(undefined);
    (RedisCacheService.recordRAGSimilarityHit as any).mockReturnValue(undefined);
    (RedisCacheService.getRAGStats as any).mockReturnValue({
      hits: 0,
      misses: 0,
      errors: 0,
    });

    (DegradationService.getOverallStatus as any).mockReturnValue({
      level: DegradationLevel.NONE,
      affectedServices: [],
      message: undefined,
    });

    (ErrorRecoveryService.attemptRecovery as any).mockImplementation(
      async (serviceType: any, error: any, retryFn: any, fallbackFn: any, config: any) => {
        try {
          const result = await retryFn();
          return {
            recovered: true,
            result,
            strategy: 'retry',
            attempts: 1,
          };
        } catch (e) {
          if (fallbackFn) {
            return {
              recovered: true,
              result: await fallbackFn(),
              strategy: 'fallback',
              attempts: 1,
            };
          }
          return {
            recovered: false,
            result: null,
            strategy: 'none',
            attempts: 1,
            error: e,
          };
        }
      }
    );

    (MetricsService.collectMetrics as any).mockResolvedValue(undefined);

    (LatencyTrackerService.trackOperation as any).mockImplementation(
      async (operationType: any, fn: any, metadata: any) => {
        return await fn();
      }
    );

    (isPineconeConfigured as any).mockReturnValue(true);
  });

  // ============================================================================
  // DOCUMENT RETRIEVAL TESTS
  // ============================================================================

  describe('retrieveDocumentContext', () => {
    const baseOptions: RAGOptions = {
      userId: mockUserId,
      enableDocumentSearch: true,
      maxDocumentChunks: 5,
      minScore: 0.7,
    };

    it('should retrieve document context from Pinecone', async () => {
      const contexts = await RAGService.retrieveDocumentContext(mockQuery, baseOptions);

      expect(contexts).toHaveLength(1);
      expect(contexts[0].documentId).toBe('doc-1');
      expect(contexts[0].content).toBe(mockDocumentContext.content);
      expect(EmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(PineconeService.search).toHaveBeenCalled();
    });

    it('should return empty array when document search is disabled', async () => {
      const contexts = await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        enableDocumentSearch: false,
      });

      expect(contexts).toEqual([]);
      expect(PineconeService.search).not.toHaveBeenCalled();
    });

    it('should expand query when query expansion is enabled', async () => {
      await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        enableQueryExpansion: true,
        expansionStrategy: 'hybrid',
      });

      expect(QueryExpansionService.expandQuery).toHaveBeenCalled();
    });

    it('should use adaptive threshold when enabled', async () => {
      await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        useAdaptiveThreshold: true,
      });

      expect(ThresholdOptimizerService.calculateThreshold).toHaveBeenCalled();
    });

    it('should filter by topicId when provided', async () => {
      await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        topicId: mockTopicId,
      });

      expect(PineconeService.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          topicId: mockTopicId,
        }),
        expect.any(Number)
      );
    });

    it('should filter by documentIds when provided', async () => {
      const documentIds = ['doc-1', 'doc-2'];
      await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        documentIds,
      });

      expect(PineconeService.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          documentIds,
        }),
        expect.any(Number)
      );
    });

    it('should include document metadata in results', async () => {
      const contexts = await RAGService.retrieveDocumentContext(mockQuery, baseOptions);

      expect(contexts[0].documentName).toBe('AI Document');
      expect(contexts[0].author).toBe('John Doe');
      expect(contexts[0].documentType).toBe('pdf');
      expect(contexts[0].fileSize).toBe(1024);
    });

    it('should handle Pinecone not configured', async () => {
      (isPineconeConfigured as any).mockReturnValueOnce(false);

      const contexts = await RAGService.retrieveDocumentContext(mockQuery, baseOptions);

      expect(contexts).toEqual([]);
    });

    it('should handle embedding generation failure with keyword fallback', async () => {
      (EmbeddingService.generateEmbedding as any).mockRejectedValueOnce(
        new Error('Embedding failed')
      );
      (ErrorRecoveryService.attemptRecovery as any).mockResolvedValueOnce({
        recovered: true,
        result: null,
        strategy: 'fallback',
        attempts: 1,
      });

      const contexts = await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        enableKeywordSearch: true,
      });

      expect(contexts).toEqual([]);
    });

    it('should handle Pinecone search failure with recovery', async () => {
      (PineconeService.search as any).mockRejectedValueOnce(new Error('Search failed'));
      (ErrorRecoveryService.attemptRecovery as any).mockResolvedValueOnce({
        recovered: true,
        result: [],
        strategy: 'retry',
        attempts: 2,
      });

      const contexts = await RAGService.retrieveDocumentContext(mockQuery, baseOptions);

      expect(contexts).toEqual([]);
    });

    it('should apply fallback threshold when results are too few', async () => {
      (PineconeService.search as any).mockResolvedValueOnce([]);
      (ThresholdOptimizerService.getConfig as any).mockReturnValue({
        minThreshold: 0.3,
        fallbackEnabled: true,
      });

      await RAGService.retrieveDocumentContext(mockQuery, {
        ...baseOptions,
        useAdaptiveThreshold: true,
        minResults: 3,
      });

      expect(PineconeService.search).toHaveBeenCalledTimes(2);
    });

    it('should filter results by hard minimum threshold', async () => {
      (PineconeService.search as any).mockResolvedValueOnce([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          content: 'Content',
          chunkIndex: 0,
          score: 0.2, // Below hard minimum
          metadata: {},
        },
      ]);
      (ThresholdOptimizerService.getConfig as any).mockReturnValue({
        minThreshold: 0.3,
        fallbackEnabled: true,
      });

      const contexts = await RAGService.retrieveDocumentContext(mockQuery, baseOptions);

      expect(contexts).toEqual([]);
    });

    it('should handle document metadata fetch failure gracefully', async () => {
      (DocumentService.getDocumentsBatch as any).mockResolvedValueOnce(new Map());

      const contexts = await RAGService.retrieveDocumentContext(mockQuery, baseOptions);

      expect(contexts).toHaveLength(1);
      expect(contexts[0].documentName).toBe('Unknown Document');
    });
  });

  describe('retrieveDocumentContextKeyword', () => {
    const baseOptions: RAGOptions = {
      userId: mockUserId,
      enableKeywordSearch: true,
      maxDocumentChunks: 5,
    };

    it('should retrieve document context using keyword search', async () => {
      const results = await RAGService.retrieveDocumentContextKeyword(mockQuery, baseOptions);

      expect(results).toHaveLength(1);
      expect(results[0].documentId).toBe('doc-1');
      expect(KeywordSearchService.search).toHaveBeenCalled();
    });

    it('should return empty array when keyword search is disabled', async () => {
      const results = await RAGService.retrieveDocumentContextKeyword(mockQuery, {
        ...baseOptions,
        enableKeywordSearch: false,
      });

      expect(results).toEqual([]);
      expect(KeywordSearchService.search).not.toHaveBeenCalled();
    });

    it('should expand query when query expansion is enabled', async () => {
      await RAGService.retrieveDocumentContextKeyword(mockQuery, {
        ...baseOptions,
        enableQueryExpansion: true,
      });

      expect(QueryExpansionService.expandQuery).toHaveBeenCalled();
    });

    it('should handle keyword search failure gracefully', async () => {
      (KeywordSearchService.search as any).mockRejectedValueOnce(
        new Error('Keyword search failed')
      );

      const results = await RAGService.retrieveDocumentContextKeyword(mockQuery, baseOptions);

      expect(results).toEqual([]);
    });
  });

  // ============================================================================
  // WEB SEARCH TESTS
  // ============================================================================

  describe('retrieveWebSearch', () => {
    const baseOptions: RAGOptions = {
      userId: mockUserId,
      enableWebSearch: true,
      maxWebResults: 5,
    };

    it('should retrieve web search results', async () => {
      const results = await RAGService.retrieveWebSearch(mockQuery, baseOptions);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe(mockWebSearchResult.title);
      expect(results[0].url).toBe(mockWebSearchResult.url);
      expect(SearchService.search).toHaveBeenCalled();
    });

    it('should return empty array when web search is disabled', async () => {
      const results = await RAGService.retrieveWebSearch(mockQuery, {
        ...baseOptions,
        enableWebSearch: false,
      });

      expect(results).toEqual([]);
      expect(SearchService.search).not.toHaveBeenCalled();
    });

    it('should include access date in web results', async () => {
      const results = await RAGService.retrieveWebSearch(mockQuery, baseOptions);

      const result = results[0] as any;
      expect(result.accessDate).toBeDefined();
      expect(new Date(result.accessDate).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should pass topic filter to search service', async () => {
      await RAGService.retrieveWebSearch(mockQuery, {
        ...baseOptions,
        topic: 'AI',
      });

      expect(SearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'AI',
        })
      );
    });

    it('should pass time range filter to search service', async () => {
      await RAGService.retrieveWebSearch(mockQuery, {
        ...baseOptions,
        timeRange: 'month',
      });

      expect(SearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: 'month',
        })
      );
    });

    it('should pass date range filters to search service', async () => {
      await RAGService.retrieveWebSearch(mockQuery, {
        ...baseOptions,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(SearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })
      );
    });

    it('should pass country filter to search service', async () => {
      await RAGService.retrieveWebSearch(mockQuery, {
        ...baseOptions,
        country: 'US',
      });

      expect(SearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'US',
        })
      );
    });

    it('should handle web search failure with recovery', async () => {
      (SearchService.search as any).mockRejectedValueOnce(new Error('Search failed'));
      (ErrorRecoveryService.attemptRecovery as any).mockResolvedValueOnce({
        recovered: true,
        result: { results: [] },
        strategy: 'retry',
        attempts: 2,
      });

      const results = await RAGService.retrieveWebSearch(mockQuery, baseOptions);

      expect(results).toEqual([]);
    });

    it('should handle web search failure without recovery', async () => {
      (SearchService.search as any).mockRejectedValueOnce(new Error('Search failed'));
      (ErrorRecoveryService.attemptRecovery as any).mockResolvedValueOnce({
        recovered: false,
        result: null,
        strategy: 'none',
        attempts: 1,
      });

      const results = await RAGService.retrieveWebSearch(mockQuery, baseOptions);

      expect(results).toEqual([]);
    });

    it('should return empty array when no results found', async () => {
      (SearchService.search as any).mockResolvedValueOnce({ results: [] });

      const results = await RAGService.retrieveWebSearch(mockQuery, baseOptions);

      expect(results).toEqual([]);
    });
  });

  // ============================================================================
  // CONTEXT RETRIEVAL TESTS
  // ============================================================================

  describe('retrieveContext', () => {
    const baseOptions: RAGOptions = {
      userId: mockUserId,
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      maxWebResults: 5,
    };

    it('should retrieve combined RAG context', async () => {
      const context = await RAGService.retrieveContext(mockQuery, baseOptions);

      expect(context.documentContexts).toHaveLength(1);
      expect(context.webSearchResults).toHaveLength(1);
      expect(context.documentContexts[0].documentId).toBe('doc-1');
      expect(context.webSearchResults[0].title).toBe(mockWebSearchResult.title);
    });

    it('should retrieve context from cache when available', async () => {
      const cachedContext: RAGContext = {
        documentContexts: [mockDocumentContext],
        webSearchResults: [mockWebSearchResult],
      };
      (RedisCacheService.get as any).mockResolvedValueOnce(cachedContext);

      const context = await RAGService.retrieveContext(mockQuery, baseOptions);

      expect(context).toEqual(cachedContext);
      expect(RedisCacheService.recordRAGHit).toHaveBeenCalled();
      expect(PineconeService.search).not.toHaveBeenCalled();
    });

    it('should use similarity-based cache lookup when enabled', async () => {
      const cachedContext: RAGContext = {
        documentContexts: [mockDocumentContext],
        webSearchResults: [mockWebSearchResult],
      };
      (RedisCacheService.get as any).mockResolvedValueOnce(null);
      (RedisCacheService.findSimilarEntries as any).mockResolvedValueOnce([
        {
          similarity: 0.9,
          value: cachedContext,
        },
      ]);

      const context = await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableSimilarityLookup: true,
        contextCacheSimilarityThreshold: 0.85,
      });

      expect(context).toEqual(cachedContext);
      expect(RedisCacheService.recordRAGSimilarityHit).toHaveBeenCalled();
    });

    it('should cache context after retrieval', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableContextCache: true,
      });

      expect(RedisCacheService.setWithEmbedding).toHaveBeenCalled();
      expect(RedisCacheService.recordRAGSet).toHaveBeenCalled();
    });

    it('should combine semantic and keyword search results when both enabled', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableKeywordSearch: true,
      });

      expect(HybridSearchService.performHybridSearch).toHaveBeenCalled();
    });

    it('should use semantic search only when keyword search is disabled', async () => {
      const context = await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableKeywordSearch: false,
      });

      expect(context.documentContexts).toHaveLength(1);
      expect(HybridSearchService.performHybridSearch).not.toHaveBeenCalled();
    });

    it('should use keyword search only when document search is disabled', async () => {
      const context = await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableDocumentSearch: false,
        enableKeywordSearch: true,
      });

      expect(context.documentContexts).toHaveLength(1);
      expect(context.documentContexts[0].documentId).toBe('doc-1');
    });

    it('should apply reranking when enabled', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableReranking: true,
        rerankingStrategy: 'score-based',
      });

      expect(RerankingService.rerank).toHaveBeenCalled();
    });

    it('should apply deduplication when enabled', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableResultDeduplication: true,
      });

      expect(DeduplicationService.deduplicate).toHaveBeenCalled();
    });

    it('should apply diversity filtering when enabled', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableDiversityFilter: true,
        diversityLambda: 0.5,
      });

      expect(DiversityFilterService.applyMMR).toHaveBeenCalled();
    });

    it('should calculate dynamic limits when enabled', async () => {
      const RAGConfig = (await import('../../config/rag.config')).RAGConfig;
      const calculateDynamicLimitsSpy = jest.spyOn(RAGConfig, 'calculateDynamicLimits');
      calculateDynamicLimitsSpy.mockReturnValue({
        documentChunks: 10,
        webResults: 8,
        factors: {
          tokenBudget: 5000,
          complexity: 'medium',
        },
        reasoning: 'Dynamic calculation',
      });

      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableDynamicLimits: true,
      });

      expect(calculateDynamicLimitsSpy).toHaveBeenCalled();
    });

    it('should apply adaptive context selection when enabled', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableAdaptiveContextSelection: true,
      });

      expect(AdaptiveContextService.selectAdaptiveContext).toHaveBeenCalled();
    });

    it('should refine context selection when adaptive options provided', async () => {
      await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableAdaptiveContextSelection: true,
        adaptiveContextOptions: {
          preferDocuments: true,
        },
      });

      expect(AdaptiveContextService.refineContextSelection).toHaveBeenCalled();
    });

    it('should handle parallel retrieval failures gracefully', async () => {
      (PineconeService.search as any).mockRejectedValueOnce(new Error('Search failed'));
      (SearchService.search as any).mockRejectedValueOnce(new Error('Web search failed'));

      const context = await RAGService.retrieveContext(mockQuery, baseOptions);

      expect(context.documentContexts).toEqual([]);
      expect(context.webSearchResults).toEqual([]);
    });

    it('should include degradation information in context', async () => {
      (DegradationService.getOverallStatus as any).mockReturnValueOnce({
        level: DegradationLevel.PARTIAL,
        affectedServices: ['PINECONE'],
        message: 'Pinecone is degraded',
      });

      const context = await RAGService.retrieveContext(mockQuery, baseOptions);

      expect(context.degraded).toBe(true);
      expect(context.degradationLevel).toBe(DegradationLevel.PARTIAL);
      expect(context.affectedServices).toEqual(['PINECONE']);
    });

    it('should mark context as partial when services fail', async () => {
      (PineconeService.search as any).mockRejectedValueOnce(new Error('Search failed'));
      (DegradationService.getOverallStatus as any).mockReturnValueOnce({
        level: DegradationLevel.PARTIAL,
        affectedServices: ['PINECONE'],
        message: 'Pinecone is degraded',
      });

      const context = await RAGService.retrieveContext(mockQuery, baseOptions);

      expect(context.partial).toBe(true);
    });

    it('should collect metrics after retrieval', async () => {
      await RAGService.retrieveContext(mockQuery, baseOptions);

      expect(MetricsService.collectMetrics).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      (RedisCacheService.get as any).mockRejectedValueOnce(new Error('Cache error'));

      const context = await RAGService.retrieveContext(mockQuery, {
        ...baseOptions,
        enableContextCache: true,
      });

      expect(context.documentContexts).toHaveLength(1);
      expect(RedisCacheService.recordRAGError).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CONTEXT FORMATTING TESTS
  // ============================================================================

  describe('formatContextForPrompt', () => {
    const mockContext: RAGContext = {
      documentContexts: [mockDocumentContext],
      webSearchResults: [mockWebSearchResult],
    };

    it('should format context for prompt', async () => {
      const formatted = await RAGService.formatContextForPrompt(mockContext, {});

      expect(formatted).toContain('Relevant Document Excerpts');
      expect(formatted).toContain('Web Search Results');
      expect(formatted).toContain(mockDocumentContext.content);
      expect(formatted).toContain(mockWebSearchResult.content);
    });

    it('should apply relevance ordering when enabled', async () => {
      await RAGService.formatContextForPrompt(mockContext, {
        enableRelevanceOrdering: true,
      });

      expect(RelevanceOrderingService.orderContext).toHaveBeenCalled();
    });

    it('should apply context compression when enabled', async () => {
      (ContextCompressorService.compressContext as any).mockReturnValueOnce({
        wasCompressed: true,
        context: mockContext,
        compressionStats: {
          originalTokens: 1000,
          compressedTokens: 800,
          compressionRatio: 0.8,
          strategy: 'truncation',
          processingTimeMs: 50,
        },
      });

      await RAGService.formatContextForPrompt(mockContext, {
        enableContextCompression: true,
        query: mockQuery,
      });

      expect(ContextCompressorService.compressContext).toHaveBeenCalled();
    });

    it('should apply context summarization when enabled', async () => {
      (ContextSummarizerService.summarizeContext as any).mockResolvedValueOnce({
        wasSummarized: true,
        context: {
          ...mockContext,
          summarizationStats: {
            originalTokens: 1000,
            summarizedTokens: 600,
            compressionRatio: 0.6,
            itemsSummarized: 2,
            processingTimeMs: 200,
          },
        } as any,
      });

      await RAGService.formatContextForPrompt(mockContext, {
        enableContextSummarization: true,
        query: mockQuery,
      });

      expect(ContextSummarizerService.summarizeContext).toHaveBeenCalled();
    });

    it('should apply source prioritization when enabled', async () => {
      await RAGService.formatContextForPrompt(mockContext, {
        enableSourcePrioritization: true,
      });

      expect(SourcePrioritizerService.prioritizeContext).toHaveBeenCalled();
    });

    it('should apply token budgeting when enabled', async () => {
      await RAGService.formatContextForPrompt(mockContext, {
        enableTokenBudgeting: true,
        model: 'gpt-4',
        query: mockQuery,
      });

      expect(TokenBudgetService.calculateBudget).toHaveBeenCalled();
      expect(TokenBudgetService.checkBudget).toHaveBeenCalled();
    });

    it('should trim context when it exceeds token budget', async () => {
      (TokenBudgetService.checkBudget as any).mockReturnValueOnce({
        fits: false,
        contextTokens: {
          documentContext: 5000,
          webResults: 3000,
          total: 8000,
        },
        warnings: ['Context too large'],
        errors: [],
      });

      await RAGService.formatContextForPrompt(mockContext, {
        enableTokenBudgeting: true,
        model: 'gpt-4',
        query: mockQuery,
      });

      expect(TokenBudgetService.trimContextToBudget).toHaveBeenCalled();
    });

    it('should include document metadata in formatted output', async () => {
      const formatted = await RAGService.formatContextForPrompt(mockContext, {});

      expect(formatted).toContain('AI Document');
      expect(formatted).toContain('John Doe');
      expect(formatted).toContain('PDF');
      expect(formatted).toContain('1 KB');
    });

    it('should include web result metadata in formatted output', async () => {
      const formatted = await RAGService.formatContextForPrompt(mockContext, {});

      expect(formatted).toContain(mockWebSearchResult.title);
      expect(formatted).toContain(mockWebSearchResult.url);
      expect(formatted).toContain('CITING:');
    });

    it('should handle empty context', async () => {
      const emptyContext: RAGContext = {
        documentContexts: [],
        webSearchResults: [],
      };

      const formatted = await RAGService.formatContextForPrompt(emptyContext, {});

      expect(formatted).toBe('');
    });
  });

  // ============================================================================
  // SOURCE EXTRACTION TESTS
  // ============================================================================

  describe('extractSources', () => {
    const mockContext: RAGContext = {
      documentContexts: [
        {
          ...mockDocumentContext,
          score: 0.9, // Above threshold
        },
        {
          ...mockDocumentContext,
          documentId: 'doc-2',
          score: 0.5, // Below threshold
        },
      ],
      webSearchResults: [mockWebSearchResult],
    };

    it('should extract sources from RAG context', () => {
      const sources = RAGService.extractSources(mockContext);

      expect(sources).toHaveLength(2); // One document (above threshold) + one web result
      expect(sources[0].type).toBe('document');
      expect(sources[1].type).toBe('web');
    });

    it('should filter documents by score threshold', () => {
      const sources = RAGService.extractSources(mockContext);

      const documentSources = sources.filter((s) => s.type === 'document');
      expect(documentSources).toHaveLength(1);
      expect(documentSources[0].score).toBeGreaterThanOrEqual(0.6);
    });

    it('should include all web results', () => {
      const sources = RAGService.extractSources(mockContext);

      const webSources = sources.filter((s) => s.type === 'web');
      expect(webSources).toHaveLength(1);
      expect(webSources[0].url).toBe(mockWebSearchResult.url);
    });

    it('should include document metadata in sources', () => {
      const sources = RAGService.extractSources(mockContext);

      const docSource = sources.find((s) => s.type === 'document');
      expect(docSource?.metadata?.documentType).toBe('pdf');
      expect(docSource?.metadata?.author).toBe('John Doe');
      expect(docSource?.metadata?.fileSize).toBe(1024);
    });

    it('should include web result metadata in sources', () => {
      const sources = RAGService.extractSources(mockContext);

      const webSource = sources.find((s) => s.type === 'web');
      expect(webSource?.metadata?.publishedDate).toBe(mockWebSearchResult.publishedDate);
      expect(webSource?.metadata?.author).toBe(mockWebSearchResult.author);
    });

    it('should create snippets from content', () => {
      const sources = RAGService.extractSources(mockContext);

      sources.forEach((source) => {
        expect(source.snippet).toBeDefined();
        expect(source.snippet!.length).toBeLessThanOrEqual(203); // 200 + '...'
      });
    });

    it('should handle empty context', () => {
      const emptyContext: RAGContext = {
        documentContexts: [],
        webSearchResults: [],
      };

      const sources = RAGService.extractSources(emptyContext);

      expect(sources).toEqual([]);
    });
  });

  // ============================================================================
  // CACHE OPERATIONS TESTS
  // ============================================================================

  describe('cache operations', () => {
    it('should invalidate user cache', async () => {
      (RedisCacheService.deletePattern as any).mockResolvedValueOnce(5);

      const deleted = await RAGService.invalidateUserCache(mockUserId);

      expect(deleted).toBe(5);
      expect(RedisCacheService.deletePattern).toHaveBeenCalledWith(
        expect.stringContaining(mockUserId),
        expect.any(Object)
      );
    });

    it('should invalidate topic cache', async () => {
      (RedisCacheService.deletePattern as any).mockResolvedValueOnce(3);

      const deleted = await RAGService.invalidateTopicCache(mockUserId, mockTopicId);

      expect(deleted).toBe(3);
      expect(RedisCacheService.deletePattern).toHaveBeenCalledWith(
        expect.stringContaining(mockUserId),
        expect.any(Object)
      );
    });

    it('should invalidate document cache', async () => {
      (RedisCacheService.deletePattern as any).mockResolvedValue(2);

      const deleted = await RAGService.invalidateDocumentCache(mockUserId, ['doc-1', 'doc-2']);

      expect(deleted).toBe(4); // 2 per document
      expect(RedisCacheService.deletePattern).toHaveBeenCalledTimes(2);
    });

    it('should clear all RAG cache', async () => {
      (RedisCacheService.clearAll as any).mockResolvedValueOnce(10);

      const deleted = await RAGService.clearAllRAGCache();

      expect(deleted).toBe(10);
      expect(RedisCacheService.clearAll).toHaveBeenCalled();
    });

    it('should get RAG cache statistics', () => {
      const stats = RAGService.getRAGCacheStats();

      expect(stats).toBeDefined();
      expect(RedisCacheService.getRAGStats).toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      (RedisCacheService.deletePattern as any).mockRejectedValueOnce(
        new Error('Cache error')
      );

      const deleted = await RAGService.invalidateUserCache(mockUserId);

      expect(deleted).toBe(0);
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle empty query', async () => {
      const context = await RAGService.retrieveContext('', {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
      });

      expect(context.documentContexts).toEqual([]);
      expect(context.webSearchResults).toEqual([]);
    });

    it('should handle very long query', async () => {
      const longQuery = 'a '.repeat(10000);
      const context = await RAGService.retrieveContext(longQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
      });

      expect(context).toBeDefined();
    });

    it('should handle all search types disabled', async () => {
      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: false,
        enableWebSearch: false,
        enableKeywordSearch: false,
      });

      expect(context.documentContexts).toEqual([]);
      expect(context.webSearchResults).toEqual([]);
    });

    it('should handle missing userId', async () => {
      await expect(
        RAGService.retrieveContext(mockQuery, {
          userId: '',
          enableDocumentSearch: true,
        })
      ).resolves.toBeDefined();
    });

    it('should handle context formatting with no documents', async () => {
      const context: RAGContext = {
        documentContexts: [],
        webSearchResults: [mockWebSearchResult],
      };

      const formatted = await RAGService.formatContextForPrompt(context, {});

      expect(formatted).toContain('Web Search Results');
      expect(formatted).not.toContain('Relevant Document Excerpts');
    });

    it('should handle context formatting with no web results', async () => {
      const context: RAGContext = {
        documentContexts: [mockDocumentContext],
        webSearchResults: [],
      };

      const formatted = await RAGService.formatContextForPrompt(context, {});

      expect(formatted).toContain('Relevant Document Excerpts');
      expect(formatted).not.toContain('Web Search Results');
    });

    it('should handle cache similarity lookup below threshold', async () => {
      const cachedContext: RAGContext = {
        documentContexts: [mockDocumentContext],
        webSearchResults: [mockWebSearchResult],
      };
      (RedisCacheService.get as any).mockResolvedValueOnce(null);
      (RedisCacheService.findSimilarEntries as any).mockResolvedValueOnce([
        {
          similarity: 0.5, // Below threshold
          value: cachedContext,
        },
      ]);

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableSimilarityLookup: true,
        contextCacheSimilarityThreshold: 0.85,
      });

      expect(context.documentContexts).toHaveLength(1);
      expect(RedisCacheService.recordRAGSimilarityHit).not.toHaveBeenCalled();
    });

    it('should handle similarity lookup failure gracefully', async () => {
      (RedisCacheService.get as any).mockResolvedValueOnce(null);
      (RedisCacheService.findSimilarEntries as any).mockRejectedValueOnce(
        new Error('Similarity lookup failed')
      );

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableSimilarityLookup: true,
      });

      expect(context.documentContexts).toHaveLength(1);
    });

    it('should handle dynamic limit calculation failure', async () => {
      const RAGConfig = (await import('../../config/rag.config')).RAGConfig;
      const calculateDynamicLimitsSpy = jest.spyOn(RAGConfig, 'calculateDynamicLimits');
      calculateDynamicLimitsSpy.mockImplementation(() => {
        throw new Error('Calculation failed');
      });

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableDynamicLimits: true,
      });

      expect(context).toBeDefined();
      expect(context.documentContexts).toHaveLength(1);
    });

    it('should handle adaptive context selection failure', async () => {
      (AdaptiveContextService.selectAdaptiveContext as any).mockImplementation(() => {
        throw new Error('Selection failed');
      });

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableAdaptiveContextSelection: true,
      });

      expect(context).toBeDefined();
    });

    it('should handle context refinement failure', async () => {
      (AdaptiveContextService.refineContextSelection as any).mockImplementation(() => {
        throw new Error('Refinement failed');
      });

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableAdaptiveContextSelection: true,
        adaptiveContextOptions: {
          preferDocuments: true,
        },
      });

      expect(context).toBeDefined();
    });

    it('should handle reranking failure gracefully', async () => {
      (RerankingService.rerank as any).mockRejectedValueOnce(new Error('Reranking failed'));

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableReranking: true,
      });

      expect(context.documentContexts).toHaveLength(1);
    });

    it('should handle deduplication failure gracefully', async () => {
      (DeduplicationService.deduplicate as any).mockRejectedValueOnce(
        new Error('Deduplication failed')
      );

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableResultDeduplication: true,
      });

      expect(context.documentContexts).toHaveLength(1);
    });

    it('should handle diversity filtering failure gracefully', async () => {
      (DiversityFilterService.applyMMR as any).mockRejectedValueOnce(
        new Error('Diversity filtering failed')
      );

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableDiversityFilter: true,
      });

      expect(context.documentContexts).toHaveLength(1);
    });

    it('should handle metrics collection failure gracefully', async () => {
      (MetricsService.collectMetrics as any).mockRejectedValueOnce(
        new Error('Metrics failed')
      );

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
      });

      expect(context).toBeDefined();
    });

    it('should handle cache set failure gracefully', async () => {
      (RedisCacheService.setWithEmbedding as any).mockRejectedValueOnce(
        new Error('Cache set failed')
      );

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableContextCache: true,
      });

      expect(context).toBeDefined();
      expect(RedisCacheService.recordRAGError).toHaveBeenCalled();
    });

    it('should handle ordering failure gracefully', async () => {
      (RelevanceOrderingService.orderContext as any).mockImplementation(() => {
        throw new Error('Ordering failed');
      });

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [mockDocumentContext],
          webSearchResults: [mockWebSearchResult],
        },
        {
          enableRelevanceOrdering: true,
        }
      );

      expect(formatted).toBeDefined();
    });

    it('should handle compression failure gracefully', async () => {
      (ContextCompressorService.compressContext as any).mockImplementation(() => {
        throw new Error('Compression failed');
      });

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [mockDocumentContext],
          webSearchResults: [mockWebSearchResult],
        },
        {
          enableContextCompression: true,
        }
      );

      expect(formatted).toBeDefined();
    });

    it('should handle summarization failure gracefully', async () => {
      (ContextSummarizerService.summarizeContext as any).mockRejectedValueOnce(
        new Error('Summarization failed')
      );

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [mockDocumentContext],
          webSearchResults: [mockWebSearchResult],
        },
        {
          enableContextSummarization: true,
        }
      );

      expect(formatted).toBeDefined();
    });

    it('should handle prioritization failure gracefully', async () => {
      (SourcePrioritizerService.prioritizeContext as any).mockImplementation(() => {
        throw new Error('Prioritization failed');
      });

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [mockDocumentContext],
          webSearchResults: [mockWebSearchResult],
        },
        {
          enableSourcePrioritization: true,
        }
      );

      expect(formatted).toBeDefined();
    });

    it('should handle token budgeting failure gracefully', async () => {
      (TokenBudgetService.calculateBudget as any).mockImplementation(() => {
        throw new Error('Budget calculation failed');
      });

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [mockDocumentContext],
          webSearchResults: [mockWebSearchResult],
        },
        {
          enableTokenBudgeting: true,
          model: 'gpt-4',
        }
      );

      expect(formatted).toBeDefined();
    });

    it('should handle document with multiple authors', async () => {
      const docWithAuthors: DocumentContext = {
        ...mockDocumentContext,
        authors: ['John Doe', 'Jane Smith'],
      };

      const sources = RAGService.extractSources({
        documentContexts: [docWithAuthors],
        webSearchResults: [],
      });

      expect(sources[0].metadata?.authors).toEqual(['John Doe', 'Jane Smith']);
    });

    it('should handle document with published date', async () => {
      const docWithDate: DocumentContext = {
        ...mockDocumentContext,
        publishedDate: '2024-01-15',
      };

      const sources = RAGService.extractSources({
        documentContexts: [docWithDate],
        webSearchResults: [],
      });

      expect(sources[0].metadata?.publishedDate).toBe('2024-01-15');
    });

    it('should format high priority documents with star', async () => {
      const highPriorityDoc: DocumentContext = {
        ...mockDocumentContext,
        priority: 0.8,
      } as any;

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [highPriorityDoc],
          webSearchResults: [],
        },
        {
          enableSourcePrioritization: true,
        }
      );

      expect(formatted).toContain('⭐');
      expect(formatted).toContain('HIGH PRIORITY');
    });

    it('should format high priority web results with star', async () => {
      const highPriorityWeb = {
        ...mockWebSearchResult,
        priority: 0.8,
      } as any;

      const formatted = await RAGService.formatContextForPrompt(
        {
          documentContexts: [],
          webSearchResults: [highPriorityWeb],
        },
        {
          enableSourcePrioritization: true,
        }
      );

      expect(formatted).toContain('⭐');
      expect(formatted).toContain('HIGH PRIORITY');
    });

    it('should calculate cache TTL based on search types', async () => {
      // Web-only should have shorter TTL
      await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        enableContextCache: true,
      });

      expect(RedisCacheService.setWithEmbedding).toHaveBeenCalled();
      const callArgs = (RedisCacheService.setWithEmbedding as any).mock.calls[0];
      expect(callArgs[3].ttl).toBeLessThanOrEqual(1800);
    });

    it('should use custom cache TTL when provided', async () => {
      await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableContextCache: true,
        contextCacheTTL: 3600,
      });

      expect(RedisCacheService.setWithEmbedding).toHaveBeenCalled();
      const callArgs = (RedisCacheService.setWithEmbedding as any).mock.calls[0];
      expect(callArgs[3].ttl).toBe(3600);
    });

    it('should handle query expansion failure in document retrieval', async () => {
      (QueryExpansionService.expandQuery as any).mockRejectedValueOnce(
        new Error('Expansion failed')
      );

      const contexts = await RAGService.retrieveDocumentContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableQueryExpansion: true,
      });

      expect(contexts).toHaveLength(1);
    });

    it('should handle query expansion failure in keyword retrieval', async () => {
      (QueryExpansionService.expandQuery as any).mockRejectedValueOnce(
        new Error('Expansion failed')
      );

      const results = await RAGService.retrieveDocumentContextKeyword(mockQuery, {
        userId: mockUserId,
        enableKeywordSearch: true,
        enableQueryExpansion: true,
      });

      expect(results).toHaveLength(1);
    });

    it('should handle legacy context selector when adaptive is disabled', async () => {
      (AdaptiveContextService.selectAdaptiveContext as any).mockImplementation(() => {
        throw new Error('Not available');
      });

      const context = await RAGService.retrieveContext(mockQuery, {
        userId: mockUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableAdaptiveContextSelection: false,
        useAdaptiveContextSelection: true,
      });

      expect(context).toBeDefined();
      expect(ContextSelectorService.selectContextSize).toHaveBeenCalled();
    });
  });
});
