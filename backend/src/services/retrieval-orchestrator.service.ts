/**
 * Retrieval Orchestrator Service
 *
 * Handles the retrieval layer of the RAG pipeline:
 * - Web search retrieval (Tavily)
 * - Query expansion
 * - Dynamic limits and adaptive context selection
 * - Cache check / store logic
 *
 * v2: Document search (Pinecone) and keyword search retired — web-only retrieval.
 */

import { EmbeddingService } from './embedding.service';
import { SearchService, SearchRequest } from './search.service';
// ContextSelectorService removed — v2: no document chunk selection needed
import { AdaptiveContextService, AdaptiveContextOptions } from './adaptive-context.service';
import { RAGConfig, DynamicLimitOptions } from '../config/rag.config';
import { RedisCacheService } from './redis-cache.service';
import { DegradationService, ServiceType, DegradationLevel } from './degradation.service';
import { ErrorRecoveryService, RecoveryConfig } from './error-recovery.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import { ErrorTrackerService, ServiceType as ErrorServiceType } from './error-tracker.service';
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
      '', // v2: topicId removed
      '', // v2: documentIds removed
      '0', // v2: document search disabled
      options.enableWebSearch ? '1' : '0',
      '0', // v2: keyword search disabled
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
    if (options.enableWebSearch) return CacheTtlConfig.ragWebOnly;
    return this.DEFAULT_RAG_CACHE_TTL;
  }

  /**
   * Attempt to retrieve RAG context from cache (exact + similarity).
   * Returns the cached context (or null on miss) plus any query embedding
   * generated during similarity lookup — so callers can reuse it for storeCache.
   */
  static async checkCache(
    query: string,
    options: RAGOptions
  ): Promise<{ cached: RAGContext | null; queryEmbedding?: number[] }> {
    const enableContextCache = options.enableContextCache ?? true;
    const enableSimilarityLookup = options.enableSimilarityLookup ?? true;
    const similarityThreshold = options.contextCacheSimilarityThreshold ?? this.DEFAULT_SIMILARITY_THRESHOLD;

    if (!enableContextCache) {
      RedisCacheService.recordRAGMiss();
      return { cached: null };
    }

    return LatencyTrackerService.trackOperation(
      OperationType.CACHE_LOOKUP,
      async () => {
        let queryEmbedding: number[] | undefined;

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
              webResults: cached.webSearchResults.length,
            });
            return { cached };
          }

          // Similarity-based lookup — preserve embedding for reuse in storeCache
          if (enableSimilarityLookup) {
            try {
              queryEmbedding = await EmbeddingService.generateEmbedding(query);
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
                  webResults: similarContext.webSearchResults.length,
                });
                return { cached: similarContext, queryEmbedding };
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
          ErrorTrackerService.trackError(ErrorServiceType.CACHE, cacheError, {
            userId: options.userId, metadata: { operation: 'cacheCheck' },
          }).catch(() => {});
        }

        return { cached: null, queryEmbedding };
      },
      { userId: options.userId }
    );
  }

  /**
   * Store RAG context in cache with embedding for similarity lookup.
   * Accepts an optional pre-computed queryEmbedding to avoid redundant API calls.
   */
  static async storeCache(
    query: string,
    options: RAGOptions,
    ragContext: RAGContext,
    precomputedEmbedding?: number[]
  ): Promise<void> {
    const enableContextCache = options.enableContextCache ?? true;
    if (!enableContextCache) return;

    await LatencyTrackerService.trackOperation(
      OperationType.CACHE_STORE,
      async () => {
        try {
          const cacheKey = this.generateRAGCacheKey(query, options);
          const cacheTTL = this.calculateRAGCacheTTL(options);
          const queryEmbedding = precomputedEmbedding ?? await EmbeddingService.generateEmbedding(query);

          await RedisCacheService.setWithEmbedding(cacheKey, ragContext, queryEmbedding, {
            prefix: this.RAG_CACHE_PREFIX,
            ttl: cacheTTL,
          });

          RedisCacheService.recordRAGSet();
          logger.debug('RAG context cached', {
            userId: options.userId,
            query: query.substring(0, 100),
            ttl: cacheTTL,
            webResults: ragContext.webSearchResults.length,
          });
        } catch (cacheError: any) {
          RedisCacheService.recordRAGError();
          logger.warn('Failed to cache RAG context', {
            error: cacheError.message,
            userId: options.userId,
          });
          ErrorTrackerService.trackError(ErrorServiceType.CACHE, cacheError, {
            userId: options.userId, metadata: { operation: 'cacheStore' },
          }).catch(() => {});
        }
      },
      { userId: options.userId }
    );
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
      const { QueryExpansionService } = await import('./query-expansion.service');
      const expansion = await QueryExpansionService.expandQuery(query, {
        strategy: options.expansionStrategy || 'hybrid',
        maxExpansions: options.maxExpansions ?? 5,
        useCache: true,
        context: undefined, // v2: topicId removed
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
  // Web search retrieval
  // ═══════════════════════════════════════════════════════════════════

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
      ErrorTrackerService.trackError(ErrorServiceType.SEARCH, error, {
        metadata: { operation: 'webSearch' },
      }).catch(() => {});
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Dynamic limits & adaptive selection
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate maxWebResults using dynamic limits and adaptive context selection.
   */
  static calculateLimits(
    query: string,
    options: RAGOptions
  ): { maxDocumentChunks: number; maxWebResults: number } {
    const enableDynamicLimits = options.enableDynamicLimits ?? true;
    const enableAdaptiveContextSelection = options.enableAdaptiveContextSelection ?? true;
    let maxDocumentChunks = options.maxDocumentChunks ?? 0; // v2: always 0 (no document search)
    let maxWebResults = options.maxWebResults;

    // Step 1: Dynamic limits
    if (enableDynamicLimits && maxWebResults === undefined) {
      try {
        const dynamicLimitOptions: DynamicLimitOptions = {
          query,
          model: options.tokenBudgetOptions?.model,
          tokenBudgetOptions: options.tokenBudgetOptions,
          minDocumentChunks: 0,
          maxDocumentChunks: 0,
          minWebResults: RetrievalConfig.defaults.minWebResults,
          maxWebResults: options.maxWebResults || RetrievalConfig.defaults.maxWebResultsCeiling,
          ...options.dynamicLimitOptions,
        };

        const dynamicLimits = RAGConfig.calculateDynamicLimits(dynamicLimitOptions);

        if (maxWebResults === undefined) maxWebResults = dynamicLimits.webResults;

        logger.info('Dynamic limits calculated', {
          userId: options.userId,
          query: query.substring(0, 100),
          webResults: maxWebResults,
          tokenBudget: dynamicLimits.factors.tokenBudget,
          complexity: dynamicLimits.factors.complexity,
          reasoning: dynamicLimits.reasoning,
        });
      } catch (error: any) {
        logger.warn('Dynamic limit calculation failed, using defaults', { error: error.message });
        if (maxWebResults === undefined) maxWebResults = RetrievalConfig.defaults.maxWebResults;
      }
    }

    // Step 2: Adaptive context selection
    if (enableAdaptiveContextSelection && maxWebResults === undefined) {
      const adaptiveOptions: AdaptiveContextOptions = {
        query,
        model: options.tokenBudgetOptions?.model,
        tokenBudgetOptions: options.tokenBudgetOptions,
        minDocumentChunks: 0,
        maxDocumentChunks: 0,
        minWebResults: RetrievalConfig.defaults.minWebResults,
        maxWebResults: options.maxWebResults || maxWebResults || RetrievalConfig.defaults.maxWebResultsCeiling,
        preferWeb: true,
        enableComplexityAnalysis: options.adaptiveContextOptions?.enableComplexityAnalysis ?? true,
        enableTokenAwareSelection: options.adaptiveContextOptions?.enableTokenAwareSelection ?? true,
        ...options.adaptiveContextOptions,
      };

      const adaptiveSelection = AdaptiveContextService.selectAdaptiveContext(adaptiveOptions);
      maxWebResults = adaptiveSelection.webResults;

      logger.info('Adaptive context selection applied', {
        userId: options.userId,
        query: query.substring(0, 100),
        webResults: maxWebResults,
        complexity: adaptiveSelection.complexity.intentComplexity,
        queryType: adaptiveSelection.complexity.queryType,
        tokenBudget: adaptiveSelection.tokenBudget?.remaining.total,
        reasoning: adaptiveSelection.reasoning,
        adjustments: adaptiveSelection.adjustments,
      });
    }

    maxWebResults = maxWebResults || RetrievalConfig.defaults.maxWebResults;

    return {
      maxDocumentChunks,
      maxWebResults: maxWebResults as number,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Main orchestration
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Execute web search retrieval.
   * v2: Document search and multi-hop retrieval retired — web-only.
   *
   * Returns raw RetrievalResult before pipeline processing.
   */
  static async orchestrateRetrieval(
    query: string,
    options: RAGOptions
  ): Promise<RetrievalResult> {
    // Calculate limits
    const { maxWebResults } = this.calculateLimits(query, options);

    logger.info('Retrieving RAG context (web-only)', {
      userId: options.userId,
      query: query.substring(0, 100),
      enableWebSearch: options.enableWebSearch,
    });

    const [webSearchResult] = await Promise.allSettled([
      this.retrieveWebSearch(query, { ...options, maxWebResults }),
    ]);

    // Extract results
    const webSearchResults = webSearchResult.status === 'fulfilled' ? webSearchResult.value : [];

    // Log failures
    if (webSearchResult.status === 'rejected') {
      logger.warn('Web search failed during retrieval', {
        error: webSearchResult.reason?.message,
        userId: options.userId,
      });
      ErrorTrackerService.trackError(ErrorServiceType.SEARCH, webSearchResult.reason, {
        userId: options.userId,
        metadata: { operation: 'webSearchOrchestration' },
      }).catch(() => {});
    }

    // v2: No document results
    const documentContexts: DocumentContext[] = [];

    // Degradation status
    const degradationStatus = DegradationService.getOverallStatus();
    const isDegraded = degradationStatus.level !== DegradationLevel.NONE;
    const isPartial = isDegraded && (
      (options.enableWebSearch && webSearchResults.length === 0 && webSearchResult.status === 'rejected')
    );

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
