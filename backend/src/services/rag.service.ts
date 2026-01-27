import { EmbeddingService } from './embedding.service';
import { PineconeService, SearchResult } from './pinecone.service';
import { SearchService, SearchRequest } from './search.service';
import { DocumentService } from './document.service';
import { ChunkService } from './chunk.service';
import { HybridSearchService } from './hybrid-search.service';
import { KeywordSearchService, KeywordSearchResult } from './keyword-search.service';
import { QueryExpansionService, ExpansionStrategy } from './query-expansion.service';
import { RerankingService, RerankedResult } from './reranking.service';
import { RerankingStrategy } from '../config/reranking.config';
import { ThresholdOptimizerService } from './threshold-optimizer.service';
import { DiversityFilterService, DiversityOptions } from './diversity-filter.service';
import { DeduplicationService, DeduplicationOptions } from './deduplication.service';
import { ContextSelectorService, ContextSelectionOptions } from './context-selector.service';
import { RelevanceOrderingService, OrderingOptions } from './relevance-ordering.service';
import { ContextCompressorService, CompressionOptions } from './context-compressor.service';
import { ContextSummarizerService, SummarizationOptions } from './context-summarizer.service';
import { SourcePrioritizerService, PrioritizationOptions } from './source-prioritizer.service';
import { TokenBudgetService, TokenBudgetOptions, TokenBudget } from './token-budget.service';
import { AdaptiveContextService, AdaptiveContextOptions } from './adaptive-context.service';
import { RAGConfig, DynamicLimitOptions } from '../config/rag.config';
import { RedisCacheService } from './redis-cache.service';
import { DegradationService, ServiceType, FallbackResult, DegradationLevel } from './degradation.service';
import { ErrorRecoveryService, RecoveryConfig } from './error-recovery.service';
import { MetricsService } from './metrics.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import { ErrorTrackerService, ServiceType as ErrorServiceType } from './error-tracker.service';
import logger from '../config/logger';
import { AppError } from '../types/error';

export interface DocumentContext {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  score: number;
  // Metadata fields
  timestamp?: string; // Document created_at or updated_at
  author?: string; // Author from document metadata
  authors?: string[]; // Multiple authors
  documentType?: string; // Document file type (pdf, docx, txt, md)
  fileSize?: number; // File size in bytes
  fileSizeFormatted?: string; // Human-readable file size
  publishedDate?: string; // Publication date if available
  createdAt?: string; // Document creation timestamp
  updatedAt?: string; // Document last update timestamp
}

export interface RAGContext {
  documentContexts: DocumentContext[];
  webSearchResults: Array<{
    title: string;
    url: string;
    content: string;
    publishedDate?: string; // Publication date for web results
    author?: string; // Author if available from web result
    accessDate?: string; // Date when the source was accessed (ISO date string)
  }>;
  // Degradation information
  degraded?: boolean;
  degradationLevel?: import('./degradation.service').DegradationLevel;
  affectedServices?: import('./degradation.service').ServiceType[];
  degradationMessage?: string;
  partial?: boolean; // Indicates if results are partial due to degradation
}

export interface RAGOptions {
  userId: string;
  topicId?: string;
  documentIds?: string[];
  enableDocumentSearch?: boolean;
  enableWebSearch?: boolean;
  maxWebResults?: number;
  // RAG context caching options
  enableContextCache?: boolean; // Enable RAG context caching (default: true)
  contextCacheTTL?: number; // TTL for context cache in seconds (default: based on data freshness)
  contextCacheSimilarityThreshold?: number; // Similarity threshold for cache lookup (default: 0.85)
  enableSimilarityLookup?: boolean; // Enable similarity-based cache lookup (default: true)
  optimizeSearchQuery?: boolean; // Enable query optimization for web search
  searchOptimizationContext?: string; // Context for search query optimization
  useTopicAwareQuery?: boolean; // Use topic-aware query construction
  topicQueryOptions?: import('./topic-query-builder.service').TopicQueryOptions; // Options for topic-aware query construction
  enableKeywordSearch?: boolean; // Enable keyword (BM25) search
  maxDocumentChunks?: number;
  minScore?: number;
  // Web search filters
  topic?: string; // Topic/keyword for web search
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  startDate?: string;
  endDate?: string;
  country?: string;
  // Hybrid search options
  keywordSearchWeight?: number; // Weight for keyword search (0.0 - 1.0, default: 0.4)
  semanticSearchWeight?: number; // Weight for semantic search (0.0 - 1.0, default: 0.6)
  useABTesting?: boolean; // Use A/B testing for weight selection
  enableDeduplication?: boolean; // Enable result deduplication (hybrid search)
  // Deduplication options (separate from hybrid search deduplication)
  enableResultDeduplication?: boolean; // Enable comprehensive result deduplication
  deduplicationThreshold?: number; // Similarity threshold for deduplication (0-1)
  deduplicationNearDuplicateThreshold?: number; // Threshold for near-duplicates (0-1)
  // Adaptive context selection options
  useAdaptiveContextSelection?: boolean; // Enable adaptive context selection based on query complexity
  minChunks?: number; // Minimum number of chunks
  maxChunks?: number; // Maximum number of chunks
  // Query expansion options
  enableQueryExpansion?: boolean; // Enable query expansion
  expansionStrategy?: ExpansionStrategy; // Expansion strategy: 'llm', 'embedding', 'hybrid', 'none'
  maxExpansions?: number; // Maximum number of expansion terms
  // Query rewriting options
  enableQueryRewriting?: boolean; // Enable query rewriting (default: false)
  queryRewritingOptions?: import('./query-rewriter.service').QueryRewritingOptions; // Options for query rewriting
  // Web result re-ranking options
  enableWebResultReranking?: boolean; // Enable web result re-ranking (default: false)
  webResultRerankingConfig?: import('./web-result-reranker.service').RerankingConfig; // Re-ranking configuration
  // Quality scoring options
  enableQualityScoring?: boolean; // Enable quality scoring (default: false)
  qualityScoringConfig?: import('./result-quality-scorer.service').QualityScoringConfig; // Quality scoring configuration
  minQualityScore?: number; // Minimum quality score threshold (0-1, default: 0.5)
  filterByQuality?: boolean; // Filter results by quality threshold (default: false)
  // Re-ranking options
  enableReranking?: boolean; // Enable re-ranking of results
  rerankingStrategy?: RerankingStrategy; // Re-ranking strategy: 'cross-encoder', 'score-based', 'hybrid', 'none'
  rerankingTopK?: number; // Number of results to re-rank
  rerankingMaxResults?: number; // Maximum results after re-ranking
  // Adaptive threshold options
  useAdaptiveThreshold?: boolean; // Enable adaptive similarity thresholds
  minResults?: number; // Minimum number of results desired
  maxResults?: number; // Maximum number of results desired
  // Diversity filtering options
  enableDiversityFilter?: boolean; // Enable diversity filtering (MMR)
  diversityLambda?: number; // Diversity parameter (0-1): higher = more relevance, lower = more diversity
  diversityMaxResults?: number; // Maximum results after diversity filtering
  diversitySimilarityThreshold?: number; // Similarity threshold for diversity calculation
  // Relevance ordering options
  enableRelevanceOrdering?: boolean; // Enable relevance-based ordering (default: true)
  orderingOptions?: OrderingOptions; // Ordering configuration
  // Context compression options
  enableContextCompression?: boolean; // Enable context compression (default: true)
  compressionOptions?: CompressionOptions; // Compression configuration
  maxContextTokens?: number; // Maximum tokens for context (default: 8000)
  // Source prioritization options
  enableSourcePrioritization?: boolean; // Enable source prioritization (default: true)
  prioritizationOptions?: PrioritizationOptions; // Prioritization configuration
  // Token budgeting options
  enableTokenBudgeting?: boolean; // Enable token budgeting (default: true)
  tokenBudgetOptions?: TokenBudgetOptions; // Token budget configuration
  // Adaptive context selection options
  enableAdaptiveContextSelection?: boolean; // Enable adaptive context selection (default: true)
  adaptiveContextOptions?: Partial<AdaptiveContextOptions>; // Adaptive context configuration
  // Context summarization options
  enableContextSummarization?: boolean; // Enable context summarization (default: true)
  summarizationOptions?: SummarizationOptions; // Summarization configuration
  // Dynamic limits options
  enableDynamicLimits?: boolean; // Enable dynamic limit calculation (default: true)
  dynamicLimitOptions?: Partial<DynamicLimitOptions>; // Dynamic limit configuration
}

/**
 * RAG Service
 * Retrieval-Augmented Generation: Combines document embeddings with web search
 */
export class RAGService {
  // RAG context cache configuration
  private static readonly RAG_CACHE_PREFIX = 'rag';
  private static readonly DEFAULT_RAG_CACHE_TTL = 1800; // 30 minutes in seconds
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.85; // 85% similarity

  /**
   * Generate cache key for RAG context
   * Includes query hash, user ID, topic ID, and key options
   */
  private static generateRAGCacheKey(
    query: string,
    options: RAGOptions
  ): string {
    // Normalize query for consistent keys
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Create key parts
    const parts = [
      options.userId,
      options.topicId || '',
      (options.documentIds || []).sort().join(','),
      options.enableDocumentSearch ? '1' : '0',
      options.enableWebSearch ? '1' : '0',
      options.enableKeywordSearch ? '1' : '0',
      options.maxDocumentChunks || 5,
      options.maxWebResults || 5,
      options.minScore || 0.7,
      normalizedQuery.substring(0, 200), // Limit query length
    ];
    
    return parts.join('|');
  }

  /**
   * Calculate TTL based on data freshness needs
   * Web results need shorter TTL, document results can have longer TTL
   */
  private static calculateRAGCacheTTL(options: RAGOptions): number {
    // If custom TTL provided, use it
    if (options.contextCacheTTL) {
      return options.contextCacheTTL;
    }

    // Shorter TTL for web search results (they change frequently)
    if (options.enableWebSearch && !options.enableDocumentSearch) {
      return 900; // 15 minutes for web-only
    }

    // Longer TTL for document-only (documents don't change)
    if (options.enableDocumentSearch && !options.enableWebSearch) {
      return 3600; // 1 hour for document-only
    }

    // Default TTL for mixed (web + documents)
    return this.DEFAULT_RAG_CACHE_TTL; // 30 minutes
  }
  /**
   * Retrieve relevant document chunks using keyword search (BM25)
   */
  static async retrieveDocumentContextKeyword(
    query: string,
    options: RAGOptions
  ): Promise<KeywordSearchResult[]> {
    if (!options.enableKeywordSearch) {
      return [];
    }

    // Track latency for keyword search
    return await LatencyTrackerService.trackOperation(
      OperationType.KEYWORD_SEARCH,
      async () => {
        return await this.retrieveDocumentContextKeywordInternal(query, options);
      },
      {
        userId: options.userId,
        metadata: {
          topicId: options.topicId,
        },
      }
    );
  }

  /**
   * Internal method for keyword search
   */
  private static async retrieveDocumentContextKeywordInternal(
    query: string,
    options: RAGOptions
  ): Promise<KeywordSearchResult[]> {
    try {
      // Expand query if enabled
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
        topK: options.maxDocumentChunks || 10, // Get more results for hybrid merging
        minScore: (options.minScore || 0.3) * 0.5, // Lower threshold for keyword search
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
   * Expand query if expansion is enabled
   */
  private static async expandQueryIfEnabled(
    query: string,
    options: RAGOptions
  ): Promise<string> {
    if (!options.enableQueryExpansion) {
      return query;
    }

    try {
      const expansion = await QueryExpansionService.expandQuery(query, {
        strategy: options.expansionStrategy || 'hybrid',
        maxExpansions: options.maxExpansions || 5,
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
      return query; // Fallback to original query
    }
  }

  /**
   * Retrieve relevant document chunks from Pinecone (semantic search)
   */
  static async retrieveDocumentContext(
    query: string,
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    if (!options.enableDocumentSearch) {
      return [];
    }

    // Track latency for document search
    return await LatencyTrackerService.trackOperation(
      OperationType.DOCUMENT_SEARCH,
      async () => {
        return await this.retrieveDocumentContextInternal(query, options);
      },
      {
        userId: options.userId,
        metadata: {
          enableKeywordSearch: options.enableKeywordSearch,
          topicId: options.topicId,
        },
      }
    );
  }

  /**
   * Internal method for retrieving document context
   */
  private static async retrieveDocumentContextInternal(
    query: string,
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    try {
      // Expand query if enabled
      const expandedQuery = await this.expandQueryIfEnabled(query, options);

      // Generate embedding for the (possibly expanded) query
      logger.info('Generating query embedding for document retrieval', {
        userId: options.userId,
        queryLength: query.length,
        expandedQueryLength: expandedQuery.length,
        expansionEnabled: options.enableQueryExpansion,
      });

      let queryEmbedding: number[];
      try {
        // Track latency for embedding generation
        queryEmbedding = await LatencyTrackerService.trackOperation(
          OperationType.EMBEDDING_GENERATION,
          async () => {
            return await EmbeddingService.generateEmbedding(expandedQuery);
          },
          {
            userId: options.userId,
            metadata: {
              queryLength: expandedQuery.length,
            },
          }
        );
      } catch (embeddingError: any) {
        // Attempt error recovery
        const recoveryConfig: RecoveryConfig = {
          maxAttempts: 2,
          retryDelay: 1000,
          enableFallback: options.enableKeywordSearch,
          enableDegradation: true,
        };

        const fallbackFn = options.enableKeywordSearch
          ? async () => {
              // Fallback to keyword search - return empty to allow keyword search to proceed
              logger.info('Using keyword search as fallback for embedding failure', {
                userId: options.userId,
              });
              return [] as number[]; // Return empty to signal fallback
            }
          : undefined;

        const recoveryResult = await ErrorRecoveryService.attemptRecovery(
          ServiceType.EMBEDDING,
          embeddingError,
          async () => {
            // Retry embedding generation
            return await EmbeddingService.generateEmbedding(expandedQuery);
          },
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
          // Fallback to keyword search
          logger.warn('Embedding generation failed, falling back to keyword search', {
            error: embeddingError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
          });
          return [];
        } else {
          // Recovery failed, throw error
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

      // Check if Pinecone is configured
      const { isPineconeConfigured } = await import('../config/pinecone');
      if (!isPineconeConfigured()) {
        logger.warn('Pinecone is not configured - document search unavailable', {
          userId: options.userId,
          message: 'PINECONE_API_KEY environment variable is not set. Document search requires Pinecone to be configured.',
        });
        return [];
      }

      // Calculate adaptive threshold if enabled
      const useAdaptiveThreshold = options.useAdaptiveThreshold ?? true; // Default to true
      let minScore = options.minScore;
      
      if (useAdaptiveThreshold && minScore === undefined) {
        // First, do a broad search to analyze score distribution
        const broadSearchResults = await PineconeService.search(
          queryEmbedding,
          {
            userId: options.userId,
            topK: Math.min(50, (options.maxDocumentChunks || 10) * 3), // Get more results for analysis
            topicId: options.topicId,
            documentIds: options.documentIds,
            minScore: 0.3, // Low threshold for initial analysis
            embeddingModel,
          },
          embeddingDimensions
        ).catch(() => []);

        // Calculate adaptive threshold
        const thresholdResult = ThresholdOptimizerService.calculateThreshold(
          query,
          broadSearchResults,
          {
            minResults: options.minResults || 3,
            maxResults: options.maxResults || options.maxDocumentChunks || 10,
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
        // Use provided minScore or default
        minScore = minScore || 0.7;
      }
      
      logger.info('Searching Pinecone for document chunks', {
        userId: options.userId,
        query: query.substring(0, 100),
        topK: options.maxDocumentChunks || 5,
        minScore,
        topicId: options.topicId,
        documentIds: options.documentIds,
        embeddingModel,
        embeddingDimensions,
        adaptiveThreshold: useAdaptiveThreshold,
      });

      let searchResults: any[] = [];
      try {
        // Track latency for Pinecone query
        searchResults = await LatencyTrackerService.trackOperation(
          OperationType.PINECONE_QUERY,
          async () => {
            return await PineconeService.search(
              queryEmbedding,
              {
                userId: options.userId,
                topK: options.maxDocumentChunks || 10, // Get more for filtering
                topicId: options.topicId,
                documentIds: options.documentIds,
                minScore,
                embeddingModel, // Pass model for filtering if needed
              },
              embeddingDimensions
            );
          },
          {
            userId: options.userId,
            metadata: {
              topK: options.maxDocumentChunks || 10,
              minScore,
            },
          }
        );
      } catch (searchError: any) {
        // Handle Pinecone not configured error
        if (searchError.code === 'PINECONE_NOT_CONFIGURED') {
          logger.warn('Pinecone not configured, skipping document search', {
            userId: options.userId,
          });
          return [];
        }

        // Attempt error recovery
        const recoveryConfig: RecoveryConfig = {
          maxAttempts: 2,
          retryDelay: 1000,
          enableFallback: options.enableKeywordSearch,
          enableDegradation: true,
        };

        const fallbackFn = options.enableKeywordSearch
          ? async () => {
              // Fallback to keyword search - return empty to allow keyword search to proceed
              logger.info('Using keyword search as fallback for Pinecone failure', {
                userId: options.userId,
              });
              return [] as any[]; // Return empty to signal fallback
            }
          : undefined;

        const recoveryResult = await ErrorRecoveryService.attemptRecovery(
          ServiceType.PINECONE,
          searchError,
          async () => {
            // Retry Pinecone search
            return await PineconeService.search(
              queryEmbedding,
              {
                userId: options.userId,
                topK: options.maxDocumentChunks || 10,
                topicId: options.topicId,
                documentIds: options.documentIds,
                minScore,
                embeddingModel,
              },
              embeddingDimensions
            );
          },
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
          // Fallback to keyword search
          logger.warn('Pinecone search failed, falling back to keyword search', {
            error: searchError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
          });
          return [];
        } else {
          // Recovery failed, log and return empty if keyword search available
          logger.error('Pinecone search failed and recovery unsuccessful', {
            error: searchError.message,
            userId: options.userId,
            recoveryStrategy: recoveryResult.strategy,
            recoveryError: recoveryResult.error?.message,
          });
          
          if (options.enableKeywordSearch) {
            return [];
          }
          throw searchError;
        }
      }

      // Apply adaptive fallback if enabled and we have too few results
      if (useAdaptiveThreshold && searchResults.length < (options.minResults || 3)) {
        const config = ThresholdOptimizerService.getConfig();
        if (config.fallbackEnabled && minScore > config.minThreshold) {
          // Try with lower threshold
          const fallbackThreshold = Math.max(
            config.minThreshold,
            minScore - 0.1
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
              topK: options.maxDocumentChunks || 10,
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
      
      // Additional filtering: Remove results with very low scores (hard minimum)
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

      // Fetch document metadata in batch for better performance
      const documentContexts: DocumentContext[] = [];

      // Collect unique document IDs
      const uniqueDocumentIds = Array.from(new Set(searchResults.map(r => r.documentId)));
      
      // Fetch all documents in a single batch query
      const documentsMap = await DocumentService.getDocumentsBatch(uniqueDocumentIds, options.userId);

      // Process results using the batch-fetched documents
      for (const result of searchResults) {
        try {
          // Get document from batch map
          const document = documentsMap.get(result.documentId);

          if (!document) {
            logger.warn('Document not found for chunk', {
              documentId: result.documentId,
              chunkId: result.chunkId,
            });
            // Still include the chunk even if document fetch fails
            documentContexts.push({
              documentId: result.documentId,
              documentName: 'Unknown Document',
              chunkIndex: result.chunkIndex,
              content: result.content,
              score: result.score,
              // Metadata not available
            });
            continue;
          }

          // Extract metadata from document
          const author = document.metadata?.author || document.metadata?.Author || undefined;
          const authors = document.metadata?.authors || (author ? [author] : undefined);
          const documentType = document.file_type || undefined;
          const fileSize = document.file_size || undefined;
          
          // Format file size for display
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
          
          // Extract publication date from metadata if available
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
            // Include enhanced metadata
            timestamp: document.updated_at || document.created_at,
            author,
            documentType,
            createdAt: document.created_at,
            updatedAt: document.updated_at,
            // Additional metadata fields
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
          // Still include the chunk even if processing fails
          documentContexts.push({
            documentId: result.documentId,
            documentName: 'Unknown Document',
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.score,
            // Metadata not available
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
      // Don't throw - return empty array so web search can still work
      return [];
    }
  }

  /**
   * Retrieve web search results from Tavily
   */
  static async retrieveWebSearch(
    query: string,
    options: RAGOptions
  ): Promise<Array<{ title: string; url: string; content: string }>> {
    if (!options.enableWebSearch) {
      return [];
    }

    // Track latency for web search
    return await LatencyTrackerService.trackOperation(
      OperationType.WEB_SEARCH,
      async () => {
        return await this.retrieveWebSearchInternal(query, options);
      },
      {
        userId: options.userId,
        metadata: {
          topic: options.topic,
          timeRange: options.timeRange,
        },
      }
    );
  }

  /**
   * Internal method for web search
   */
  private static async retrieveWebSearchInternal(
    query: string,
    options: RAGOptions
  ): Promise<Array<{ title: string; url: string; content: string }>> {
    try {
      const searchRequest: SearchRequest = {
        query,
        topic: options.topic || undefined, // Use topic filter from options
        maxResults: options.maxWebResults || 5,
        timeRange: options.timeRange,
        startDate: options.startDate,
        endDate: options.endDate,
        country: options.country,
        optimizeQuery: options.optimizeSearchQuery ?? true, // Default to true
        optimizationContext: options.searchOptimizationContext,
        useTopicAwareQuery: options.useTopicAwareQuery ?? true, // Default to true
        topicQueryOptions: options.topicQueryOptions,
        enableQueryRewriting: options.enableQueryRewriting ?? false, // Default to false
        queryRewritingOptions: options.queryRewritingOptions,
        enableWebResultReranking: options.enableWebResultReranking ?? false, // Default to false
        rerankingConfig: options.webResultRerankingConfig,
        enableQualityScoring: options.enableQualityScoring ?? false, // Default to false
        qualityScoringConfig: options.qualityScoringConfig,
        minQualityScore: options.minQualityScore,
        filterByQuality: options.filterByQuality ?? false, // Default to false
      };

      logger.info('Performing web search with filters', {
        query: query.substring(0, 100),
        topic: options.topic,
        timeRange: options.timeRange,
        country: options.country,
        startDate: options.startDate,
        endDate: options.endDate,
      });

      let searchResponse;
      try {
        searchResponse = await SearchService.search(searchRequest);
      } catch (searchError: any) {
        // Attempt error recovery
        const recoveryConfig: RecoveryConfig = {
          maxAttempts: 2,
          retryDelay: 2000, // Longer delay for web search
          enableFallback: false, // No fallback for web search, just skip
          enableDegradation: true,
        };

        const recoveryResult = await ErrorRecoveryService.attemptRecovery(
          ServiceType.SEARCH,
          searchError,
          async () => {
            // Retry web search
            return await SearchService.search(searchRequest);
          },
          undefined, // No fallback function - just skip if recovery fails
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
          // Recovery failed, return empty results (document search can still work)
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
        logger.info('No web search results found', {
          query: query.substring(0, 100),
        });
        return [];
      }

      // Get current date as access date for web sources
      const accessDate = new Date().toISOString();
      
      const results = searchResponse.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        publishedDate: r.publishedDate, // Include publication date
        author: r.author, // Include author if available
        accessDate, // Include access date (when source was accessed)
      }));

      logger.info('Web search results retrieved', {
        resultsCount: results.length,
      });

      return results;
    } catch (error: any) {
      logger.warn('Web search failed, continuing without web results', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Combine semantic and keyword search results using hybrid search service
   */
  private static async combineSearchResults(
    semanticResults: DocumentContext[],
    keywordResults: KeywordSearchResult[],
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    // Use hybrid search service for merging
    const weights = options.semanticSearchWeight !== undefined || options.keywordSearchWeight !== undefined
      ? {
          semantic: options.semanticSearchWeight ?? 0.6,
          keyword: options.keywordSearchWeight ?? 0.4,
        }
      : undefined;

    const hybridResults = await HybridSearchService.performHybridSearch(
      semanticResults,
      keywordResults,
      {
        userId: options.userId,
        topicId: options.topicId,
        documentIds: options.documentIds,
        maxResults: options.maxDocumentChunks || 10,
        minScore: options.minScore,
        weights,
        useABTesting: options.useABTesting,
        enableDeduplication: options.enableDeduplication,
      }
    );

    // Convert hybrid results back to DocumentContext format
    // Preserve all metadata from hybrid results (which extends DocumentContext)
    return hybridResults.map(result => ({
      documentId: result.documentId,
      documentName: result.documentName,
      chunkIndex: result.chunkIndex,
      content: result.content,
      score: result.combinedScore, // Use combined score
      // Preserve all metadata fields
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

  /**
   * Retrieve RAG context (documents + web search)
   * Supports both semantic and keyword search, with optional hybrid combination
   * Includes caching with similarity-based lookup
   */
  static async retrieveContext(
    query: string,
    options: RAGOptions
  ): Promise<RAGContext> {
    // Track latency for RAG context retrieval
    return await LatencyTrackerService.trackOperation(
      OperationType.RAG_CONTEXT_RETRIEVAL,
      async () => {
        return await this.retrieveContextInternal(query, options);
      },
      {
        userId: options.userId,
        metadata: {
          enableDocumentSearch: options.enableDocumentSearch,
          enableWebSearch: options.enableWebSearch,
          enableKeywordSearch: options.enableKeywordSearch,
          topicId: options.topicId,
        },
      }
    );
  }

  /**
   * Internal method for retrieving context (without latency tracking wrapper)
   */
  private static async retrieveContextInternal(
    query: string,
    options: RAGOptions
  ): Promise<RAGContext> {
    // RAG context caching
    const enableContextCache = options.enableContextCache ?? true; // Default to true
    const enableSimilarityLookup = options.enableSimilarityLookup ?? true; // Default to true
    const similarityThreshold = options.contextCacheSimilarityThreshold ?? this.DEFAULT_SIMILARITY_THRESHOLD;

    // Check cache first if enabled
    if (enableContextCache) {
      try {
        const cacheKey = this.generateRAGCacheKey(query, options);
        
        // Try exact cache match first
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

        // Try similarity-based lookup if enabled
        if (enableSimilarityLookup) {
          try {
            // Generate query embedding for similarity matching
            const queryEmbedding = await EmbeddingService.generateEmbedding(query);
            
            // Find similar cache entries
            const similarEntries = await RedisCacheService.findSimilarEntries<RAGContext>(
              queryEmbedding,
              {
                prefix: this.RAG_CACHE_PREFIX,
                similarityThreshold,
                maxResults: 1, // Get the most similar one
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
            // Don't fail if similarity lookup fails
            logger.warn('Similarity-based cache lookup failed, continuing with retrieval', {
              error: similarityError.message,
            });
          }
        }

        RedisCacheService.recordRAGMiss();
      } catch (cacheError: any) {
        // Don't fail if cache check fails
        logger.warn('RAG context cache check failed, continuing with retrieval', {
          error: cacheError.message,
        });
        RedisCacheService.recordRAGError();
      }
    } else {
      RedisCacheService.recordRAGMiss();
    }

    // Calculate dynamic limits if enabled
    const enableDynamicLimits = options.enableDynamicLimits ?? true; // Default to true
    const useAdaptiveContextSelection = options.useAdaptiveContextSelection ?? true; // Default to true
    const enableAdaptiveContextSelection = options.enableAdaptiveContextSelection ?? true; // Default to true
    let maxDocumentChunks = options.maxDocumentChunks;
    let maxWebResults = options.maxWebResults;

    // Step 1: Calculate dynamic limits if enabled
    if (enableDynamicLimits && (maxDocumentChunks === undefined || maxWebResults === undefined)) {
      try {
        const dynamicLimitOptions: DynamicLimitOptions = {
          query,
          model: options.tokenBudgetOptions?.model,
          tokenBudgetOptions: options.tokenBudgetOptions,
          minDocumentChunks: options.minChunks,
          maxDocumentChunks: options.maxChunks || maxDocumentChunks,
          minWebResults: 2,
          maxWebResults: options.maxWebResults || 15,
          ...options.dynamicLimitOptions,
        };

        const dynamicLimits = RAGConfig.calculateDynamicLimits(dynamicLimitOptions);
        
        // Use dynamic limits as base, but allow adaptive selection to refine
        if (maxDocumentChunks === undefined) {
          maxDocumentChunks = dynamicLimits.documentChunks;
        }
        if (maxWebResults === undefined) {
          maxWebResults = dynamicLimits.webResults;
        }

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
        logger.warn('Dynamic limit calculation failed, using defaults', {
          error: error.message,
        });
        // Fall back to defaults if dynamic limit calculation fails
        if (maxDocumentChunks === undefined) {
          maxDocumentChunks = 5;
        }
        if (maxWebResults === undefined) {
          maxWebResults = 5;
        }
      }
    }

    // Step 2: Apply adaptive context selection if enabled (refines dynamic limits)
    if (enableAdaptiveContextSelection && (maxDocumentChunks === undefined || maxWebResults === undefined || options.adaptiveContextOptions)) {
      // Use new adaptive context service for both documents and web results
      const adaptiveOptions: AdaptiveContextOptions = {
        query,
        model: options.tokenBudgetOptions?.model,
        tokenBudgetOptions: options.tokenBudgetOptions,
        minDocumentChunks: options.minChunks || maxDocumentChunks || 3,
        maxDocumentChunks: options.maxChunks || maxDocumentChunks || 30,
        minWebResults: 2,
        maxWebResults: options.maxWebResults || maxWebResults || 15,
        preferDocuments: options.adaptiveContextOptions?.preferDocuments,
        preferWeb: options.adaptiveContextOptions?.preferWeb,
        balanceRatio: options.adaptiveContextOptions?.balanceRatio,
        enableComplexityAnalysis: options.adaptiveContextOptions?.enableComplexityAnalysis ?? true,
        enableTokenAwareSelection: options.adaptiveContextOptions?.enableTokenAwareSelection ?? true,
        ...options.adaptiveContextOptions,
      };

      const adaptiveSelection = AdaptiveContextService.selectAdaptiveContext(adaptiveOptions);
      
      // Use adaptive selection if it provides better limits or if dynamic limits weren't calculated
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
      // Fallback to old context selector for backward compatibility
      const contextSelectionOptions: ContextSelectionOptions = {
        minChunks: options.minChunks,
        maxChunks: options.maxChunks,
        defaultChunks: 5, // Default if not specified
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
      // Use provided values or defaults
      maxDocumentChunks = maxDocumentChunks || 5;
      maxWebResults = maxWebResults || 5;
    }

    logger.info('Retrieving RAG context', {
      userId: options.userId,
      query: query.substring(0, 100),
      enableDocumentSearch: options.enableDocumentSearch,
      enableKeywordSearch: options.enableKeywordSearch,
      enableWebSearch: options.enableWebSearch,
      maxDocumentChunks,
      adaptiveContextSelection: useAdaptiveContextSelection,
    });

    // Create updated options with calculated maxDocumentChunks and maxWebResults
    const updatedOptions: RAGOptions = {
      ...options,
      maxDocumentChunks,
      maxWebResults,
    };

    // Retrieve document context (semantic and/or keyword) and web search in parallel
    // Use Promise.allSettled to handle partial failures gracefully
    const [webSearchResult, semanticResult, keywordResult] = await Promise.allSettled([
      this.retrieveWebSearch(query, options),
      options.enableDocumentSearch
        ? this.retrieveDocumentContext(query, updatedOptions)
        : Promise.resolve([] as DocumentContext[]),
      options.enableKeywordSearch
        ? this.retrieveDocumentContextKeyword(query, updatedOptions)
        : Promise.resolve([] as KeywordSearchResult[]),
    ]);

    // Extract results, handling failures gracefully
    const webSearchResults = webSearchResult.status === 'fulfilled' 
      ? webSearchResult.value 
      : [];
    const semanticResults = semanticResult.status === 'fulfilled' 
      ? semanticResult.value 
      : [];
    const keywordResults = keywordResult.status === 'fulfilled' 
      ? keywordResult.value 
      : [];

    // Log any failures
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

    // Combine document search results
    let documentContexts: DocumentContext[] = [];
    
    if (options.enableDocumentSearch && options.enableKeywordSearch) {
      // Hybrid search: combine semantic and keyword results using hybrid search service
      documentContexts = await this.combineSearchResults(semanticResults, keywordResults, updatedOptions);
    } else if (options.enableDocumentSearch) {
      // Semantic search only
      documentContexts = semanticResults;
    } else if (options.enableKeywordSearch) {
      // Keyword search only - convert KeywordSearchResult to DocumentContext
      // Note: Metadata will need to be fetched separately if needed
      documentContexts = keywordResults.map(result => ({
        documentId: result.documentId,
        documentName: result.documentName || 'Unknown Document',
        chunkIndex: result.chunkIndex,
        content: result.content,
        score: result.score,
        // Metadata not available from keyword search results
      }));
    }

    // Apply re-ranking if enabled
    if (options.enableReranking && documentContexts.length > 0) {
      try {
        // Track latency for reranking
        const rerankedResults = await LatencyTrackerService.trackOperation(
          OperationType.RERANKING,
          async () => {
            return await RerankingService.rerank({
              query,
              results: documentContexts,
              strategy: options.rerankingStrategy,
              topK: options.rerankingTopK,
              maxResults: options.rerankingMaxResults || updatedOptions.maxDocumentChunks || documentContexts.length,
              minScore: options.minScore,
            });
          },
          {
            userId: options.userId,
            metadata: {
              resultCount: documentContexts.length,
              strategy: options.rerankingStrategy,
            },
          }
        );

        // Convert reranked results back to DocumentContext format
        // Preserve metadata from original documentContexts
        const documentMap = new Map(documentContexts.map(doc => [doc.documentId + '-' + doc.chunkIndex, doc]));
        documentContexts = rerankedResults.map(result => {
          const key = result.documentId + '-' + result.chunkIndex;
          const original = documentMap.get(key);
          return {
            documentId: result.documentId,
            documentName: result.documentName,
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.rerankedScore, // Use re-ranked score
            // Preserve all metadata from original
            timestamp: original?.timestamp,
            author: original?.author,
            authors: original?.authors,
            documentType: original?.documentType,
            fileSize: original?.fileSize,
            fileSizeFormatted: original?.fileSizeFormatted,
            publishedDate: original?.publishedDate,
            createdAt: original?.createdAt,
            updatedAt: original?.updatedAt,
          };
        });

        logger.info('Results re-ranked', {
          userId: options.userId,
          originalCount: documentContexts.length,
          rerankedCount: rerankedResults.length,
          strategy: options.rerankingStrategy,
        });
      } catch (error: any) {
        logger.warn('Re-ranking failed, using original results', {
          error: error.message,
          userId: options.userId,
        });
        // Continue with original results if re-ranking fails
      }
    }

    // Apply comprehensive deduplication if enabled (before diversity filtering)
    if (options.enableResultDeduplication && documentContexts.length > 0) {
      try {
        const deduplicationOptions: DeduplicationOptions = {
          similarityThreshold: options.deduplicationThreshold,
          nearDuplicateThreshold: options.deduplicationNearDuplicateThreshold,
        };

        const originalCount = documentContexts.length;
        
        // Track latency for deduplication
        const { results: deduplicatedResults, stats } = await LatencyTrackerService.trackOperation(
          OperationType.DEDUPLICATION,
          async () => {
            return DeduplicationService.deduplicate(
              documentContexts,
              deduplicationOptions
            );
          },
          {
            userId: options.userId,
            metadata: {
              resultCount: originalCount,
            },
          }
        );

        documentContexts = deduplicatedResults;

        logger.info('Deduplication applied', {
          userId: options.userId,
          originalCount,
          deduplicatedCount: documentContexts.length,
          exactDuplicatesRemoved: stats.exactDuplicatesRemoved,
          nearDuplicatesRemoved: stats.nearDuplicatesRemoved,
          similarityDuplicatesRemoved: stats.similarityDuplicatesRemoved,
          totalRemoved: stats.totalRemoved,
          processingTimeMs: stats.processingTimeMs,
        });
      } catch (error: any) {
        logger.warn('Deduplication failed, using original results', {
          error: error.message,
          userId: options.userId,
        });
      }
    }

    // Apply diversity filtering if enabled
    if (options.enableDiversityFilter && documentContexts.length > 0) {
      try {
        const diversityOptions: DiversityOptions = {
          lambda: options.diversityLambda,
          maxResults: options.diversityMaxResults,
          similarityThreshold: options.diversitySimilarityThreshold,
        };

        const originalCount = documentContexts.length;
        
        // Track latency for diversity filtering
        const diversifiedResults = await LatencyTrackerService.trackOperation(
          OperationType.DIVERSITY_FILTERING,
          async () => {
            return DiversityFilterService.applyMMR(
              documentContexts,
              diversityOptions
            );
          },
          {
            userId: options.userId,
            metadata: {
              resultCount: originalCount,
              lambda: diversityOptions.lambda,
            },
          }
        );

        // Convert back to DocumentContext (preserve original structure and metadata)
        const documentMap = new Map(documentContexts.map(doc => [doc.documentId + '-' + doc.chunkIndex, doc]));
        documentContexts = diversifiedResults.map(result => {
          const key = result.documentId + '-' + result.chunkIndex;
          const original = documentMap.get(key);
          return {
            documentId: result.documentId,
            documentName: result.documentName,
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.score, // Keep original score
            // Preserve all metadata from original
            timestamp: original?.timestamp,
            author: original?.author,
            authors: original?.authors,
            documentType: original?.documentType,
            fileSize: original?.fileSize,
            fileSizeFormatted: original?.fileSizeFormatted,
            publishedDate: original?.publishedDate,
            createdAt: original?.createdAt,
            updatedAt: original?.updatedAt,
          };
        });

        logger.info('Diversity filtering applied', {
          userId: options.userId,
          originalCount,
          diversifiedCount: documentContexts.length,
          lambda: diversityOptions.lambda,
        });
      } catch (error: any) {
        logger.warn('Diversity filtering failed, using original results', {
          error: error.message,
          userId: options.userId,
        });
      }
    }

    // Refine context selection based on actual retrieved context if adaptive selection enabled
    let finalDocumentContexts = documentContexts;
    let finalWebResults = webSearchResults;
    
    if (enableAdaptiveContextSelection && options.adaptiveContextOptions) {
      try {
        const context: RAGContext = {
          documentContexts,
          webSearchResults,
        };
        
        const initialSelection = AdaptiveContextService.selectAdaptiveContext({
          query,
          model: options.tokenBudgetOptions?.model,
          tokenBudgetOptions: options.tokenBudgetOptions,
          ...options.adaptiveContextOptions,
        });
        
        const refinedSelection = AdaptiveContextService.refineContextSelection(
          context,
          {
            query,
            model: options.tokenBudgetOptions?.model,
            tokenBudget: initialSelection.tokenBudget,
            ...options.adaptiveContextOptions,
          },
          initialSelection
        );
        
        // Apply refined selection if different from initial
        if (refinedSelection.documentChunks !== initialSelection.documentChunks ||
            refinedSelection.webResults !== initialSelection.webResults) {
          // Trim contexts to refined sizes (already sorted by score from retrieval)
          finalDocumentContexts = documentContexts.slice(0, refinedSelection.documentChunks);
          finalWebResults = webSearchResults.slice(0, refinedSelection.webResults);
          
          logger.info('Context refined based on actual size', {
            userId: options.userId,
            originalDocumentChunks: documentContexts.length,
            refinedDocumentChunks: finalDocumentContexts.length,
            originalWebResults: webSearchResults.length,
            refinedWebResults: finalWebResults.length,
          });
        }
      } catch (error: any) {
        logger.warn('Context refinement failed, using original context', {
          error: error.message,
        });
        // Continue with original context if refinement fails
      }
    }

    // Check degradation status
    const degradationStatus = DegradationService.getOverallStatus();
    const isDegraded = degradationStatus.level !== DegradationLevel.NONE;
    const isPartial = isDegraded && (
      (options.enableDocumentSearch && finalDocumentContexts.length === 0 && semanticResult.status === 'rejected') ||
      (options.enableWebSearch && finalWebResults.length === 0 && webSearchResult.status === 'rejected')
    );

    logger.info('RAG context retrieved', {
      userId: options.userId,
      documentChunks: finalDocumentContexts.length,
      webResults: finalWebResults.length,
      searchTypes: {
        semantic: options.enableDocumentSearch,
        keyword: options.enableKeywordSearch,
        hybrid: options.enableDocumentSearch && options.enableKeywordSearch,
      },
      rerankingEnabled: options.enableReranking,
      adaptiveSelection: enableAdaptiveContextSelection,
      degraded: isDegraded,
      degradationLevel: degradationStatus.level,
      partial: isPartial,
    });

    const ragContext: RAGContext = {
      documentContexts: finalDocumentContexts,
      webSearchResults: finalWebResults,
      degraded: isDegraded,
      degradationLevel: degradationStatus.level,
      affectedServices: degradationStatus.affectedServices,
      degradationMessage: isDegraded ? degradationStatus.message : undefined,
      partial: isPartial,
    };

    // Collect retrieval metrics (async, don't block)
    if (options.userId && finalDocumentContexts.length > 0) {
      MetricsService.collectMetrics(
        query,
        options.userId,
        finalDocumentContexts,
        undefined, // No ground truth available - will use score-based heuristic
        {
          topicId: options.topicId,
          documentIds: options.documentIds,
          searchTypes: {
            semantic: options.enableDocumentSearch,
            keyword: options.enableKeywordSearch,
            hybrid: options.enableDocumentSearch && options.enableKeywordSearch,
            web: options.enableWebSearch,
          },
          webResultsCount: finalWebResults.length,
        }
      ).catch((error: any) => {
        // Don't fail if metrics collection fails
        logger.warn('Failed to collect retrieval metrics', {
          error: error.message,
          userId: options.userId,
        });
      });
    }

    // Cache the RAG context if enabled
    if (enableContextCache) {
      try {
        const cacheKey = this.generateRAGCacheKey(query, options);
        const cacheTTL = this.calculateRAGCacheTTL(options);
        
        // Generate query embedding for similarity matching
        const queryEmbedding = await EmbeddingService.generateEmbedding(query);
        
        // Cache with embedding for similarity lookup
        await RedisCacheService.setWithEmbedding(
          cacheKey,
          ragContext,
          queryEmbedding,
          {
            prefix: this.RAG_CACHE_PREFIX,
            ttl: cacheTTL,
          }
        );
        
        RedisCacheService.recordRAGSet();
        
        logger.debug('RAG context cached', {
          userId: options.userId,
          query: query.substring(0, 100),
          ttl: cacheTTL,
          documentChunks: finalDocumentContexts.length,
          webResults: finalWebResults.length,
        });
      } catch (cacheError: any) {
        // Don't fail if caching fails
        RedisCacheService.recordRAGError();
        logger.warn('Failed to cache RAG context', {
          error: cacheError.message,
          userId: options.userId,
        });
      }
    }

    return ragContext;
  }

  /**
   * Format RAG context for AI prompt
   * Applies relevance-based ordering and compression before formatting
   */
  static async formatContextForPrompt(
    context: RAGContext,
    options: { 
      enableRelevanceOrdering?: boolean; 
      orderingOptions?: OrderingOptions;
      enableContextCompression?: boolean;
      compressionOptions?: CompressionOptions;
      enableContextSummarization?: boolean;
      summarizationOptions?: SummarizationOptions;
      enableSourcePrioritization?: boolean;
      prioritizationOptions?: PrioritizationOptions;
      enableTokenBudgeting?: boolean;
      tokenBudgetOptions?: TokenBudgetOptions;
      query?: string; // Query for compression context
      model?: string; // Model for token counting
      userId?: string; // User ID for latency tracking
    } = {}
  ): Promise<string> {
    // Track latency for context formatting
    return await LatencyTrackerService.trackOperation(
      OperationType.CONTEXT_FORMATTING,
      async () => {
        return await this.formatContextForPromptInternal(context, options);
      },
      {
        userId: options.userId,
        metadata: {
          documentChunks: context.documentContexts.length,
          webResults: context.webSearchResults.length,
        },
      }
    );
  }

  /**
   * Internal method for formatting context
   */
  private static async formatContextForPromptInternal(
    context: RAGContext,
    options: { 
      enableRelevanceOrdering?: boolean; 
      orderingOptions?: OrderingOptions;
      enableContextCompression?: boolean;
      compressionOptions?: CompressionOptions;
      enableContextSummarization?: boolean;
      summarizationOptions?: SummarizationOptions;
      enableSourcePrioritization?: boolean;
      prioritizationOptions?: PrioritizationOptions;
      enableTokenBudgeting?: boolean;
      tokenBudgetOptions?: TokenBudgetOptions;
      query?: string;
      model?: string;
      userId?: string;
    } = {}
  ): Promise<string> {
    const enableRelevanceOrdering = options.enableRelevanceOrdering ?? true; // Default to true
    const enableContextCompression = options.enableContextCompression ?? true; // Default to true
    const enableContextSummarization = options.enableContextSummarization ?? true; // Default to true
    const enableSourcePrioritization = options.enableSourcePrioritization ?? true; // Default to true
    const enableTokenBudgeting = options.enableTokenBudgeting ?? true; // Default to true

    // Apply relevance-based ordering if enabled
    let orderedContext = context;
    let orderingStats = null;

    if (enableRelevanceOrdering) {
      try {
        const orderingResult = RelevanceOrderingService.orderContext(
          context,
          options.orderingOptions || {}
        );
        orderedContext = {
          documentContexts: orderingResult.context.documentContexts,
          webSearchResults: orderingResult.context.webSearchResults,
        };
        orderingStats = orderingResult.stats;

        if (orderingStats.performanceWarning) {
          logger.warn('Ordering exceeded target time', {
            processingTimeMs: orderingStats.processingTimeMs,
            targetTime: 50,
          });
        }
      } catch (error: any) {
        logger.warn('Relevance ordering failed, using original order', {
          error: error.message,
        });
        // Continue with original context if ordering fails
      }
    }

    // Apply context summarization if enabled (before compression)
    let summarizedContext = orderedContext;
    let summarizationStats = null;

    if (enableContextSummarization) {
      try {
        // Track latency for context summarization
        const summarizationResult = await LatencyTrackerService.trackOperation(
          OperationType.CONTEXT_SUMMARIZATION,
          async () => {
            return await ContextSummarizerService.summarizeContext(
              orderedContext,
              {
                ...options.summarizationOptions,
                query: options.query,
                model: options.model,
              }
            );
          },
          {
            userId: options.userId,
            metadata: {
              documentChunks: orderedContext.documentContexts.length,
              webResults: orderedContext.webSearchResults.length,
            },
          }
        );

        if (summarizationResult.wasSummarized) {
          summarizedContext = summarizationResult.context;
          summarizationStats = summarizationResult.context.summarizationStats;

          logger.info('Context summarized', {
            originalTokens: summarizationStats?.originalTokens,
            summarizedTokens: summarizationStats?.summarizedTokens,
            compressionRatio: summarizationStats?.compressionRatio,
            itemsSummarized: summarizationStats?.itemsSummarized,
            processingTimeMs: summarizationStats?.processingTimeMs,
          });

          if (summarizationStats && summarizationStats.processingTimeMs > 3000) {
            logger.warn('Summarization exceeded target time', {
              processingTimeMs: summarizationStats.processingTimeMs,
              targetTime: 3000,
            });
          }
        }
      } catch (error: any) {
        logger.warn('Context summarization failed, using original context', {
          error: error.message,
        });
        // Continue with original context if summarization fails
      }
    }

    // Apply context compression if enabled (after summarization)
    let compressedContext = summarizedContext;
    let compressionStats = null;

    if (enableContextCompression) {
      try {
        // Track latency for context compression
        const compressionResult = await LatencyTrackerService.trackOperation(
          OperationType.CONTEXT_COMPRESSION,
          async () => {
            return await ContextCompressorService.compressContext(
              summarizedContext,
              {
                ...options.compressionOptions,
                query: options.query,
                model: options.model,
              }
            );
          },
          {
            userId: options.userId,
            metadata: {
              documentChunks: summarizedContext.documentContexts.length,
              webResults: summarizedContext.webSearchResults.length,
            },
          }
        );

        if (compressionResult.wasCompressed) {
          compressedContext = compressionResult.context;
          compressionStats = compressionResult.context.compressionStats;

          logger.info('Context compressed', {
            originalTokens: compressionStats?.originalTokens,
            compressedTokens: compressionStats?.compressedTokens,
            compressionRatio: compressionStats?.compressionRatio,
            strategy: compressionStats?.strategy,
            processingTimeMs: compressionStats?.processingTimeMs,
          });

          if (compressionStats && compressionStats.processingTimeMs > 2000) {
            logger.warn('Compression exceeded target time', {
              processingTimeMs: compressionStats.processingTimeMs,
              targetTime: 2000,
            });
          }
        }
      } catch (error: any) {
        logger.warn('Context compression failed, using original context', {
          error: error.message,
        });
        // Continue with original context if compression fails
      }
    }

    // Apply source prioritization if enabled
    let prioritizedContext = compressedContext;
    let prioritizationStats = null;

    if (enableSourcePrioritization) {
      try {
        const prioritizationResult = SourcePrioritizerService.prioritizeContext(
          compressedContext,
          {
            ...options.prioritizationOptions,
            query: options.query,
          }
        );

        prioritizedContext = prioritizationResult.context;
        prioritizationStats = prioritizationResult.stats;

        logger.info('Sources prioritized', {
          documentCount: prioritizationStats.documentCount,
          webResultCount: prioritizationStats.webResultCount,
          avgDocPriority: prioritizationStats.averageDocumentPriority.toFixed(2),
          avgWebPriority: prioritizationStats.averageWebPriority.toFixed(2),
          highPriorityDocs: prioritizationStats.highPriorityDocuments,
          highPriorityWeb: prioritizationStats.highPriorityWebResults,
          processingTimeMs: prioritizationStats.processingTimeMs,
        });
      } catch (error: any) {
        logger.warn('Source prioritization failed, using original order', {
          error: error.message,
        });
        // Continue with original context if prioritization fails
      }
    }

    // Apply token budgeting if enabled
    let budgetedContext = prioritizedContext;
    let tokenBudget: TokenBudget | null = null;

    if (enableTokenBudgeting && options.model) {
      try {
        // Calculate token budget
        const budgetOptions: TokenBudgetOptions = {
          model: options.model,
          userPrompt: options.query,
          ...options.tokenBudgetOptions,
        };
        
        tokenBudget = TokenBudgetService.calculateBudget(budgetOptions);
        
        // Check if context fits within budget
        const budgetCheck = TokenBudgetService.checkBudget(
          tokenBudget,
          prioritizedContext,
          options.model
        );
        
        if (!budgetCheck.fits) {
          logger.warn('Context exceeds token budget, trimming', {
            contextTokens: budgetCheck.contextTokens.total,
            availableBudget: tokenBudget.remaining.total,
            warnings: budgetCheck.warnings,
          });
          
          // Trim context to fit within budget
          budgetedContext = TokenBudgetService.trimContextToBudget(
            prioritizedContext,
            tokenBudget,
            options.model
          );
          
          // Re-check budget after trimming
          const recheck = TokenBudgetService.checkBudget(
            tokenBudget,
            budgetedContext,
            options.model
          );
          
          if (!recheck.fits) {
            logger.error('Context still exceeds budget after trimming', {
              contextTokens: recheck.contextTokens.total,
              availableBudget: tokenBudget.remaining.total,
              errors: recheck.errors,
            });
          }
        } else {
          logger.debug('Context fits within token budget', {
            contextTokens: budgetCheck.contextTokens.total,
            availableBudget: tokenBudget.remaining.total,
            documentTokens: budgetCheck.contextTokens.documentContext,
            webTokens: budgetCheck.contextTokens.webResults,
          });
        }
        
        logger.info('Token budget applied', {
          model: tokenBudget.model,
          modelLimit: tokenBudget.modelLimit,
          totalUsed: tokenBudget.usage.total,
          remaining: tokenBudget.remaining.total,
          summary: TokenBudgetService.getBudgetSummary(tokenBudget),
        });
      } catch (error: any) {
        logger.warn('Token budgeting failed, using original context', {
          error: error.message,
        });
        // Continue with original context if budgeting fails
      }
    }

    let formattedContext = '';

    // Add document context (now ordered, compressed, prioritized, and budgeted)
    if (budgetedContext.documentContexts.length > 0) {
      formattedContext += 'Relevant Document Excerpts:\n\n';
      budgetedContext.documentContexts.forEach((doc, index) => {
        // Use priority/weight to determine formatting prominence
        const isHighPriority = (doc as any).priority >= 0.7;
        const weight = (doc as any).weight || 1.0;
        
        // High priority documents get more prominent formatting
        if (isHighPriority) {
          formattedContext += `[Document ${index + 1}] ⭐ ${doc.documentName} (HIGH PRIORITY)\n`;
        } else {
          formattedContext += `[Document ${index + 1}] ${doc.documentName}\n`;
        }
        
        formattedContext += `Relevance Score: ${((doc as any).orderingScore || doc.score || 0).toFixed(2)}\n`;
        if ((doc as any).priority !== undefined) {
          formattedContext += `Priority: ${((doc as any).priority * 100).toFixed(0)}%\n`;
        }
        if ((doc as any).qualityScore !== undefined) {
          formattedContext += `Quality Score: ${(doc as any).qualityScore.toFixed(2)}\n`;
        }
        // Include enhanced metadata
        if (doc.documentType) {
          formattedContext += `Type: ${doc.documentType.toUpperCase()}\n`;
        }
        if (doc.fileSizeFormatted) {
          formattedContext += `Size: ${doc.fileSizeFormatted}\n`;
        }
        if (doc.author) {
          formattedContext += `Author: ${doc.author}\n`;
        } else if (doc.authors && doc.authors.length > 0) {
          formattedContext += `Authors: ${doc.authors.join(', ')}\n`;
        }
        if (doc.publishedDate) {
          const date = new Date(doc.publishedDate);
          if (!isNaN(date.getTime())) {
            formattedContext += `Published: ${date.toLocaleDateString()}\n`;
          }
        }
        if (doc.timestamp) {
          const date = new Date(doc.timestamp);
          if (!isNaN(date.getTime())) {
            formattedContext += `Last Updated: ${date.toLocaleDateString()}\n`;
          }
        }
        formattedContext += `Content: ${doc.content}\n\n`;
      });
    }

    // Add web search results (now ordered, compressed, prioritized, and budgeted)
    if (budgetedContext.webSearchResults.length > 0) {
      formattedContext += 'Web Search Results:\n\n';
      budgetedContext.webSearchResults.forEach((result, index) => {
        const n = index + 1;
        const isHighPriority = (result as any).priority >= 0.7;
        const weight = (result as any).weight || 1.0;
        
        // High priority web results get more prominent formatting
        if (isHighPriority) {
          formattedContext += `[Web Source ${n}] ⭐ ${result.title} (HIGH PRIORITY)\n`;
        } else {
          formattedContext += `[Web Source ${n}] ${result.title}\n`;
        }
        
        formattedContext += `URL: ${result.url}\n`;
        if ((result as any).priority !== undefined) {
          formattedContext += `Priority: ${((result as any).priority * 100).toFixed(0)}%\n`;
        }
        if ((result as any).metadata?.authorityScore !== undefined) {
          formattedContext += `Authority Score: ${((result as any).metadata.authorityScore * 100).toFixed(0)}%\n`;
        }
        // Include metadata
        if (result.publishedDate) {
          const date = new Date(result.publishedDate);
          if (!isNaN(date.getTime())) {
            formattedContext += `Published: ${date.toLocaleDateString()}\n`;
          }
        }
        if (result.author) {
          formattedContext += `Author: ${result.author}\n`;
        }
        if (result.accessDate) {
          const date = new Date(result.accessDate);
          if (!isNaN(date.getTime())) {
            formattedContext += `Accessed: ${date.toLocaleDateString()}\n`;
          }
        }
        formattedContext += `Content: ${result.content}\n\n`;
        formattedContext += `CITING: You MUST use [Web Source ${n}](${result.url}) inline when using this source—this exact format is required for clickable links.\n\n`;
      });
    }

    return formattedContext;
  }

  /**
   * Invalidate RAG context cache for a user
   * Called when user's documents or topics change
   */
  static async invalidateUserCache(userId: string): Promise<number> {
    try {
      const deleted = await RedisCacheService.deletePattern(`*|${userId}|*`, {
        prefix: this.RAG_CACHE_PREFIX,
      });
      
      logger.info('RAG context cache invalidated for user', {
        userId,
        deleted,
      });
      
      return deleted;
    } catch (error: any) {
      logger.error('Failed to invalidate user RAG cache', {
        userId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Invalidate RAG context cache for a topic
   * Called when topic documents change
   */
  static async invalidateTopicCache(userId: string, topicId: string): Promise<number> {
    try {
      const deleted = await RedisCacheService.deletePattern(`*|${userId}|${topicId}|*`, {
        prefix: this.RAG_CACHE_PREFIX,
      });
      
      logger.info('RAG context cache invalidated for topic', {
        userId,
        topicId,
        deleted,
      });
      
      return deleted;
    } catch (error: any) {
      logger.error('Failed to invalidate topic RAG cache', {
        userId,
        topicId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Invalidate RAG context cache for specific documents
   * Called when documents are updated or deleted
   */
  static async invalidateDocumentCache(userId: string, documentIds: string[]): Promise<number> {
    try {
      let totalDeleted = 0;
      
      for (const documentId of documentIds) {
        // Invalidate caches that include this document
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
      logger.error('Failed to invalidate document RAG cache', {
        userId,
        documentIds,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Clear all RAG context cache (use with caution)
   */
  static async clearAllRAGCache(): Promise<number> {
    try {
      const deleted = await RedisCacheService.clearAll({
        prefix: this.RAG_CACHE_PREFIX,
      });
      
      logger.info('All RAG context cache cleared', {
        deleted,
      });
      
      return deleted;
    } catch (error: any) {
      logger.error('Failed to clear RAG context cache', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get RAG cache statistics
   */
  static getRAGCacheStats() {
    return RedisCacheService.getRAGStats();
  }

  /**
   * Extract sources from RAG context for response
   */
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
      metadata?: import('../types/source').SourceMetadata;
    }> = [];

    // Add document sources - only include documents with meaningful relevance scores (>= 0.6)
    context.documentContexts
      .filter((doc) => doc.score >= 0.6) // Only include documents with good relevance
      .forEach((doc, index) => {
        sources.push({
          type: 'document',
          title: doc.documentName,
          documentId: doc.documentId,
          snippet: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
          score: doc.score,
          // Include enhanced metadata in sources
          metadata: {
            documentType: doc.documentType,
            fileSize: doc.fileSize,
            fileSizeFormatted: doc.fileSizeFormatted,
            author: doc.author,
            authors: doc.authors,
            publishedDate: doc.publishedDate,
            publicationDate: doc.publishedDate, // Alternative field name
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            timestamp: doc.timestamp,
          },
        });
      });

    // Add web sources
    context.webSearchResults.forEach((result, index) => {
      sources.push({
        type: 'web',
        title: result.title,
        url: result.url,
        snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
        // Include enhanced metadata in sources
        metadata: {
          publishedDate: result.publishedDate,
          publicationDate: result.publishedDate, // Alternative field name
          accessDate: result.accessDate, // Access date for web sources
          author: result.author,
          url: result.url,
        },
      });
    });

    return sources;
  }
}
