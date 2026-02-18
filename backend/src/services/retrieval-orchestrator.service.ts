/**
 * Retrieval Orchestrator Service
 *
 * Handles the retrieval layer of the RAG pipeline:
 * - Parallel retrieval (semantic, keyword, web search)
 * - Hybrid result merging
 * - Query expansion
 * - Adaptive threshold calculation
 * - Dynamic limits and adaptive context selection
 * - Cache check / store logic
 *
 * Extracted from rag.service.ts for better separation of concerns.
 */

import { EmbeddingService } from './embedding.service';
import { PineconeService } from './pinecone.service';
import { SearchService, SearchRequest } from './search.service';
import { DocumentService } from './document.service';
import { HybridSearchService } from './hybrid-search.service';
import { KeywordSearchService, KeywordSearchResult } from './keyword-search.service';
import { QueryExpansionService } from './query-expansion.service';
import { ThresholdOptimizerService } from './threshold-optimizer.service';
import { ContextSelectorService, ContextSelectionOptions } from './context-selector.service';
import { AdaptiveContextService, AdaptiveContextOptions } from './adaptive-context.service';
import { RAGConfig, DynamicLimitOptions } from '../config/rag.config';
import { RedisCacheService } from './redis-cache.service';
import { DegradationService, ServiceType, DegradationLevel } from './degradation.service';
import { ErrorRecoveryService, RecoveryConfig } from './error-recovery.service';
import { MetricsService } from './metrics.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import logger from '../config/logger';
import { RetrievalConfig, CacheTtlConfig } from '../config/thresholds.config';

import type { DocumentContext, RAGContext, RAGOptions } from './rag.service';

/**
 * Result from the retrieval orchestration phase (before pipeline processing).
 * Contains raw retrieval results plus degradation status.
 */
export interface RetrievalResult {
  documentContexts: DocumentContext[];
  webSearchResults: RAGContext['webSearchResults'];
  degraded: boolean;
  degradationLevel: DegradationLevel;
  affectedServices?: ServiceType[];
  degradationMessage?: string;
  partial?: boolean;
}

export class RetrievalOrchestratorService {
  // ── Cache configuration ───────────────────────────────────────────
  private static readonly RAG_CACHE_PREFIX = 'rag';
  private static readonly DEFAULT_RAG_CACHE_TTL = CacheTtlConfig.ragMixed;
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = RetrievalConfig.cacheSimThreshold;

  // ═══════════════════════════════════════════════════════════════════
  // Cache helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generate cache key for RAG context.
   */
  static generateRAGCacheKey(query: string, options: RAGOptions): string {
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const parts = [
      options.userId,
      options.topicId || '',
      (options.documentIds || []).sort().join(','),
      options.enableDocumentSearch ? '1' : '0',
      options.enableWebSearch ? '1' : '0',
      options.enableKeywordSearch ? '1' : '0',
      options.maxDocumentChunks || RetrievalConfig.defaults.maxDocumentChunks,
      options.maxWebResults || RetrievalConfig.defaults.maxWebResults,
      options.minScore || RetrievalConfig.minSimilarityScore,
      normalizedQuery.substring(0, 200),
    ];
    return parts.join('|');
  }

  /**
   * Calculate TTL based on data freshness needs.
   */
  static calculateRAGCacheTTL(options: RAGOptions): number {
    if (options.contextCacheTTL) return options.contextCacheTTL;
    if (options.enableWebSearch && !options.enableDocumentSearch) return CacheTtlConfig.ragWebOnly;
    if (options.enableDocumentSearch && !options.enableWebSearch) return CacheTtlConfig.ragDocOnly;
    return this.DEFAULT_RAG_CACHE_TTL;
  }

  /**
   * Attempt to retrieve RAG context from cache (exact + similarity).
   * Returns null on miss or cache error.
   */
  static async checkCache(
    query: string,
    options: RAGOptions
  ): Promise<RAGContext | null> {
    const enableContextCache = options.enableContextCache ?? true;
    const enableSimilarityLookup = options.enableSimilarityLookup ?? true;
    const similarityThreshold = options.contextCacheSimilarityThreshold ?? this.DEFAULT_SIMILARITY_THRESHOLD;

    if (!enableContextCache) {
      RedisCacheService.recordRAGMiss();
      return null;
    }

    try {
      const cacheKey = this.generateRAGCacheKey(query, options);

      // Exact match
      const cached = await RedisCacheService.get<RAGContext>(cacheKey, {
        prefix: this.RAG_CACHE_PREFIX,
        ttl: this.calculateRAGCacheTTL(options),
      });

      if (cached) {
        RedisCacheService.recordRAGHit();
        logger.info('RAG context retrieved from cache (exact match)', {
          userId: options.userId,
          query: query.substring(0, 100),
          documentChunks: cached.documentContexts.length,
          webResults: cached.webSearchResults.length,
        });
        return cached;
      }

      // Similarity-based lookup
      if (enableSimilarityLookup) {
        try {
          const queryEmbedding = await EmbeddingService.generateEmbedding(query);
          const similarEntries = await RedisCacheService.findSimilarEntries<RAGContext>(
            queryEmbedding,
            {
              prefix: this.RAG_CACHE_PREFIX,
              similarityThreshold,
              maxResults: 1,
            }
          );

          if (similarEntries.length > 0 && similarEntries[0].similarity >= similarityThreshold) {
            const similarContext = similarEntries[0].value;
            RedisCacheService.recordRAGSimilarityHit();
            logger.info('RAG context retrieved from cache (similarity match)', {
              userId: options.userId,
              query: query.substring(0, 100),
              similarity: similarEntries[0].similarity,
              documentChunks: similarContext.documentContexts.length,
              webResults: similarContext.webSearchResults.length,
            });
            return similarContext;
          }
        } catch (similarityError: any) {
          logger.warn('Similarity-based cache lookup failed, continuing with retrieval', {
            error: similarityError.message,
          });
        }
      }

      RedisCacheService.recordRAGMiss();
    } catch (cacheError: any) {
      logger.warn('RAG context cache check failed, continuing with retrieval', {
        error: cacheError.message,
      });
      RedisCacheService.recordRAGError();
    }

    return null;
  }

  /**
   * Store RAG context in cache with embedding for similarity lookup.
   */
  static async storeCache(
    query: string,
    options: RAGOptions,
    ragContext: RAGContext
  ): Promise<void> {
    const enableContextCache = options.enableContextCache ?? true;
    if (!enableContextCache) return;

    try {
      const cacheKey = this.generateRAGCacheKey(query, options);
      const cacheTTL = this.calculateRAGCacheTTL(options);
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      await RedisCacheService.setWithEmbedding(cacheKey, ragContext, queryEmbedding, {
        prefix: this.RAG_CACHE_PREFIX,
        ttl: cacheTTL,
      });

      RedisCacheService.recordRAGSet();
      logger.debug('RAG context cached', {
        userId: options.userId,
        query: query.substring(0, 100),
        ttl: cacheTTL,
        documentChunks: ragContext.documentContexts.length,
        webResults: ragContext.webSearchResults.length,
      });
    } catch (cacheError: any) {
      RedisCacheService.recordRAGError();
      logger.warn('Failed to cache RAG context', {
        error: cacheError.message,
        userId: options.userId,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Query expansion
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Expand query if expansion is enabled.
   */
  static async expandQueryIfEnabled(query: string, options: RAGOptions): Promise<string> {
    if (!options.enableQueryExpansion) return query;

    try {
      const expansion = await QueryExpansionService.expandQuery(query, {
        strategy: options.expansionStrategy || 'hybrid',
        maxExpansions: options.maxExpansions ?? 5,
        useCache: true,
        context: options.topicId ? `Topic ID: ${options.topicId}` : undefined,
      });

      logger.info('Query expanded for retrieval', {
        originalQuery: query.substring(0, 100),
        expandedQuery: expansion.expandedQuery.substring(0, 150),
        expansionCount: expansion.expandedTerms.length,
        strategy: expansion.strategy,
      });

      return expansion.expandedQuery;
    } catch (error: any) {
      logger.warn('Query expansion failed, using original query', {
        query: query.substring(0, 100),
        error: error.message,
      });
      return query;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Individual retrieval methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Retrieve relevant document chunks using keyword search (BM25).
   */
  static async retrieveDocumentContextKeyword(
    query: string,
    options: RAGOptions
  ): Promise<KeywordSearchResult[]> {
    if (!options.enableKeywordSearch) return [];

    return await LatencyTrackerService.trackOperation(
      OperationType.KEYWORD_SEARCH,
      async () => this.retrieveDocumentContextKeywordInternal(query, options),
      { userId: options.userId, metadata: { topicId: options.topicId } }
    );
  }

  private static async retrieveDocumentContextKeywordInternal(
    query: string,
    options: RAGOptions
  ): Promise<KeywordSearchResult[]> {
    try {
      const expandedQuery = await this.expandQueryIfEnabled(query, options);

      logger.info('Performing keyword search', {
        userId: options.userId,
        originalQuery: query.substring(0, 100),
        expandedQuery: expandedQuery.substring(0, 150),
        expansionEnabled: options.enableQueryExpansion,
      });

      const keywordResults = await KeywordSearchService.search(expandedQuery, {
        userId: options.userId,
        topicId: options.topicId,
        documentIds: options.documentIds,
        topK: options.maxDocumentChunks || RetrievalConfig.defaults.topK,
        minScore: (options.minScore || RetrievalConfig.keywordBaseMinScore) * RetrievalConfig.keywordMinScoreMultiplier,
      });

      logger.info('Keyword search completed', {
        userId: options.userId,
        resultsCount: keywordResults.length,
      });

      return keywordResults;
    } catch (error: any) {
      logger.warn('Keyword search failed, continuing without keyword results', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Retrieve relevant document chunks from Pinecone (semantic search).
   */
  static async retrieveDocumentContext(
    query: string,
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    if (!options.enableDocumentSearch) return [];

    return await LatencyTrackerService.trackOperation(
      OperationType.DOCUMENT_SEARCH,
      async () => this.retrieveDocumentContextInternal(query, options),
      {
        userId: options.userId,
        metadata: { enableKeywordSearch: options.enableKeywordSearch, topicId: options.topicId },
      }
    );
  }

  private static async retrieveDocumentContextInternal(
    query: string,
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    try {
      const expandedQuery = await this.expandQueryIfEnabled(query, options);

      logger.info('Generating query embedding for document retrieval', {
        userId: options.userId,
        queryLength: query.length,
        expandedQueryLength: expandedQuery.length,
        expansionEnabled: options.enableQueryExpansion,
      });

      let queryEmbedding: number[];
      try {
        queryEmbedding = await LatencyTrackerService.trackOperation(
          OperationType.EMBEDDING_GENERATION,
          async () => EmbeddingService.generateEmbedding(expandedQuery),
          { userId: options.userId, metadata: { queryLength: expandedQuery.length } }
        );
      } catch (embeddingError: any) {
        const recoveryConfig: RecoveryConfig = {
          maxAttempts: RetrievalConfig.retry.maxAttempts,
          retryDelay: RetrievalConfig.retry.retryDelayMs,
          enableFallback: options.enableKeywordSearch,
          enableDegradation: true,
        };

        const fallbackFn = options.enableKeywordSearch
          ? async () => {
              logger.info('Using keyword search as fallback for embedding failure', { userId: options.userId });
              return [] as number[];
            }
          : undefined;

        const recoveryResult = await ErrorRecoveryService.attemptRecovery(
          ServiceType.EMBEDDING,
          embeddingError,
          async () => EmbeddingService.generateEmbedding(expandedQuery),
          fallbackFn,
          recoveryConfig
        );

        if (recoveryResult.recovered && recoveryResult.result !== null) {
          queryEmbedding = recoveryResult.result;
          logger.info('Embedding generation recovered', {
            userId: options.userId,
            strategy: recoveryResult.strategy,
            attempts: recoveryResult.attempts,
          });
        } else if (recoveryResult.recovered && recoveryResult.result === null && options.enableKeywordSearch) {
          logger.warn('Embedding generation failed, falling back to keyword search', {
            error: embeddingError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
          });
          return [];
        } else {
          logger.error('Embedding generation failed and recovery unsuccessful', {
            error: embeddingError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
            recoveryError: recoveryResult.error?.message,
          });
          throw embeddingError;
        }
      }

      const embeddingDimensions = EmbeddingService.getCurrentDimensions();
      const embeddingModel = EmbeddingService.getCurrentModel();

      const { isPineconeConfigured } = await import('../config/pinecone');
      if (!isPineconeConfigured()) {
        logger.warn('Pinecone is not configured - document search unavailable', {
          userId: options.userId,
          message: 'PINECONE_API_KEY environment variable is not set. Document search requires Pinecone to be configured.',
        });
        return [];
      }

      // Calculate adaptive threshold if enabled
      const useAdaptiveThreshold = options.useAdaptiveThreshold ?? true;
      let minScore = options.minScore;

      if (useAdaptiveThreshold && minScore === undefined) {
        const broadSearchResults = await PineconeService.search(
          queryEmbedding,
          {
            userId: options.userId,
            topK: Math.min(50, (options.maxDocumentChunks || RetrievalConfig.defaults.topK) * 3),
            topicId: options.topicId,
            documentIds: options.documentIds,
            minScore: RetrievalConfig.broadAnalysisMinScore,
            // NOTE: Do NOT filter by embeddingModel — vectors stored before this
            // field was added to metadata would be incorrectly excluded.
          },
          embeddingDimensions
        ).catch(() => []);

        const thresholdResult = ThresholdOptimizerService.calculateThreshold(
          query,
          broadSearchResults,
          {
            minResults: options.minResults || RetrievalConfig.defaults.minResults,
            maxResults: options.maxResults || options.maxDocumentChunks || RetrievalConfig.defaults.maxResults,
          }
        );

        minScore = thresholdResult.threshold;

        logger.info('Adaptive threshold calculated', {
          userId: options.userId,
          query: query.substring(0, 100),
          threshold: minScore,
          strategy: thresholdResult.strategy,
          queryType: thresholdResult.queryType,
          reasoning: thresholdResult.reasoning,
          initialResultsCount: broadSearchResults.length,
        });
      } else {
        minScore = minScore || RetrievalConfig.minSimilarityScore;
      }

      logger.info('Searching Pinecone for document chunks', {
        userId: options.userId,
        query: query.substring(0, 100),
        topK: options.maxDocumentChunks || RetrievalConfig.defaults.maxDocumentChunks,
        minScore,
        topicId: options.topicId,
        documentIds: options.documentIds,
        embeddingModel,
        embeddingDimensions,
        adaptiveThreshold: useAdaptiveThreshold,
      });

      let searchResults: any[] = [];
      try {
        searchResults = await LatencyTrackerService.trackOperation(
          OperationType.PINECONE_QUERY,
          async () => PineconeService.search(
            queryEmbedding,
            {
              userId: options.userId,
              topK: options.maxDocumentChunks || RetrievalConfig.defaults.topK,
              topicId: options.topicId,
              documentIds: options.documentIds,
              minScore,
              // NOTE: Do NOT filter by embeddingModel — vectors stored before this
              // field was added to metadata would be incorrectly excluded.
            },
            embeddingDimensions
          ),
          { userId: options.userId, metadata: { topK: options.maxDocumentChunks || RetrievalConfig.defaults.topK, minScore } }
        );
      } catch (searchError: any) {
        if (searchError.code === 'PINECONE_NOT_CONFIGURED') {
          logger.warn('Pinecone not configured, skipping document search', { userId: options.userId });
          return [];
        }

        const recoveryConfig: RecoveryConfig = {
          maxAttempts: RetrievalConfig.retry.maxAttempts,
          retryDelay: RetrievalConfig.retry.retryDelayMs,
          enableFallback: options.enableKeywordSearch,
          enableDegradation: true,
        };

        const fallbackFn = options.enableKeywordSearch
          ? async () => {
              logger.info('Using keyword search as fallback for Pinecone failure', { userId: options.userId });
              return [] as any[];
            }
          : undefined;

        const recoveryResult = await ErrorRecoveryService.attemptRecovery(
          ServiceType.PINECONE,
          searchError,
          async () => PineconeService.search(
            queryEmbedding,
            {
              userId: options.userId,
              topK: options.maxDocumentChunks || RetrievalConfig.defaults.topK,
              topicId: options.topicId,
              documentIds: options.documentIds,
              minScore,
              // NOTE: Do NOT filter by embeddingModel
            },
            embeddingDimensions
          ),
          fallbackFn,
          recoveryConfig
        );

        if (recoveryResult.recovered && recoveryResult.result !== null && Array.isArray(recoveryResult.result)) {
          searchResults = recoveryResult.result;
          logger.info('Pinecone search recovered', {
            userId: options.userId,
            strategy: recoveryResult.strategy,
            attempts: recoveryResult.attempts,
            resultsCount: searchResults.length,
          });
        } else if (recoveryResult.recovered && recoveryResult.result === null && options.enableKeywordSearch) {
          logger.warn('Pinecone search failed, falling back to keyword search', {
            error: searchError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
          });
          return [];
        } else {
          logger.error('Pinecone search failed and recovery unsuccessful', {
            error: searchError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
            recoveryError: recoveryResult.error?.message,
          });

          if (options.enableKeywordSearch) return [];
          throw searchError;
        }
      }

      // Adaptive fallback for low result count
      if (useAdaptiveThreshold && searchResults.length < (options.minResults || RetrievalConfig.defaults.minResults)) {
        const config = ThresholdOptimizerService.getConfig();
        if (config.fallbackEnabled && minScore > config.minThreshold) {
          const fallbackThreshold = Math.max(
            config.minThreshold,
            minScore - RetrievalConfig.adaptiveFallbackReduction
          );

          logger.info('Applying fallback threshold for low results', {
            userId: options.userId,
            originalThreshold: minScore,
            fallbackThreshold,
            originalResultsCount: searchResults.length,
          });

          const fallbackResults = await PineconeService.search(
            queryEmbedding,
            {
              userId: options.userId,
              topK: options.maxDocumentChunks || RetrievalConfig.defaults.topK,
              topicId: options.topicId,
              documentIds: options.documentIds,
              minScore: fallbackThreshold,
              embeddingModel,
            },
            embeddingDimensions
          ).catch(() => []);

          if (fallbackResults.length > searchResults.length) {
            searchResults = fallbackResults;
            minScore = fallbackThreshold;
          }
        }
      }

      // Hard-minimum score filter
      const config = ThresholdOptimizerService.getConfig();
      const hardMinimum = config.minThreshold;
      searchResults = searchResults.filter((result: any) => {
        const score = result.score || result.metadata?.score || 0;
        return score >= hardMinimum;
      });

      if (searchResults.length === 0) {
        logger.info('No relevant document chunks found', {
          userId: options.userId,
          query: query.substring(0, 100),
        });
        return [];
      }

      // Batch-fetch document metadata
      const uniqueDocumentIds = Array.from(new Set(searchResults.map((r: any) => r.documentId)));
      const documentsMap = await DocumentService.getDocumentsBatch(uniqueDocumentIds, options.userId);

      const documentContexts: DocumentContext[] = [];

      for (const result of searchResults) {
        try {
          const document = documentsMap.get(result.documentId);

          if (!document) {
            logger.warn('Document not found for chunk', {
              documentId: result.documentId,
              chunkId: result.chunkId,
            });
            documentContexts.push({
              documentId: result.documentId,
              documentName: 'Unknown Document',
              chunkIndex: result.chunkIndex,
              content: result.content,
              score: result.score,
            });
            continue;
          }

          const author = document.metadata?.author || document.metadata?.Author || undefined;
          const authors = document.metadata?.authors || (author ? [author] : undefined);
          const documentType = document.file_type || undefined;
          const fileSize = document.file_size || undefined;

          let fileSizeFormatted: string | undefined;
          if (fileSize) {
            if (fileSize < 1024) {
              fileSizeFormatted = `${fileSize} B`;
            } else if (fileSize < 1024 * 1024) {
              fileSizeFormatted = `${(fileSize / 1024).toFixed(2)} KB`;
            } else {
              fileSizeFormatted = `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;
            }
          }

          const publishedDate = document.metadata?.publishedDate ||
            document.metadata?.published_date ||
            document.metadata?.publicationDate ||
            document.metadata?.publication_date ||
            undefined;

          documentContexts.push({
            documentId: result.documentId,
            documentName: document.filename,
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.score,
            timestamp: document.updated_at || document.created_at,
            author,
            documentType,
            createdAt: document.created_at,
            updatedAt: document.updated_at,
            fileSize,
            fileSizeFormatted,
            publishedDate,
            authors,
          });
        } catch (error: any) {
          logger.warn('Failed to process document metadata', {
            documentId: result.documentId,
            error: error.message,
          });
          documentContexts.push({
            documentId: result.documentId,
            documentName: 'Unknown Document',
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.score,
          });
        }
      }

      logger.info('Document context retrieved', {
        userId: options.userId,
        chunkCount: documentContexts.length,
      });

      return documentContexts;
    } catch (error: any) {
      logger.error('Failed to retrieve document context', {
        userId: options.userId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Retrieve web search results from Tavily.
   */
  static async retrieveWebSearch(
    query: string,
    options: RAGOptions
  ): Promise<Array<{ title: string; url: string; content: string; publishedDate?: string; author?: string; accessDate?: string }>> {
    if (!options.enableWebSearch) return [];

    return await LatencyTrackerService.trackOperation(
      OperationType.WEB_SEARCH,
      async () => this.retrieveWebSearchInternal(query, options),
      { userId: options.userId, metadata: { topic: options.topic, timeRange: options.timeRange } }
    );
  }

  private static async retrieveWebSearchInternal(
    query: string,
    options: RAGOptions
  ): Promise<Array<{ title: string; url: string; content: string; publishedDate?: string; author?: string; accessDate?: string }>> {
    try {
      const { SubscriptionService } = await import('./subscription.service');
      const limitCheck = await SubscriptionService.checkTavilySearchLimit(options.userId);

      if (!limitCheck.allowed) {
        logger.warn('Tavily search limit exceeded, skipping web search', {
          userId: options.userId,
          used: limitCheck.used,
          limit: limitCheck.limit,
          query: query.substring(0, 100),
        });
        return [];
      }

      const searchRequest: SearchRequest = {
        query,
        topic: options.topic || undefined,
        maxResults: options.maxWebResults || RetrievalConfig.defaults.maxWebResults,
        timeRange: options.timeRange,
        startDate: options.startDate,
        endDate: options.endDate,
        country: options.country,
        optimizeQuery: options.optimizeSearchQuery ?? true,
        optimizationContext: options.searchOptimizationContext,
        useTopicAwareQuery: options.useTopicAwareQuery ?? true,
        topicQueryOptions: options.topicQueryOptions,
        enableQueryRewriting: options.enableQueryRewriting ?? false,
        queryRewritingOptions: options.queryRewritingOptions,
        enableWebResultReranking: options.enableWebResultReranking ?? false,
        rerankingConfig: options.webResultRerankingConfig,
        enableQualityScoring: options.enableQualityScoring ?? false,
        qualityScoringConfig: options.qualityScoringConfig,
        minQualityScore: options.minQualityScore,
        filterByQuality: options.filterByQuality ?? false,
      };

      logger.info('Performing web search with filters', {
        query: query.substring(0, 100),
        topic: options.topic,
        timeRange: options.timeRange,
        country: options.country,
        startDate: options.startDate,
        endDate: options.endDate,
        tavilyLimitRemaining: limitCheck.remaining,
      });

      let searchResponse;
      try {
        searchResponse = await SearchService.search(searchRequest);

        await SubscriptionService.incrementTavilyUsage(options.userId, {
          query: query.substring(0, 200),
          topic: options.topic,
          resultCount: searchResponse.results?.length || 0,
        });
      } catch (searchError: any) {
        const recoveryConfig: RecoveryConfig = {
          maxAttempts: RetrievalConfig.retry.maxAttempts,
          retryDelay: RetrievalConfig.retry.webRetryDelayMs,
          enableFallback: false,
          enableDegradation: true,
        };

        const recoveryResult = await ErrorRecoveryService.attemptRecovery(
          ServiceType.SEARCH,
          searchError,
          async () => SearchService.search(searchRequest),
          undefined,
          recoveryConfig
        );

        if (recoveryResult.recovered && recoveryResult.result) {
          searchResponse = recoveryResult.result;
          logger.info('Web search recovered', {
            query: query.substring(0, 100),
            strategy: recoveryResult.strategy,
            attempts: recoveryResult.attempts,
          });
        } else {
          logger.warn('Web search failed and recovery unsuccessful, returning empty results', {
            error: searchError.message,
            query: query.substring(0, 100),
            recoveryStrategy: recoveryResult.strategy,
            recoveryError: recoveryResult.error?.message,
          });
          return [];
        }
      }

      if (!searchResponse.results || searchResponse.results.length === 0) {
        logger.info('No web search results found', { query: query.substring(0, 100) });
        return [];
      }

      const accessDate = new Date().toISOString();
      const results = searchResponse.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        publishedDate: r.publishedDate,
        author: r.author,
        accessDate,
      }));

      logger.info('Web search results retrieved', { resultsCount: results.length });
      return results;
    } catch (error: any) {
      logger.warn('Web search failed, continuing without web results', { error: error.message });
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Hybrid merge
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Combine semantic and keyword search results using hybrid search service.
   */
  static async combineSearchResults(
    semanticResults: DocumentContext[],
    keywordResults: KeywordSearchResult[],
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    const weights = options.semanticSearchWeight !== undefined || options.keywordSearchWeight !== undefined
      ? {
          semantic: options.semanticSearchWeight ?? RetrievalConfig.weights.semantic,
          keyword: options.keywordSearchWeight ?? RetrievalConfig.weights.keyword,
        }
      : undefined;

    const hybridResults = await HybridSearchService.performHybridSearch(
      semanticResults,
      keywordResults,
      {
        userId: options.userId,
        topicId: options.topicId,
        documentIds: options.documentIds,
        maxResults: options.maxDocumentChunks || RetrievalConfig.defaults.topK,
        minScore: options.minScore,
        weights,
        useABTesting: options.useABTesting,
        enableDeduplication: options.enableDeduplication,
      }
    );

    return hybridResults.map(result => ({
      documentId: result.documentId,
      documentName: result.documentName,
      chunkIndex: result.chunkIndex,
      content: result.content,
      score: result.combinedScore,
      timestamp: result.timestamp,
      author: result.author,
      authors: result.authors,
      documentType: result.documentType,
      fileSize: result.fileSize,
      fileSizeFormatted: result.fileSizeFormatted,
      publishedDate: result.publishedDate,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  // Dynamic limits & adaptive selection
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate maxDocumentChunks & maxWebResults using dynamic limits
   * and adaptive context selection.
   */
  static calculateLimits(
    query: string,
    options: RAGOptions
  ): { maxDocumentChunks: number; maxWebResults: number } {
    const enableDynamicLimits = options.enableDynamicLimits ?? true;
    const useAdaptiveContextSelection = options.useAdaptiveContextSelection ?? true;
    const enableAdaptiveContextSelection = options.enableAdaptiveContextSelection ?? true;
    let maxDocumentChunks = options.maxDocumentChunks;
    let maxWebResults = options.maxWebResults;

    // Step 1: Dynamic limits
    if (enableDynamicLimits && (maxDocumentChunks === undefined || maxWebResults === undefined)) {
      try {
        const dynamicLimitOptions: DynamicLimitOptions = {
          query,
          model: options.tokenBudgetOptions?.model,
          tokenBudgetOptions: options.tokenBudgetOptions,
          minDocumentChunks: options.minChunks,
          maxDocumentChunks: options.maxChunks || maxDocumentChunks,
          minWebResults: RetrievalConfig.defaults.minWebResults,
          maxWebResults: options.maxWebResults || RetrievalConfig.defaults.maxWebResultsCeiling,
          ...options.dynamicLimitOptions,
        };

        const dynamicLimits = RAGConfig.calculateDynamicLimits(dynamicLimitOptions);

        if (maxDocumentChunks === undefined) maxDocumentChunks = dynamicLimits.documentChunks;
        if (maxWebResults === undefined) maxWebResults = dynamicLimits.webResults;

        logger.info('Dynamic limits calculated', {
          userId: options.userId,
          query: query.substring(0, 100),
          documentChunks: maxDocumentChunks,
          webResults: maxWebResults,
          tokenBudget: dynamicLimits.factors.tokenBudget,
          complexity: dynamicLimits.factors.complexity,
          reasoning: dynamicLimits.reasoning,
        });
      } catch (error: any) {
        logger.warn('Dynamic limit calculation failed, using defaults', { error: error.message });
        if (maxDocumentChunks === undefined) maxDocumentChunks = RetrievalConfig.defaults.maxDocumentChunks;
        if (maxWebResults === undefined) maxWebResults = RetrievalConfig.defaults.maxWebResults;
      }
    }

    // Step 2: Adaptive context selection
    if (enableAdaptiveContextSelection && (maxDocumentChunks === undefined || maxWebResults === undefined || options.adaptiveContextOptions)) {
      const adaptiveOptions: AdaptiveContextOptions = {
        query,
        model: options.tokenBudgetOptions?.model,
        tokenBudgetOptions: options.tokenBudgetOptions,
        minDocumentChunks: options.minChunks || maxDocumentChunks || RetrievalConfig.defaults.minResults,
        maxDocumentChunks: options.maxChunks || maxDocumentChunks || RetrievalConfig.defaults.maxDocumentChunksCeiling,
        minWebResults: RetrievalConfig.defaults.minWebResults,
        maxWebResults: options.maxWebResults || maxWebResults || RetrievalConfig.defaults.maxWebResultsCeiling,
        preferDocuments: options.adaptiveContextOptions?.preferDocuments,
        preferWeb: options.adaptiveContextOptions?.preferWeb,
        balanceRatio: options.adaptiveContextOptions?.balanceRatio,
        enableComplexityAnalysis: options.adaptiveContextOptions?.enableComplexityAnalysis ?? true,
        enableTokenAwareSelection: options.adaptiveContextOptions?.enableTokenAwareSelection ?? true,
        ...options.adaptiveContextOptions,
      };

      const adaptiveSelection = AdaptiveContextService.selectAdaptiveContext(adaptiveOptions);

      if (maxDocumentChunks === undefined || maxWebResults === undefined ||
          (options.adaptiveContextOptions && (adaptiveSelection.documentChunks !== maxDocumentChunks || adaptiveSelection.webResults !== maxWebResults))) {
        maxDocumentChunks = adaptiveSelection.documentChunks;
        maxWebResults = adaptiveSelection.webResults;

        logger.info('Adaptive context selection applied', {
          userId: options.userId,
          query: query.substring(0, 100),
          documentChunks: maxDocumentChunks,
          webResults: maxWebResults,
          complexity: adaptiveSelection.complexity.intentComplexity,
          queryType: adaptiveSelection.complexity.queryType,
          tokenBudget: adaptiveSelection.tokenBudget?.remaining.total,
          reasoning: adaptiveSelection.reasoning,
          adjustments: adaptiveSelection.adjustments,
        });
      }
    } else if (useAdaptiveContextSelection && maxDocumentChunks === undefined) {
      const contextSelectionOptions: ContextSelectionOptions = {
        minChunks: options.minChunks,
        maxChunks: options.maxChunks,
        defaultChunks: RetrievalConfig.defaults.defaultChunks,
      };

      const contextSelection = ContextSelectorService.selectContextSize(query, contextSelectionOptions);
      maxDocumentChunks = contextSelection.chunkCount;

      logger.info('Adaptive context selection applied (legacy)', {
        userId: options.userId,
        query: query.substring(0, 100),
        chunkCount: maxDocumentChunks,
        complexity: contextSelection.complexity.intentComplexity,
        queryType: contextSelection.complexity.queryType,
        reasoning: contextSelection.reasoning,
      });
    } else {
      maxDocumentChunks = maxDocumentChunks || RetrievalConfig.defaults.maxDocumentChunks;
      maxWebResults = maxWebResults || RetrievalConfig.defaults.maxWebResults;
    }

    return {
      maxDocumentChunks: maxDocumentChunks as number,
      maxWebResults: maxWebResults as number,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Main orchestration
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Execute parallel retrieval (semantic + keyword + web) and merge results.
   * Returns raw RetrievalResult before pipeline processing.
   */
  static async orchestrateRetrieval(
    query: string,
    options: RAGOptions
  ): Promise<RetrievalResult> {
    // Calculate limits
    const { maxDocumentChunks, maxWebResults } = this.calculateLimits(query, options);

    logger.info('Retrieving RAG context', {
      userId: options.userId,
      query: query.substring(0, 100),
      enableDocumentSearch: options.enableDocumentSearch,
      enableKeywordSearch: options.enableKeywordSearch,
      enableWebSearch: options.enableWebSearch,
      maxDocumentChunks,
      adaptiveContextSelection: options.useAdaptiveContextSelection ?? true,
    });

    const updatedOptions: RAGOptions = { ...options, maxDocumentChunks, maxWebResults };

    // Parallel retrieval
    const [webSearchResult, semanticResult, keywordResult] = await Promise.allSettled([
      this.retrieveWebSearch(query, options),
      options.enableDocumentSearch
        ? this.retrieveDocumentContext(query, updatedOptions)
        : Promise.resolve([] as DocumentContext[]),
      options.enableKeywordSearch
        ? this.retrieveDocumentContextKeyword(query, updatedOptions)
        : Promise.resolve([] as KeywordSearchResult[]),
    ]);

    // Extract results
    const webSearchResults = webSearchResult.status === 'fulfilled' ? webSearchResult.value : [];
    const semanticResults = semanticResult.status === 'fulfilled' ? semanticResult.value : [];
    const keywordResults = keywordResult.status === 'fulfilled' ? keywordResult.value : [];

    // Log failures
    if (webSearchResult.status === 'rejected') {
      logger.warn('Web search failed during parallel retrieval', {
        error: webSearchResult.reason?.message,
        userId: options.userId,
      });
    }
    if (semanticResult.status === 'rejected') {
      logger.warn('Semantic search failed during parallel retrieval', {
        error: semanticResult.reason?.message,
        userId: options.userId,
      });
    }
    if (keywordResult.status === 'rejected') {
      logger.warn('Keyword search failed during parallel retrieval', {
        error: keywordResult.reason?.message,
        userId: options.userId,
      });
    }

    // Merge document results
    let documentContexts: DocumentContext[] = [];

    if (options.enableDocumentSearch && options.enableKeywordSearch) {
      documentContexts = await this.combineSearchResults(semanticResults, keywordResults, updatedOptions);
    } else if (options.enableDocumentSearch) {
      documentContexts = semanticResults;
    } else if (options.enableKeywordSearch) {
      documentContexts = keywordResults.map(result => ({
        documentId: result.documentId,
        documentName: result.documentName || 'Unknown Document',
        chunkIndex: result.chunkIndex,
        content: result.content,
        score: result.score,
      }));
    }

    // Degradation status
    const degradationStatus = DegradationService.getOverallStatus();
    const isDegraded = degradationStatus.level !== DegradationLevel.NONE;
    const isPartial = isDegraded && (
      (options.enableDocumentSearch && documentContexts.length === 0 && semanticResult.status === 'rejected') ||
      (options.enableWebSearch && webSearchResults.length === 0 && webSearchResult.status === 'rejected')
    );

    // Collect retrieval metrics (async, non-blocking)
    if (options.userId && documentContexts.length > 0) {
      MetricsService.collectMetrics(
        query,
        options.userId,
        documentContexts,
        undefined,
        {
          topicId: options.topicId,
          documentIds: options.documentIds,
          searchTypes: {
            semantic: options.enableDocumentSearch,
            keyword: options.enableKeywordSearch,
            hybrid: options.enableDocumentSearch && options.enableKeywordSearch,
            web: options.enableWebSearch,
          },
          webResultsCount: webSearchResults.length,
        }
      ).catch((error: any) => {
        logger.warn('Failed to collect retrieval metrics', {
          error: error.message,
          userId: options.userId,
        });
      });
    }

    return {
      documentContexts,
      webSearchResults,
      degraded: isDegraded,
      degradationLevel: degradationStatus.level,
      affectedServices: degradationStatus.affectedServices,
      degradationMessage: isDegraded ? degradationStatus.message : undefined,
      partial: isPartial,
    };
  }
}
