/**
 * Relevance Ordering Service
 * Orders document chunks and web results by relevance, quality, and other factors
 * Optimized for performance (<50ms target)
 */

import logger from '../config/logger';
import { DocumentContext, RAGContext } from './rag.service';
import { OrderingConfig, OrderingStrategy, getOrderingConfig, getOrderingConfigForStrategy } from '../config/ordering.config';
import { ResultQualityScorerService } from './result-quality-scorer.service';
import { DomainAuthorityService } from './domain-authority.service';

export interface OrderedDocumentContext extends DocumentContext {
  orderingScore?: number; // Combined ordering score
  qualityScore?: number; // Content quality score
}

export interface OrderedWebResult {
  title: string;
  url: string;
  content: string;
  orderingScore?: number; // Combined ordering score
  qualityScore?: number; // Content quality score
  authorityScore?: number; // Domain authority score
  freshnessScore?: number; // Freshness score
}

export interface OrderedRAGContext {
  documentContexts: OrderedDocumentContext[];
  webSearchResults: OrderedWebResult[];
}

export interface OrderingStats {
  documentCount: number;
  webResultCount: number;
  processingTimeMs: number;
  strategy: OrderingStrategy;
  performanceWarning?: boolean;
}

export interface OrderingOptions {
  config?: Partial<OrderingConfig>;
  strategy?: OrderingStrategy;
  maxProcessingTimeMs?: number;
}

/**
 * Relevance Ordering Service
 */
export class RelevanceOrderingService {
  /**
   * Calculate quality score for document context
   */
  private static calculateDocumentQualityScore(context: DocumentContext): number {
    try {
      const qualityResult = ResultQualityScorerService.scoreResult({
        title: context.documentName,
        url: '', // Not applicable for documents
        content: context.content,
        score: context.score,
      });
      return qualityResult.overallScore;
    } catch (e) {
      return 0.5; // Default quality score on error
    }
  }

  /**
   * Calculate quality score for web result
   */
  private static calculateWebQualityScore(result: { title: string; url: string; content: string }): number {
    try {
      const qualityResult = ResultQualityScorerService.scoreResult({
        title: result.title,
        url: result.url,
        content: result.content,
      });
      return qualityResult.overallScore;
    } catch (e) {
      return 0.5; // Default quality score on error
    }
  }

  /**
   * Calculate authority score for web result
   */
  private static calculateWebAuthorityScore(url: string): number {
    try {
      const authorityResult = DomainAuthorityService.getDomainAuthorityScore(url);
      return authorityResult.score;
    } catch (e) {
      return 0.5; // Default authority score on error
    }
  }

  /**
   * Calculate freshness score for web result
   */
  private static calculateWebFreshnessScore(publishedDate?: string): number {
    if (!publishedDate) {
      return 0.5; // Default freshness score if no date
    }

    try {
      const published = new Date(publishedDate);
      const now = new Date();
      
      if (isNaN(published.getTime()) || published > now) {
        return 0.5; // Invalid or future date
      }
      
      const daysDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
      
      // Calculate freshness: more recent = higher score
      if (daysDiff <= 7) {
        return 1.0; // Very recent (last week)
      } else if (daysDiff <= 30) {
        return 0.9; // Recent (last month)
      } else if (daysDiff <= 90) {
        return 0.8; // Recent (last 3 months)
      } else if (daysDiff <= 365) {
        return 0.7; // Within year
      } else {
        // Older: decay
        const decay = Math.max(0.3, 1.0 - (daysDiff - 365) / 365);
        return decay;
      }
    } catch (e) {
      return 0.5; // Default freshness score on error
    }
  }

  /**
   * Order document contexts by relevance
   */
  private static orderDocumentContexts(
    contexts: DocumentContext[],
    config: OrderingConfig,
    startTime: number,
    maxTimeMs: number
  ): OrderedDocumentContext[] {
    if (contexts.length === 0) {
      return [];
    }

    // Check time limit
    if (Date.now() - startTime > maxTimeMs) {
      logger.warn('Ordering time limit reached, using simple score ordering', {
        elapsed: Date.now() - startTime,
        maxTime: maxTimeMs,
      });
      // Fallback to simple score ordering
      return contexts
        .map(ctx => ({ ...ctx, orderingScore: ctx.score || 0 }))
        .sort((a, b) => (b.orderingScore || 0) - (a.orderingScore || 0));
    }

    const docConfig = config.documentOrdering;
    const ordered: OrderedDocumentContext[] = [];

    for (const context of contexts) {
      // Check time limit during processing
      if (Date.now() - startTime > maxTimeMs) {
        logger.warn('Ordering time limit reached during processing', {
          processed: ordered.length,
          total: contexts.length,
        });
        break;
      }

      let orderingScore = context.score || 0;
      let qualityScore: number | undefined;

      // Calculate quality score if needed
      if (docConfig.enableQualityOrdering || docConfig.strategy === 'quality' || docConfig.strategy === 'hybrid') {
        qualityScore = this.calculateDocumentQualityScore(context);
      }

      // Calculate combined ordering score based on strategy
      if (docConfig.strategy === 'relevance' || docConfig.strategy === 'score') {
        // Simple score ordering
        orderingScore = context.score || 0;
      } else if (docConfig.strategy === 'quality') {
        // Quality-based ordering
        orderingScore = qualityScore || 0;
      } else if (docConfig.strategy === 'hybrid') {
        // Hybrid: combine score and quality
        const score = context.score || 0;
        const quality = qualityScore || 0;
        orderingScore = score * docConfig.scoreWeight + quality * docConfig.qualityWeight;
      } else {
        // Default: use score
        orderingScore = context.score || 0;
      }

      ordered.push({
        ...context,
        orderingScore,
        qualityScore,
      });
    }

    // Sort by ordering score
    ordered.sort((a, b) => {
      const scoreA = a.orderingScore || 0;
      const scoreB = b.orderingScore || 0;
      return docConfig.ascending ? scoreA - scoreB : scoreB - scoreA;
    });

    return ordered;
  }

  /**
   * Order web results by relevance
   */
  private static orderWebResults(
    results: Array<{ title: string; url: string; content: string; score?: number; publishedDate?: string; author?: string }>,
    config: OrderingConfig,
    startTime: number,
    maxTimeMs: number
  ): OrderedWebResult[] {
    if (results.length === 0) {
      return [];
    }

    // Check time limit
    if (Date.now() - startTime > maxTimeMs) {
      logger.warn('Ordering time limit reached, using simple score ordering', {
        elapsed: Date.now() - startTime,
        maxTime: maxTimeMs,
      });
      // Fallback to simple score ordering
      return results
        .map(r => ({ ...r, orderingScore: r.score || 0 }))
        .sort((a, b) => (b.orderingScore || 0) - (a.orderingScore || 0));
    }

    const webConfig = config.webResultOrdering;
    const ordered: OrderedWebResult[] = [];

    for (const result of results) {
      // Check time limit during processing
      if (Date.now() - startTime > maxTimeMs) {
        logger.warn('Ordering time limit reached during processing', {
          processed: ordered.length,
          total: results.length,
        });
        break;
      }

      let orderingScore = result.score || 0;
      let qualityScore: number | undefined;
      let authorityScore: number | undefined;
      let freshnessScore: number | undefined;

      // Calculate quality score if needed
      if (webConfig.enableQualityOrdering || webConfig.strategy === 'quality' || webConfig.strategy === 'hybrid') {
        qualityScore = this.calculateWebQualityScore(result);
      }

      // Calculate authority score if needed
      if (webConfig.enableAuthorityOrdering || webConfig.strategy === 'hybrid') {
        authorityScore = this.calculateWebAuthorityScore(result.url);
      }

      // Calculate freshness score if needed
      if (webConfig.enableFreshnessOrdering || webConfig.strategy === 'chronological') {
        freshnessScore = this.calculateWebFreshnessScore(result.publishedDate);
      }

      // Calculate combined ordering score based on strategy
      if (webConfig.strategy === 'relevance' || webConfig.strategy === 'score') {
        // Simple score ordering (fallback to quality if no score)
        if (result.score !== undefined && result.score > 0) {
          orderingScore = result.score;
        } else {
          // No score available, use quality as fallback
          if (!qualityScore) {
            qualityScore = this.calculateWebQualityScore(result);
          }
          orderingScore = qualityScore;
        }
      } else if (webConfig.strategy === 'quality') {
        // Quality-based ordering
        orderingScore = qualityScore || 0;
      } else if (webConfig.strategy === 'chronological') {
        // Chronological ordering
        orderingScore = freshnessScore || 0;
      } else if (webConfig.strategy === 'hybrid') {
        // Hybrid: combine score, quality, and authority
        const score = result.score !== undefined && result.score > 0 ? result.score : 0;
        const quality = qualityScore || 0;
        const authority = authorityScore || 0;
        
        // If no score, adjust weights to use quality and authority
        if (score === 0) {
          const totalWeight = webConfig.qualityWeight + webConfig.authorityWeight;
          if (totalWeight > 0) {
            orderingScore = 
              quality * (webConfig.qualityWeight / totalWeight) +
              authority * (webConfig.authorityWeight / totalWeight);
          } else {
            orderingScore = quality; // Fallback to quality
          }
        } else {
          orderingScore = 
            score * webConfig.scoreWeight +
            quality * webConfig.qualityWeight +
            authority * webConfig.authorityWeight;
        }
      } else {
        // Default: use score or quality as fallback
        if (result.score !== undefined && result.score > 0) {
          orderingScore = result.score;
        } else {
          if (!qualityScore) {
            qualityScore = this.calculateWebQualityScore(result);
          }
          orderingScore = qualityScore;
        }
      }

      ordered.push({
        title: result.title,
        url: result.url,
        content: result.content,
        orderingScore,
        qualityScore,
        authorityScore,
        freshnessScore,
      });
    }

    // Sort by ordering score
    ordered.sort((a, b) => {
      const scoreA = a.orderingScore || 0;
      const scoreB = b.orderingScore || 0;
      return webConfig.ascending ? scoreA - scoreB : scoreB - scoreA;
    });

    return ordered;
  }

  /**
   * Order RAG context by relevance
   */
  static orderContext(
    context: RAGContext,
    options: OrderingOptions = {}
  ): {
    context: OrderedRAGContext;
    stats: OrderingStats;
  } {
    const startTime = Date.now();
    
    // Determine configuration
    let config: OrderingConfig;
    if (options.strategy) {
      config = getOrderingConfigForStrategy(options.strategy);
    } else if (options.config) {
      config = { ...getOrderingConfig(), ...options.config };
    } else {
      config = getOrderingConfig();
    }

    const maxTimeMs = options.maxProcessingTimeMs || config.maxProcessingTimeMs;

    // Order document contexts
    const orderedDocuments = this.orderDocumentContexts(
      context.documentContexts,
      config,
      startTime,
      maxTimeMs
    );

    // Order web results
    // Note: Web results in RAGContext don't have scores, so we'll use quality/authority for ordering
    const orderedWebResults = this.orderWebResults(
      context.webSearchResults.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: undefined, // Web results don't have scores in RAGContext
        publishedDate: undefined,
      })),
      config,
      startTime,
      maxTimeMs
    );

    const processingTimeMs = Date.now() - startTime;
    const performanceWarning = processingTimeMs > maxTimeMs;

    if (performanceWarning) {
      logger.warn('Ordering exceeded target time', {
        processingTimeMs,
        maxTime: maxTimeMs,
        documentCount: orderedDocuments.length,
        webResultCount: orderedWebResults.length,
      });
    }

    logger.debug('Context ordered by relevance', {
      strategy: config.documentOrdering.strategy,
      documentCount: orderedDocuments.length,
      webResultCount: orderedWebResults.length,
      processingTimeMs,
      performanceWarning,
    });

    return {
      context: {
        documentContexts: orderedDocuments,
        webSearchResults: orderedWebResults,
      },
      stats: {
        documentCount: orderedDocuments.length,
        webResultCount: orderedWebResults.length,
        processingTimeMs,
        strategy: config.documentOrdering.strategy,
        performanceWarning,
      },
    };
  }

  /**
   * Quick order (simple score-based, fastest)
   */
  static quickOrder(context: RAGContext): OrderedRAGContext {
    // Simple score-based ordering (no quality/authority calculations)
    const orderedDocuments = [...context.documentContexts]
      .map(ctx => ({ ...ctx, orderingScore: ctx.score || 0 }))
      .sort((a, b) => (b.orderingScore || 0) - (a.orderingScore || 0));

    const orderedWebResults = [...context.webSearchResults]
      .map(r => ({ ...r, orderingScore: 0.5 })) // Default score
      .sort((a, b) => (b.orderingScore || 0) - (a.orderingScore || 0));

    return {
      documentContexts: orderedDocuments,
      webSearchResults: orderedWebResults,
    };
  }
}
