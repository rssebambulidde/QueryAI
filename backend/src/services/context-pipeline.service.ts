/**
 * Context Pipeline Service
 *
 * Handles the post-retrieval processing pipeline:
 * - Re-ranking
 * - Deduplication
 * - Diversity filtering (MMR)
 * - Adaptive context refinement
 * - Relevance ordering
 * - Context summarization
 * - Context compression
 * - Source prioritization
 * - Token budgeting
 * - Final formatting (document + web → prompt string)
 *
 * Extracted from rag.service.ts for better separation of concerns.
 */

import { RerankingService } from './reranking.service';
import { RerankingStrategy } from '../config/reranking.config';
import { DeduplicationService, DeduplicationOptions } from './deduplication.service';
import { DiversityFilterService, DiversityOptions } from './diversity-filter.service';
import { RelevanceOrderingService, OrderingOptions } from './relevance-ordering.service';
import { ContextCompressorService, CompressionOptions } from './context-compressor.service';
import { ContextSummarizerService, SummarizationOptions } from './context-summarizer.service';
import { SourcePrioritizerService, PrioritizationOptions } from './source-prioritizer.service';
import { TokenBudgetService, TokenBudgetOptions, TokenBudget } from './token-budget.service';
import { AdaptiveContextService } from './adaptive-context.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import logger from '../config/logger';
import { RetrievalConfig } from '../config/thresholds.config';

import type { DocumentContext, RAGContext, RAGOptions } from './rag.service';

/**
 * Options for the context pipeline processing phase.
 * A subset of RAGOptions relevant to post-retrieval processing.
 */
export interface ContextPipelineOptions {
  userId?: string;
  // Re-ranking
  enableReranking?: boolean;
  rerankingStrategy?: RerankingStrategy;
  rerankingTopK?: number;
  rerankingMaxResults?: number;
  minScore?: number;
  maxDocumentChunks?: number;
  // Deduplication
  enableResultDeduplication?: boolean;
  deduplicationThreshold?: number;
  deduplicationNearDuplicateThreshold?: number;
  // Diversity
  enableDiversityFilter?: boolean;
  diversityLambda?: number;
  diversityMaxResults?: number;
  diversitySimilarityThreshold?: number;
  // Adaptive context refinement
  enableAdaptiveContextSelection?: boolean;
  adaptiveContextOptions?: RAGOptions['adaptiveContextOptions'];
  tokenBudgetOptions?: TokenBudgetOptions;
  query?: string;
  model?: string;
}

/**
 * Options for the formatting phase.
 */
export interface FormatOptions {
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
}

export class ContextPipelineService {
  // ═══════════════════════════════════════════════════════════════════
  // Pipeline: post-retrieval processing
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Run the full post-retrieval pipeline on raw retrieval results:
   * re-ranking → deduplication → diversity → adaptive refinement.
   *
   * Mutates nothing — returns a new set of processed document contexts
   * and (optionally trimmed) web results.
   */
  static async processRetrievalResults(
    documentContexts: DocumentContext[],
    webSearchResults: RAGContext['webSearchResults'],
    options: ContextPipelineOptions
  ): Promise<{ documentContexts: DocumentContext[]; webSearchResults: RAGContext['webSearchResults'] }> {
    let docs = documentContexts;
    let webs = webSearchResults;

    // ── Re-ranking ────────────────────────────────────────────────
    if (options.enableReranking && docs.length > 0) {
      docs = await this.applyReranking(docs, options);
    }

    // ── Deduplication ─────────────────────────────────────────────
    if (options.enableResultDeduplication && docs.length > 0) {
      docs = await this.applyDeduplication(docs, options);
    }

    // ── Diversity filtering ───────────────────────────────────────
    if (options.enableDiversityFilter && docs.length > 0) {
      docs = await this.applyDiversityFilter(docs, options);
    }

    // ── Adaptive context refinement ──────────────────────────────
    if (options.enableAdaptiveContextSelection && options.adaptiveContextOptions) {
      const refined = this.applyAdaptiveRefinement(docs, webs, options);
      docs = refined.documentContexts;
      webs = refined.webSearchResults;
    }

    return { documentContexts: docs, webSearchResults: webs };
  }

  // ── Individual pipeline stages ─────────────────────────────────

  private static async applyReranking(
    documentContexts: DocumentContext[],
    options: ContextPipelineOptions
  ): Promise<DocumentContext[]> {
    try {
      const rerankedResults = await LatencyTrackerService.trackOperation(
        OperationType.RERANKING,
        async () => RerankingService.rerank({
          query: options.query || '',
          results: documentContexts,
          strategy: options.rerankingStrategy,
          topK: options.rerankingTopK,
          maxResults: options.rerankingMaxResults || options.maxDocumentChunks || documentContexts.length,
          minScore: options.minScore,
        }),
        {
          userId: options.userId,
          metadata: {
            resultCount: documentContexts.length,
            strategy: options.rerankingStrategy,
          },
        }
      );

      const documentMap = new Map(documentContexts.map(doc => [doc.documentId + '-' + doc.chunkIndex, doc]));
      const result = rerankedResults.map(r => {
        const key = r.documentId + '-' + r.chunkIndex;
        const original = documentMap.get(key);
        return {
          documentId: r.documentId,
          documentName: r.documentName,
          chunkIndex: r.chunkIndex,
          content: r.content,
          score: r.rerankedScore,
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

      return result;
    } catch (error: any) {
      logger.warn('Re-ranking failed, using original results', {
        error: error.message,
        userId: options.userId,
      });
      return documentContexts;
    }
  }

  private static async applyDeduplication(
    documentContexts: DocumentContext[],
    options: ContextPipelineOptions
  ): Promise<DocumentContext[]> {
    try {
      const deduplicationOptions: DeduplicationOptions = {
        similarityThreshold: options.deduplicationThreshold,
        nearDuplicateThreshold: options.deduplicationNearDuplicateThreshold,
      };

      const originalCount = documentContexts.length;

      const { results: deduplicatedResults, stats } = await LatencyTrackerService.trackOperation(
        OperationType.DEDUPLICATION,
        async () => DeduplicationService.deduplicate(documentContexts, deduplicationOptions),
        { userId: options.userId, metadata: { resultCount: originalCount } }
      );

      logger.info('Deduplication applied', {
        userId: options.userId,
        originalCount,
        deduplicatedCount: deduplicatedResults.length,
        exactDuplicatesRemoved: stats.exactDuplicatesRemoved,
        nearDuplicatesRemoved: stats.nearDuplicatesRemoved,
        similarityDuplicatesRemoved: stats.similarityDuplicatesRemoved,
        totalRemoved: stats.totalRemoved,
        processingTimeMs: stats.processingTimeMs,
      });

      return deduplicatedResults;
    } catch (error: any) {
      logger.warn('Deduplication failed, using original results', {
        error: error.message,
        userId: options.userId,
      });
      return documentContexts;
    }
  }

  private static async applyDiversityFilter(
    documentContexts: DocumentContext[],
    options: ContextPipelineOptions
  ): Promise<DocumentContext[]> {
    try {
      const diversityOptions: DiversityOptions = {
        lambda: options.diversityLambda,
        maxResults: options.diversityMaxResults,
        similarityThreshold: options.diversitySimilarityThreshold,
      };

      const originalCount = documentContexts.length;

      const diversifiedResults = await LatencyTrackerService.trackOperation(
        OperationType.DIVERSITY_FILTERING,
        async () => DiversityFilterService.applyMMR(documentContexts, diversityOptions),
        { userId: options.userId, metadata: { resultCount: originalCount, lambda: diversityOptions.lambda } }
      );

      const documentMap = new Map(documentContexts.map(doc => [doc.documentId + '-' + doc.chunkIndex, doc]));
      const result = diversifiedResults.map(r => {
        const key = r.documentId + '-' + r.chunkIndex;
        const original = documentMap.get(key);
        return {
          documentId: r.documentId,
          documentName: r.documentName,
          chunkIndex: r.chunkIndex,
          content: r.content,
          score: r.score,
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
        diversifiedCount: result.length,
        lambda: diversityOptions.lambda,
      });

      return result;
    } catch (error: any) {
      logger.warn('Diversity filtering failed, using original results', {
        error: error.message,
        userId: options.userId,
      });
      return documentContexts;
    }
  }

  private static applyAdaptiveRefinement(
    documentContexts: DocumentContext[],
    webSearchResults: RAGContext['webSearchResults'],
    options: ContextPipelineOptions
  ): { documentContexts: DocumentContext[]; webSearchResults: RAGContext['webSearchResults'] } {
    try {
      const context: RAGContext = { documentContexts, webSearchResults };

      const initialSelection = AdaptiveContextService.selectAdaptiveContext({
        query: options.query || '',
        model: options.tokenBudgetOptions?.model,
        tokenBudgetOptions: options.tokenBudgetOptions,
        ...options.adaptiveContextOptions,
      });

      const refinedSelection = AdaptiveContextService.refineContextSelection(
        context,
        {
          query: options.query || '',
          model: options.tokenBudgetOptions?.model,
          tokenBudget: initialSelection.tokenBudget,
          ...options.adaptiveContextOptions,
        },
        initialSelection
      );

      if (refinedSelection.documentChunks !== initialSelection.documentChunks ||
          refinedSelection.webResults !== initialSelection.webResults) {
        const finalDocs = documentContexts.slice(0, refinedSelection.documentChunks);
        const finalWebs = webSearchResults.slice(0, refinedSelection.webResults);

        logger.info('Context refined based on actual size', {
          userId: options.userId,
          originalDocumentChunks: documentContexts.length,
          refinedDocumentChunks: finalDocs.length,
          originalWebResults: webSearchResults.length,
          refinedWebResults: finalWebs.length,
        });

        return { documentContexts: finalDocs, webSearchResults: finalWebs };
      }
    } catch (error: any) {
      logger.warn('Context refinement failed, using original context', { error: error.message });
    }

    return { documentContexts, webSearchResults };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Formatting pipeline
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Format RAG context for an AI prompt.
   * Applies: ordering → summarization → compression → prioritization → token budgeting → string formatting.
   */
  static async formatContextForPrompt(
    context: RAGContext,
    options: FormatOptions = {}
  ): Promise<string> {
    return await LatencyTrackerService.trackOperation(
      OperationType.CONTEXT_FORMATTING,
      async () => this.formatContextForPromptInternal(context, options),
      {
        userId: options.userId,
        metadata: {
          documentChunks: context.documentContexts.length,
          webResults: context.webSearchResults.length,
        },
      }
    );
  }

  private static async formatContextForPromptInternal(
    context: RAGContext,
    options: FormatOptions = {}
  ): Promise<string> {
    const enableRelevanceOrdering = options.enableRelevanceOrdering ?? true;
    const enableContextCompression = options.enableContextCompression ?? true;
    const enableContextSummarization = options.enableContextSummarization ?? true;
    const enableSourcePrioritization = options.enableSourcePrioritization ?? true;
    const enableTokenBudgeting = options.enableTokenBudgeting ?? true;

    // ── Relevance ordering ────────────────────────────────────────
    let orderedContext = context;

    if (enableRelevanceOrdering) {
      try {
        const orderingResult = RelevanceOrderingService.orderContext(context, options.orderingOptions || {});
        orderedContext = {
          documentContexts: orderingResult.context.documentContexts,
          webSearchResults: orderingResult.context.webSearchResults,
        };

        if (orderingResult.stats.performanceWarning) {
          logger.warn('Ordering exceeded target time', {
            processingTimeMs: orderingResult.stats.processingTimeMs,
            targetTime: RetrievalConfig.processingTargets.orderingTargetMs,
          });
        }
      } catch (error: any) {
        logger.warn('Relevance ordering failed, using original order', { error: error.message });
      }
    }

    // ── Context summarization ─────────────────────────────────────
    let summarizedContext = orderedContext;

    if (enableContextSummarization) {
      try {
        const summarizationResult = await LatencyTrackerService.trackOperation(
          OperationType.CONTEXT_SUMMARIZATION,
          async () => ContextSummarizerService.summarizeContext(orderedContext, {
            ...options.summarizationOptions,
            query: options.query,
            model: options.model,
          }),
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
          const stats = summarizationResult.context.summarizationStats;

          logger.info('Context summarized', {
            originalTokens: stats?.originalTokens,
            summarizedTokens: stats?.summarizedTokens,
            compressionRatio: stats?.compressionRatio,
            itemsSummarized: stats?.itemsSummarized,
            processingTimeMs: stats?.processingTimeMs,
          });

          if (stats && stats.processingTimeMs > RetrievalConfig.processingTargets.summarizationTimeoutMs) {
            logger.warn('Summarization exceeded target time', {
              processingTimeMs: stats.processingTimeMs,
              targetTime: RetrievalConfig.processingTargets.summarizationTimeoutMs,
            });
          }
        }
      } catch (error: any) {
        logger.warn('Context summarization failed, using original context', { error: error.message });
      }
    }

    // ── Context compression ───────────────────────────────────────
    let compressedContext = summarizedContext;

    if (enableContextCompression) {
      try {
        const compressionResult = await LatencyTrackerService.trackOperation(
          OperationType.CONTEXT_COMPRESSION,
          async () => ContextCompressorService.compressContext(summarizedContext, {
            ...options.compressionOptions,
            query: options.query,
            model: options.model,
          }),
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
          const stats = compressionResult.context.compressionStats;

          logger.info('Context compressed', {
            originalTokens: stats?.originalTokens,
            compressedTokens: stats?.compressedTokens,
            compressionRatio: stats?.compressionRatio,
            strategy: stats?.strategy,
            processingTimeMs: stats?.processingTimeMs,
          });

          if (stats && stats.processingTimeMs > RetrievalConfig.processingTargets.compressionTimeoutMs) {
            logger.warn('Compression exceeded target time', {
              processingTimeMs: stats.processingTimeMs,
              targetTime: RetrievalConfig.processingTargets.compressionTimeoutMs,
            });
          }
        }
      } catch (error: any) {
        logger.warn('Context compression failed, using original context', { error: error.message });
      }
    }

    // ── Source prioritization ─────────────────────────────────────
    let prioritizedContext = compressedContext;

    if (enableSourcePrioritization) {
      try {
        const prioritizationResult = SourcePrioritizerService.prioritizeContext(compressedContext, {
          ...options.prioritizationOptions,
          query: options.query,
        });

        prioritizedContext = prioritizationResult.context;
        const stats = prioritizationResult.stats;

        logger.info('Sources prioritized', {
          documentCount: stats.documentCount,
          webResultCount: stats.webResultCount,
          avgDocPriority: stats.averageDocumentPriority.toFixed(2),
          avgWebPriority: stats.averageWebPriority.toFixed(2),
          highPriorityDocs: stats.highPriorityDocuments,
          highPriorityWeb: stats.highPriorityWebResults,
          processingTimeMs: stats.processingTimeMs,
        });
      } catch (error: any) {
        logger.warn('Source prioritization failed, using original order', { error: error.message });
      }
    }

    // ── Token budgeting ──────────────────────────────────────────
    let budgetedContext = prioritizedContext;
    let tokenBudget: TokenBudget | null = null;

    if (enableTokenBudgeting && options.model) {
      try {
        const budgetOptions: TokenBudgetOptions = {
          model: options.model,
          userPrompt: options.query,
          ...options.tokenBudgetOptions,
        };

        tokenBudget = TokenBudgetService.calculateBudget(budgetOptions);

        const budgetCheck = TokenBudgetService.checkBudget(tokenBudget, prioritizedContext, options.model);

        if (!budgetCheck.fits) {
          logger.warn('Context exceeds token budget, trimming', {
            contextTokens: budgetCheck.contextTokens.total,
            availableBudget: tokenBudget.remaining.total,
            warnings: budgetCheck.warnings,
          });

          budgetedContext = TokenBudgetService.trimContextToBudget(prioritizedContext, tokenBudget, options.model);

          const recheck = TokenBudgetService.checkBudget(tokenBudget, budgetedContext, options.model);
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
        logger.warn('Token budgeting failed, using original context', { error: error.message });
      }
    }

    // ── Build formatted string ───────────────────────────────────
    return this.buildFormattedString(budgetedContext);
  }

  /**
   * Convert processed RAG context into the final prompt string.
   */
  private static buildFormattedString(context: RAGContext): string {
    let formattedContext = '';

    if (context.documentContexts.length > 0) {
      formattedContext += 'Relevant Document Excerpts:\n\n';
      context.documentContexts.forEach((doc, index) => {
        const isHighPriority = (doc as any).priority >= RetrievalConfig.highPriorityThreshold;

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

    if (context.webSearchResults.length > 0) {
      formattedContext += 'Web Search Results:\n\n';
      context.webSearchResults.forEach((result, index) => {
        const n = index + 1;
        const isHighPriority = (result as any).priority >= RetrievalConfig.highPriorityThreshold;

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
}
