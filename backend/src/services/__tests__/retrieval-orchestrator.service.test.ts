/**
 * Unit tests for RetrievalOrchestratorService
 *
 * Tests the retrieval layer extracted from rag.service.ts:
 *   - Cache key generation
 *   - Cache TTL calculation
 *   - Limit calculation
 *   - Search result combination
 */

jest.mock('../../config/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../embedding.service', () => ({
  EmbeddingService: {
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
    getCurrentDimensions: jest.fn().mockReturnValue(1536),
    getCurrentModel: jest.fn().mockReturnValue('text-embedding-3-small'),
  },
}));

jest.mock('../pinecone.service', () => ({
  PineconeService: {
    search: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../search.service', () => ({
  SearchService: {
    search: jest.fn().mockResolvedValue({ results: [] }),
  },
}));

jest.mock('../document.service', () => ({
  DocumentService: {
    getDocumentsBatch: jest.fn().mockResolvedValue(new Map()),
  },
}));

jest.mock('../hybrid-search.service', () => ({
  HybridSearchService: {
    performHybridSearch: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../keyword-search.service', () => ({
  KeywordSearchService: {
    search: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../query-expansion.service', () => ({
  QueryExpansionService: {
    expandQuery: jest.fn(),
  },
}));

jest.mock('../threshold-optimizer.service', () => ({
  ThresholdOptimizerService: {
    calculateThreshold: jest.fn().mockReturnValue({
      threshold: 0.7,
      strategy: 'adaptive',
      queryType: 'factual',
      reasoning: 'default',
    }),
    getConfig: jest.fn().mockReturnValue({
      fallbackEnabled: true,
      minThreshold: 0.3,
    }),
  },
}));

jest.mock('../context-selector.service', () => ({
  ContextSelectorService: {
    selectContextSize: jest.fn().mockReturnValue({
      chunkCount: 5,
      complexity: { intentComplexity: 'medium', queryType: 'factual' },
      reasoning: 'default',
    }),
  },
}));

jest.mock('../adaptive-context.service', () => ({
  AdaptiveContextService: {
    selectAdaptiveContext: jest.fn().mockReturnValue({
      documentChunks: 5,
      webResults: 3,
      complexity: { intentComplexity: 'medium', queryType: 'factual' },
      tokenBudget: null,
      reasoning: 'default',
      adjustments: [],
    }),
    refineContextSelection: jest.fn(),
  },
}));

jest.mock('../../config/rag.config', () => ({
  RAGConfig: {
    calculateDynamicLimits: jest.fn().mockReturnValue({
      documentChunks: 5,
      webResults: 3,
      factors: { tokenBudget: 4000, complexity: 'medium' },
      reasoning: 'dynamic',
    }),
  },
}));

jest.mock('../redis-cache.service', () => ({
  RedisCacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    setWithEmbedding: jest.fn().mockResolvedValue(true),
    findSimilarEntries: jest.fn().mockResolvedValue([]),
    deletePattern: jest.fn().mockResolvedValue(0),
    clearAll: jest.fn().mockResolvedValue(0),
    getRAGStats: jest.fn().mockReturnValue({}),
    recordRAGMiss: jest.fn(),
    recordRAGHit: jest.fn(),
    recordRAGSimilarityHit: jest.fn(),
    recordRAGSet: jest.fn(),
    recordRAGError: jest.fn(),
  },
}));

jest.mock('../degradation.service', () => ({
  DegradationService: {
    getOverallStatus: jest.fn().mockReturnValue({
      level: 'NONE',
      affectedServices: [],
    }),
  },
  DegradationLevel: { NONE: 'NONE' },
  ServiceType: { EMBEDDING: 'EMBEDDING', PINECONE: 'PINECONE', SEARCH: 'SEARCH' },
}));

jest.mock('../error-recovery.service', () => ({
  ErrorRecoveryService: {
    attemptRecovery: jest.fn(),
  },
}));

jest.mock('../metrics.service', () => ({
  MetricsService: {
    collectMetrics: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../latency-tracker.service', () => ({
  LatencyTrackerService: {
    trackOperation: jest.fn().mockImplementation(async (_type, fn) => fn()),
  },
  OperationType: {
    KEYWORD_SEARCH: 'KEYWORD_SEARCH',
    DOCUMENT_SEARCH: 'DOCUMENT_SEARCH',
    WEB_SEARCH: 'WEB_SEARCH',
    EMBEDDING_GENERATION: 'EMBEDDING_GENERATION',
    PINECONE_QUERY: 'PINECONE_QUERY',
  },
}));

jest.mock('../../config/thresholds.config', () => ({
  RetrievalConfig: {
    minSimilarityScore: 0.7,
    keywordBaseMinScore: 0.3,
    keywordMinScoreMultiplier: 0.8,
    broadAnalysisMinScore: 0.3,
    sourceExtractionMinScore: 0.5,
    adaptiveFallbackReduction: 0.15,
    cacheSimThreshold: 0.85,
    highPriorityThreshold: 0.8,
    defaults: {
      maxDocumentChunks: 5,
      maxWebResults: 3,
      topK: 10,
      minResults: 2,
      maxResults: 20,
      defaultChunks: 5,
      minWebResults: 1,
      maxWebResultsCeiling: 10,
      maxDocumentChunksCeiling: 20,
    },
    weights: {
      semantic: 0.7,
      keyword: 0.3,
    },
    retry: {
      maxAttempts: 2,
      retryDelayMs: 1000,
      webRetryDelayMs: 1500,
    },
    processingTargets: {},
  },
  CacheTtlConfig: {
    ragMixed: 1800,
    ragWebOnly: 900,
    ragDocOnly: 3600,
  },
}));

jest.mock('../../config/pinecone', () => ({
  isPineconeConfigured: jest.fn().mockReturnValue(true),
}));

import { RetrievalOrchestratorService } from '../retrieval-orchestrator.service';
import type { RAGOptions } from '../rag.service';

describe('RetrievalOrchestratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateRAGCacheKey', () => {
    const baseOptions: RAGOptions = {
      userId: 'user-1',
      enableDocumentSearch: true,
      enableWebSearch: true,
      enableKeywordSearch: false,
    };

    it('should generate a consistent cache key for the same inputs', () => {
      const key1 = RetrievalOrchestratorService.generateRAGCacheKey('test query', baseOptions);
      const key2 = RetrievalOrchestratorService.generateRAGCacheKey('test query', baseOptions);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different queries', () => {
      const key1 = RetrievalOrchestratorService.generateRAGCacheKey('query A', baseOptions);
      const key2 = RetrievalOrchestratorService.generateRAGCacheKey('query B', baseOptions);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different users', () => {
      const key1 = RetrievalOrchestratorService.generateRAGCacheKey('test', baseOptions);
      const key2 = RetrievalOrchestratorService.generateRAGCacheKey('test', {
        ...baseOptions,
        userId: 'user-2',
      });
      expect(key1).not.toBe(key2);
    });

    it('should normalize query casing and whitespace', () => {
      const key1 = RetrievalOrchestratorService.generateRAGCacheKey('Test Query', baseOptions);
      const key2 = RetrievalOrchestratorService.generateRAGCacheKey('test  query', baseOptions);
      expect(key1).toBe(key2);
    });

    it('should include topic and document IDs in key', () => {
      const keyWithTopic = RetrievalOrchestratorService.generateRAGCacheKey('test', {
        ...baseOptions,
        topicId: 'topic-1',
      });
      const keyWithDocs = RetrievalOrchestratorService.generateRAGCacheKey('test', {
        ...baseOptions,
        documentIds: ['doc-1', 'doc-2'],
      });
      const keyPlain = RetrievalOrchestratorService.generateRAGCacheKey('test', baseOptions);

      expect(keyWithTopic).not.toBe(keyPlain);
      expect(keyWithDocs).not.toBe(keyPlain);
      expect(keyWithTopic).not.toBe(keyWithDocs);
    });
  });

  describe('calculateRAGCacheTTL', () => {
    it('should return custom TTL when provided', () => {
      const ttl = RetrievalOrchestratorService.calculateRAGCacheTTL({
        userId: 'u',
        contextCacheTTL: 600,
      });
      expect(ttl).toBe(600);
    });

    it('should return web-only TTL', () => {
      const ttl = RetrievalOrchestratorService.calculateRAGCacheTTL({
        userId: 'u',
        enableWebSearch: true,
        enableDocumentSearch: false,
      });
      expect(ttl).toBe(900); // CacheTtlConfig.ragWebOnly
    });

    it('should return doc-only TTL', () => {
      const ttl = RetrievalOrchestratorService.calculateRAGCacheTTL({
        userId: 'u',
        enableDocumentSearch: true,
        enableWebSearch: false,
      });
      expect(ttl).toBe(3600); // CacheTtlConfig.ragDocOnly
    });

    it('should return mixed TTL as default', () => {
      const ttl = RetrievalOrchestratorService.calculateRAGCacheTTL({
        userId: 'u',
        enableDocumentSearch: true,
        enableWebSearch: true,
      });
      expect(ttl).toBe(1800); // CacheTtlConfig.ragMixed
    });
  });

  describe('calculateLimits', () => {
    it('should use provided limits when specified', () => {
      const result = RetrievalOrchestratorService.calculateLimits('test query', {
        userId: 'u',
        maxDocumentChunks: 10,
        maxWebResults: 5,
        enableDynamicLimits: false,
        useAdaptiveContextSelection: false,
        enableAdaptiveContextSelection: false,
      });

      expect(result.maxDocumentChunks).toBe(10);
      expect(result.maxWebResults).toBe(5);
    });

    it('should fall back to defaults when dynamic limits disabled', () => {
      const result = RetrievalOrchestratorService.calculateLimits('test query', {
        userId: 'u',
        enableDynamicLimits: false,
        useAdaptiveContextSelection: false,
        enableAdaptiveContextSelection: false,
      });

      expect(result.maxDocumentChunks).toBe(5); // RetrievalConfig.defaults.maxDocumentChunks
      expect(result.maxWebResults).toBe(3); // RetrievalConfig.defaults.maxWebResults
    });
  });

  describe('checkCache', () => {
    it('should return null when cache is disabled', async () => {
      const result = await RetrievalOrchestratorService.checkCache('query', {
        userId: 'u',
        enableContextCache: false,
      });

      expect(result).toBeNull();
    });
  });

  describe('expandQueryIfEnabled', () => {
    it('should return original query when expansion disabled', async () => {
      const result = await RetrievalOrchestratorService.expandQueryIfEnabled('my query', {
        userId: 'u',
        enableQueryExpansion: false,
      });

      expect(result).toBe('my query');
    });
  });
});
