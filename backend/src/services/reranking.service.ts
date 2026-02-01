/**
 * Re-ranking Service
 * Re-ranks search results using cross-encoder models or score-based approaches
 * Improves precision by re-scoring top-K results from initial retrieval
 */

import { DocumentContext } from './rag.service';
import { HybridSearchResult } from './hybrid-search.service';
import {
  RerankingConfig,
  RerankingStrategy,
  getRerankingConfig,
  validateRerankingConfig,
  DEFAULT_RERANKING_CONFIG,
} from '../config/reranking.config';
import logger from '../config/logger';

export interface RerankedResult extends DocumentContext {
  originalScore: number; // Original score before re-ranking
  rerankedScore: number; // Score after re-ranking
  rankChange: number; // Change in rank (negative = moved up, positive = moved down)
}

export interface RerankingOptions {
  query: string;
  results: DocumentContext[];
  topK?: number; // Number of results to re-rank
  maxResults?: number; // Maximum results to return
  strategy?: RerankingStrategy;
  minScore?: number;
}

/**
 * Re-ranking Service
 */
export class RerankingService {
  /**
   * Calculate document length score (shorter documents often more relevant)
   * Returns score between 0 and 1 (shorter = higher score)
   */
  private static calculateLengthScore(content: string): number {
    const length = content.length;
    // Normalize: shorter documents get higher scores
    // Using inverse log scale: score = 1 / (1 + log(length / 100))
    const normalizedLength = length / 100;
    const score = 1 / (1 + Math.log10(Math.max(1, normalizedLength)));
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate position score (original position in results)
   * Returns score between 0 and 1 (higher position = higher score)
   */
  private static calculatePositionScore(originalIndex: number, totalResults: number): number {
    if (totalResults === 0) return 0;
    // Higher position (lower index) = higher score
    return 1 - (originalIndex / totalResults);
  }

  /**
   * Re-rank using score-based approach
   * Combines multiple signals: semantic score, keyword score, length, position
   */
  private static rerankWithScoreBased(
    query: string,
    results: DocumentContext[],
    config: RerankingConfig
  ): RerankedResult[] {
    const weights = config.scoreWeights || DEFAULT_RERANKING_CONFIG.scoreWeights!;
    
    const reranked: RerankedResult[] = results.map((result, index) => {
      // Get original score (normalize to 0-1 if needed)
      const originalScore = result.score;
      
      // Calculate additional scores
      const lengthScore = this.calculateLengthScore(result.content);
      const positionScore = this.calculatePositionScore(index, results.length);
      
      // Extract semantic and keyword scores if available (from hybrid search)
      // For now, we'll use the combined score and estimate components
      const semanticScore = originalScore * 0.6; // Estimate
      const keywordScore = originalScore * 0.4; // Estimate
      
      // Calculate weighted re-ranked score
      const rerankedScore =
        semanticScore * weights.semantic +
        keywordScore * weights.keyword +
        lengthScore * weights.length +
        positionScore * weights.position;
      
      return {
        ...result,
        originalScore,
        rerankedScore,
        rankChange: 0, // Will be calculated after sorting
      };
    });

    // Sort by re-ranked score (descending)
    reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);

    // Calculate rank changes
    const originalRanks = new Map<string, number>();
    results.forEach((result, index) => {
      const key = `${result.documentId}_${result.chunkIndex}`;
      originalRanks.set(key, index);
    });

    reranked.forEach((result, newIndex) => {
      const key = `${result.documentId}_${result.chunkIndex}`;
      const originalIndex = originalRanks.get(key) ?? newIndex;
      result.rankChange = originalIndex - newIndex; // Positive = moved up, negative = moved down
    });

    return reranked;
  }

  /**
   * Re-rank using cross-encoder model
   * This is a placeholder for actual cross-encoder integration
   * In production, this would call a cross-encoder API or local model
   */
  private static async rerankWithCrossEncoder(
    query: string,
    results: DocumentContext[],
    config: RerankingConfig
  ): Promise<RerankedResult[]> {
    // TODO: Integrate actual cross-encoder model
    // Options:
    // 1. Use API service (Cohere, Jina, etc.)
    // 2. Use Python microservice with sentence-transformers
    // 3. Use @xenova/transformers for Node.js (if available)
    
    logger.warn('Cross-encoder re-ranking not yet implemented, falling back to score-based', {
      query: query.substring(0, 100),
      resultsCount: results.length,
    });

    // Fallback to score-based for now
    return this.rerankWithScoreBased(query, results, config);
  }

  /**
   * Re-rank using hybrid approach (combine cross-encoder and score-based)
   */
  private static async rerankWithHybrid(
    query: string,
    results: DocumentContext[],
    config: RerankingConfig
  ): Promise<RerankedResult[]> {
    // Run both strategies and combine scores
    const [crossEncoderResults, scoreBasedResults] = await Promise.all([
      this.rerankWithCrossEncoder(query, results, config).catch(() => null),
      this.rerankWithScoreBased(query, results, config),
    ]);

    // If cross-encoder failed, use score-based
    if (!crossEncoderResults) {
      return scoreBasedResults;
    }

    // Combine scores (70% cross-encoder, 30% score-based)
    const combined = results.map((result, index) => {
      const key = `${result.documentId}_${result.chunkIndex}`;
      const crossEncoderResult = crossEncoderResults.find(
        r => `${r.documentId}_${r.chunkIndex}` === key
      );
      const scoreBasedResult = scoreBasedResults.find(
        r => `${r.documentId}_${r.chunkIndex}` === key
      );

      const crossEncoderScore = crossEncoderResult?.rerankedScore || 0;
      const scoreBasedScore = scoreBasedResult?.rerankedScore || 0;

      const combinedScore = crossEncoderScore * 0.7 + scoreBasedScore * 0.3;

      return {
        ...result,
        originalScore: result.score,
        rerankedScore: combinedScore,
        rankChange: 0,
      };
    });

    // Sort by combined score
    combined.sort((a, b) => b.rerankedScore - a.rerankedScore);

    // Calculate rank changes
    const originalRanks = new Map<string, number>();
    results.forEach((result, index) => {
      const key = `${result.documentId}_${result.chunkIndex}`;
      originalRanks.set(key, index);
    });

    combined.forEach((result, newIndex) => {
      const key = `${result.documentId}_${result.chunkIndex}`;
      const originalIndex = originalRanks.get(key) ?? newIndex;
      result.rankChange = originalIndex - newIndex;
    });

    return combined;
  }

  /**
   * Re-rank search results
   */
  static async rerank(
    options: RerankingOptions
  ): Promise<RerankedResult[]> {
    const config = getRerankingConfig();
    const strategy = options.strategy || config.strategy;
    const topK = options.topK || config.topK;
    const maxResults = options.maxResults || config.maxResults;
    const minScore = options.minScore ?? config.minScore ?? 0;

    // Take top-K results to re-rank
    const resultsToRerank = options.results.slice(0, topK);

    if (resultsToRerank.length === 0) {
      return [];
    }

    logger.info('Re-ranking search results', {
      query: options.query.substring(0, 100),
      strategy,
      inputCount: resultsToRerank.length,
      topK,
      maxResults,
    });

    let reranked: RerankedResult[];

    switch (strategy) {
      case 'cross-encoder':
        reranked = await this.rerankWithCrossEncoder(options.query, resultsToRerank, config);
        break;
      case 'hybrid':
        reranked = await this.rerankWithHybrid(options.query, resultsToRerank, config);
        break;
      case 'score-based':
        reranked = this.rerankWithScoreBased(options.query, resultsToRerank, config);
        break;
      case 'none':
      default:
        // No re-ranking, just convert to RerankedResult format
        reranked = resultsToRerank.map((result, index) => ({
          ...result,
          originalScore: result.score,
          rerankedScore: result.score,
          rankChange: 0,
        }));
        break;
    }

    // Apply minScore filter
    if (minScore > 0) {
      reranked = reranked.filter(r => r.rerankedScore >= minScore);
    }

    // Limit to maxResults
    reranked = reranked.slice(0, maxResults);

    logger.info('Re-ranking completed', {
      query: options.query.substring(0, 100),
      inputCount: resultsToRerank.length,
      outputCount: reranked.length,
      strategy,
    });

    return reranked;
  }

  /**
   * Calculate precision improvement metrics
   */
  static calculatePrecisionMetrics(
    originalResults: DocumentContext[],
    rerankedResults: RerankedResult[]
  ): {
    originalPrecision: number; // Average score of top results
    rerankedPrecision: number; // Average score of top results after re-ranking
    improvement: number; // Percentage improvement
    averageRankChange: number; // Average change in rank
  } {
    const topN = Math.min(5, originalResults.length, rerankedResults.length);
    
    const originalTopN = originalResults.slice(0, topN);
    const rerankedTopN = rerankedResults.slice(0, topN);

    const originalPrecision = originalTopN.length > 0
      ? originalTopN.reduce((sum, r) => sum + r.score, 0) / originalTopN.length
      : 0;

    const rerankedPrecision = rerankedTopN.length > 0
      ? rerankedTopN.reduce((sum, r) => sum + r.rerankedScore, 0) / rerankedTopN.length
      : 0;

    const improvement = originalPrecision > 0
      ? ((rerankedPrecision - originalPrecision) / originalPrecision) * 100
      : 0;

    const averageRankChange = rerankedResults.length > 0
      ? rerankedResults.reduce((sum, r) => sum + Math.abs(r.rankChange), 0) / rerankedResults.length
      : 0;

    return {
      originalPrecision,
      rerankedPrecision,
      improvement,
      averageRankChange,
    };
  }
}
