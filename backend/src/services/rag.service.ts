/**
 * RAG Service — Thin Coordinator
 *
 * High-level orchestration for Retrieval-Augmented Generation.
 * Delegates to:
 *   - RetrievalOrchestratorService  (parallel retrieval, hybrid merge, cache)
 *   - ContextPipelineService        (re-rank, dedup, diversity, format)
 *
 * This file owns the canonical type definitions (DocumentContext, RAGContext,
 * RAGOptions) so that all downstream services can import them from a single
 * location without circular dependencies.
 */

import { RetrievalOrchestratorService } from './retrieval-orchestrator.service';
import { ContextPipelineService, FormatOptions } from './context-pipeline.service';
import { RedisCacheService } from './redis-cache.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import logger from '../config/logger';
// RetrievalConfig removed — v2: no document search thresholds needed

import type { ExpansionStrategy } from './query-expansion.service';
import type { RerankingStrategy } from '../config/reranking.config';
import type { OrderingOptions } from './relevance-ordering.service';
import type { ContextReductionStrategy, SummarizationOptions } from './context-summarizer.service';
import type { PrioritizationOptions } from './source-prioritizer.service';
import type { TokenBudgetOptions } from './token-budget.service';
import type { DynamicLimitOptions } from '../config/rag.config';

// ═══════════════════════════════════════════════════════════════════════
// Canonical type definitions — imported by downstream services
// ═══════════════════════════════════════════════════════════════════════

export interface DocumentContext {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  score: number;
  timestamp?: string;
  author?: string;
  authors?: string[];
  documentType?: string;
  fileSize?: number;
  fileSizeFormatted?: string;
  publishedDate?: string;
  createdAt?: string;
  updatedAt?: string;
  // v2: document provenance fields retained for type compatibility
  pageNumber?: number;
  sectionTitle?: string;
  sectionLevel?: number;
}

export interface RAGContext {
  documentContexts: DocumentContext[];
  webSearchResults: Array<{
    title: string;
    url: string;
    content: string;
    publishedDate?: string;
    author?: string;
    accessDate?: string;
  }>;
  degraded?: boolean;
  degradationLevel?: import('./degradation.service').DegradationLevel;
  affectedServices?: import('./degradation.service').ServiceType[];
  degradationMessage?: string;
  partial?: boolean;
  // Added by summarization / compression pipelines
  summarizationStats?: any;
  compressionStats?: any;
}

export interface RAGOptions {
  userId: string;
  topicId?: string;
  ancestorTopicIds?: string[];
  documentIds?: string[];
  enableDocumentSearch?: boolean;
  enableWebSearch?: boolean;
  maxWebResults?: number;
  enableContextCache?: boolean;
  contextCacheTTL?: number;
  contextCacheSimilarityThreshold?: number;
  enableSimilarityLookup?: boolean;
  optimizeSearchQuery?: boolean;
  searchOptimizationContext?: string;
  useTopicAwareQuery?: boolean;
  topicQueryOptions?: import('./topic-query-builder.service').TopicQueryOptions;
  enableKeywordSearch?: boolean;
  maxDocumentChunks?: number;
  minScore?: number;
  topic?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  startDate?: string;
  endDate?: string;
  country?: string;
  keywordSearchWeight?: number;
  semanticSearchWeight?: number;
  useABTesting?: boolean;
  enableDeduplication?: boolean;
  enableResultDeduplication?: boolean;
  deduplicationThreshold?: number;
  deduplicationNearDuplicateThreshold?: number;
  useAdaptiveContextSelection?: boolean;
  minChunks?: number;
  maxChunks?: number;
  enableQueryExpansion?: boolean;
  expansionStrategy?: ExpansionStrategy;
  maxExpansions?: number;
  enableQueryRewriting?: boolean;
  queryRewritingOptions?: import('./query-rewriter.service').QueryRewritingOptions;
  enableWebResultReranking?: boolean;
  webResultRerankingConfig?: import('./web-result-reranker.service').RerankingConfig;
  enableQualityScoring?: boolean;
  qualityScoringConfig?: import('./result-quality-scorer.service').QualityScoringConfig;
  minQualityScore?: number;
  filterByQuality?: boolean;
  enableReranking?: boolean;
  rerankingStrategy?: RerankingStrategy;
  rerankingTopK?: number;
  rerankingMaxResults?: number;
  useAdaptiveThreshold?: boolean;
  minResults?: number;
  maxResults?: number;
  enableDiversityFilter?: boolean;
  diversityLambda?: number;
  diversityMaxResults?: number;
  diversitySimilarityThreshold?: number;
  enableRelevanceOrdering?: boolean;
  orderingOptions?: OrderingOptions;
  contextReductionStrategy?: ContextReductionStrategy;
  maxContextTokens?: number;
  enableSourcePrioritization?: boolean;
  prioritizationOptions?: PrioritizationOptions;
  enableTokenBudgeting?: boolean;
  tokenBudgetOptions?: TokenBudgetOptions;
  enableAdaptiveContextSelection?: boolean;
  adaptiveContextOptions?: Partial<import('./adaptive-context.service').AdaptiveContextOptions>;
  summarizationOptions?: SummarizationOptions;
  enableDynamicLimits?: boolean;
  dynamicLimitOptions?: Partial<DynamicLimitOptions>;
}

// ═══════════════════════════════════════════════════════════════════════
// RAG Service — Coordinator
// ═══════════════════════════════════════════════════════════════════════

export class RAGService {
  private static readonly RAG_CACHE_PREFIX = 'rag';

  /**
   * Retrieve RAG context (documents + web search).
   *
   * Pipeline:
   *   1. Cache check
   *   2. Orchestrator: parallel retrieval → hybrid merge
   *   3. Pipeline: re-rank → dedup → diversity → refine
   *   4. Cache store
   */
  static async retrieveContext(
    query: string,
    options: RAGOptions
  ): Promise<RAGContext> {
    return await LatencyTrackerService.trackOperation(
      OperationType.RAG_CONTEXT_RETRIEVAL,
      async () => this.retrieveContextInternal(query, options),
      {
        userId: options.userId,
        metadata: {
          enableWebSearch: options.enableWebSearch,
          // v2: document search disabled
        },
      }
    );
  }

  private static async retrieveContextInternal(
    query: string,
    options: RAGOptions
  ): Promise<RAGContext> {
    // ── 1. Cache check ──────────────────────────────────────────
    const { cached, queryEmbedding } = await RetrievalOrchestratorService.checkCache(query, options);
    if (cached) return cached;

    // ── 2. Retrieval orchestration ──────────────────────────────
    const retrieval = await RetrievalOrchestratorService.orchestrateRetrieval(query, options);

    // ── 3. Post-retrieval pipeline ──────────────────────────────
    const { documentContexts, webSearchResults } = await ContextPipelineService.processRetrievalResults(
      retrieval.documentContexts,
      retrieval.webSearchResults,
      {
        userId: options.userId,
        query,
        model: options.tokenBudgetOptions?.model,
        // Re-ranking
        enableReranking: options.enableReranking,
        rerankingStrategy: options.rerankingStrategy,
        rerankingTopK: options.rerankingTopK,
        rerankingMaxResults: options.rerankingMaxResults,
        minScore: options.minScore,
        maxDocumentChunks: options.maxDocumentChunks,
        // Deduplication
        enableResultDeduplication: options.enableResultDeduplication,
        deduplicationThreshold: options.deduplicationThreshold,
        deduplicationNearDuplicateThreshold: options.deduplicationNearDuplicateThreshold,
        // Diversity
        enableDiversityFilter: options.enableDiversityFilter,
        diversityLambda: options.diversityLambda,
        diversityMaxResults: options.diversityMaxResults,
        diversitySimilarityThreshold: options.diversitySimilarityThreshold,
        // Adaptive refinement
        enableAdaptiveContextSelection: options.enableAdaptiveContextSelection,
        adaptiveContextOptions: options.adaptiveContextOptions,
        tokenBudgetOptions: options.tokenBudgetOptions,
      }
    );

    logger.info('RAG context retrieved', {
      userId: options.userId,
      documentChunks: documentContexts.length,
      webResults: webSearchResults.length,
      searchTypes: {
        web: options.enableWebSearch,
        // v2: document search disabled
      },
      rerankingEnabled: options.enableReranking,
      adaptiveSelection: options.enableAdaptiveContextSelection ?? true,
      degraded: retrieval.degraded,
      degradationLevel: retrieval.degradationLevel,
      partial: retrieval.partial,
    });

    const ragContext: RAGContext = {
      documentContexts,
      webSearchResults,
      degraded: retrieval.degraded,
      degradationLevel: retrieval.degradationLevel,
      affectedServices: retrieval.affectedServices,
      degradationMessage: retrieval.degradationMessage,
      partial: retrieval.partial,
    };

    // ── 4. Cache store (fire-and-forget — non-critical) ─────────
    // Reuse the queryEmbedding from checkCache to avoid a duplicate embedding API call.
    RetrievalOrchestratorService.storeCache(query, options, ragContext, queryEmbedding).catch((err: any) => {
      logger.warn('Background cache store failed', { error: err.message, userId: options.userId });
    });

    return ragContext;
  }

  /**
   * Format RAG context for AI prompt.
   * Applies: ordering → summarization → compression → prioritization → token budgeting → string.
   */
  static async formatContextForPrompt(
    context: RAGContext,
    options: FormatOptions = {}
  ): Promise<string> {
    return await ContextPipelineService.formatContextForPrompt(context, options);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Cache management (thin delegates)
  // ═══════════════════════════════════════════════════════════════════

  static async invalidateUserCache(userId: string): Promise<number> {
    try {
      const deleted = await RedisCacheService.deletePattern(`*|${userId}|*`, {
        prefix: this.RAG_CACHE_PREFIX,
      });
      logger.info('RAG context cache invalidated for user', { userId, deleted });
      return deleted;
    } catch (error: any) {
      logger.error('Failed to invalidate user RAG cache', { userId, error: error.message });
      return 0;
    }
  }

  static async invalidateTopicCache(userId: string, topicId: string): Promise<number> {
    try {
      const deleted = await RedisCacheService.deletePattern(`*|${userId}|${topicId}|*`, {
        prefix: this.RAG_CACHE_PREFIX,
      });
      logger.info('RAG context cache invalidated for topic', { userId, topicId, deleted });
      return deleted;
    } catch (error: any) {
      logger.error('Failed to invalidate topic RAG cache', { userId, topicId, error: error.message });
      return 0;
    }
  }

  static async invalidateDocumentCache(userId: string, documentIds: string[]): Promise<number> {
    try {
      let totalDeleted = 0;
      for (const documentId of documentIds) {
        const deleted = await RedisCacheService.deletePattern(`*|${userId}|*|${documentId}|*`, {
          prefix: this.RAG_CACHE_PREFIX,
        });
        totalDeleted += deleted;
      }
      logger.info('RAG context cache invalidated for documents', {
        userId,
        documentIds: documentIds.length,
        deleted: totalDeleted,
      });
      return totalDeleted;
    } catch (error: any) {
      logger.error('Failed to invalidate document RAG cache', { userId, documentIds, error: error.message });
      return 0;
    }
  }

  static async clearAllRAGCache(): Promise<number> {
    try {
      const deleted = await RedisCacheService.clearAll({ prefix: this.RAG_CACHE_PREFIX });
      logger.info('All RAG context cache cleared', { deleted });
      return deleted;
    } catch (error: any) {
      logger.error('Failed to clear RAG context cache', { error: error.message });
      return 0;
    }
  }

  static getRAGCacheStats() {
    return RedisCacheService.getRAGStats();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Source extraction
  // ═══════════════════════════════════════════════════════════════════

  static extractSources(context: RAGContext): Array<{
    type: 'document' | 'web';
    title: string;
    url?: string;
    documentId?: string;
    snippet?: string;
    score?: number;
    metadata?: import('../types/source').SourceMetadata;
  }> {
    const sources: Array<{
      type: 'document' | 'web';
      title: string;
      url?: string;
      documentId?: string;
      snippet?: string;
      score?: number;
      pageNumber?: number;
      sectionTitle?: string;
      metadata?: import('../types/source').SourceMetadata;
    }> = [];

    // v2: skip documentContexts — document search is retired

    context.webSearchResults.forEach((result) => {
      sources.push({
        type: 'web',
        title: result.title,
        url: result.url,
        snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
        metadata: {
          publishedDate: result.publishedDate,
          publicationDate: result.publishedDate,
          accessDate: result.accessDate,
          author: result.author,
          url: result.url,
        },
      });
    });

    return sources;
  }
}
