/**
 * Hybrid Search Service
 * Combines semantic and keyword search results with weighted scoring
 * Implements result deduplication and merging
 */

import { DocumentContext } from './rag.service';
import { KeywordSearchResult } from './keyword-search.service';
import {
  HybridSearchWeights,
  normalizeWeights,
  validateWeights,
  getHybridSearchConfig,
  selectABTestVariant,
  getABTestConfig,
} from '../config/search.config';
import logger from '../config/logger';

export interface HybridSearchResult extends DocumentContext {
  semanticScore?: number; // Original semantic score
  keywordScore?: number; // Original keyword score
  combinedScore: number; // Weighted combined score
  source: 'semantic' | 'keyword' | 'both'; // Source of the result
}

export interface HybridSearchOptions {
  userId: string;
  topicId?: string;
  documentIds?: string[];
  maxResults?: number;
  minScore?: number;
  weights?: HybridSearchWeights; // Override default weights
  useABTesting?: boolean; // Use A/B testing for weight selection
  enableDeduplication?: boolean; // Enable result deduplication
}

/**
 * Hybrid Search Service
 * Combines semantic and keyword search results
 */
export class HybridSearchService {
  /**
   * Calculate similarity between two text chunks
   * Simple Jaccard similarity based on word overlap
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) {
      return 0;
    }
    
    return intersection.size / union.size;
  }

  /**
   * Normalize scores to 0-1 range for fair combination
   */
  private static normalizeScores(
    semanticResults: DocumentContext[],
    keywordResults: KeywordSearchResult[]
  ): {
    semantic: Array<{ result: DocumentContext; normalizedScore: number }>;
    keyword: Array<{ result: KeywordSearchResult; normalizedScore: number }>;
  } {
    // Find max scores for normalization
    const maxSemanticScore = semanticResults.length > 0
      ? Math.max(...semanticResults.map(r => r.score))
      : 1;
    const maxKeywordScore = keywordResults.length > 0
      ? Math.max(...keywordResults.map(r => r.score))
      : 1;

    // Normalize to 0-1 range
    const normalizedSemantic = semanticResults.map(result => ({
      result,
      normalizedScore: maxSemanticScore > 0 ? result.score / maxSemanticScore : 0,
    }));

    const normalizedKeyword = keywordResults.map(result => ({
      result,
      normalizedScore: maxKeywordScore > 0 ? result.score / maxKeywordScore : 0,
    }));

    return { semantic: normalizedSemantic, keyword: normalizedKeyword };
  }

  /**
   * Deduplicate results based on content similarity
   */
  private static deduplicateResults(
    results: HybridSearchResult[],
    threshold: number = 0.85
  ): HybridSearchResult[] {
    if (results.length === 0) {
      return [];
    }

    const deduplicated: HybridSearchResult[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      // Check if we've seen a similar result
      let isDuplicate = false;
      const resultKey = `${result.documentId}_${result.chunkIndex}`;
      
      if (seen.has(resultKey)) {
        continue; // Exact duplicate (same document and chunk)
      }

      // Check similarity with existing results
      for (const existing of deduplicated) {
        const similarity = this.calculateSimilarity(result.content, existing.content);
        if (similarity >= threshold) {
          // Keep the result with higher score
          if (result.combinedScore > existing.combinedScore) {
            const index = deduplicated.indexOf(existing);
            deduplicated[index] = result;
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(result);
        seen.add(resultKey);
      }
    }

    return deduplicated;
  }

  /**
   * Merge semantic and keyword search results
   */
  static mergeResults(
    semanticResults: DocumentContext[],
    keywordResults: KeywordSearchResult[],
    weights: HybridSearchWeights,
    options: HybridSearchOptions
  ): HybridSearchResult[] {
    // Validate and normalize weights
    if (!validateWeights(weights)) {
      logger.warn('Invalid weights provided, using defaults', { weights });
      weights = normalizeWeights(weights);
    } else {
      weights = normalizeWeights(weights);
    }

    // Normalize scores to 0-1 range
    const { semantic: normalizedSemantic, keyword: normalizedKeyword } =
      this.normalizeScores(semanticResults, keywordResults);

    // Create a map to combine results by documentId and chunkIndex
    const resultMap = new Map<string, HybridSearchResult>();

    // Add semantic results
    for (const { result, normalizedScore } of normalizedSemantic) {
      const key = `${result.documentId}_${result.chunkIndex}`;
      const combinedScore = normalizedScore * weights.semantic;

      resultMap.set(key, {
        ...result,
        semanticScore: result.score,
        combinedScore,
        source: 'semantic',
      });
    }

    // Add or merge keyword results
    for (const { result, normalizedScore } of normalizedKeyword) {
      const key = `${result.documentId}_${result.chunkIndex}`;
      const keywordScore = normalizedScore * weights.keyword;

      const existing = resultMap.get(key);
      if (existing) {
        // Merge: combine scores and mark as 'both'
        existing.keywordScore = result.score;
        existing.combinedScore = existing.combinedScore + keywordScore;
        existing.source = 'both';
      } else {
        // Add new result
        resultMap.set(key, {
          documentId: result.documentId,
          documentName: result.documentName || 'Unknown Document',
          chunkIndex: result.chunkIndex,
          content: result.content,
          score: result.score, // Keep original score for reference
          keywordScore: result.score,
          combinedScore: keywordScore,
          source: 'keyword',
        });
      }
    }

    // Convert to array and sort by combined score
    let mergedResults = Array.from(resultMap.values());
    mergedResults.sort((a, b) => b.combinedScore - a.combinedScore);

    // Apply deduplication if enabled
    const config = getHybridSearchConfig();
    const enableDeduplication = options.enableDeduplication ?? config.enableDeduplication;
    
    if (enableDeduplication) {
      mergedResults = this.deduplicateResults(mergedResults, config.deduplicationThreshold);
    }

    // Apply filters
    const minScore = options.minScore ?? config.minScoreThreshold;
    const maxResults = options.maxResults ?? config.maxResults;

    mergedResults = mergedResults.filter(r => r.combinedScore >= minScore);
    mergedResults = mergedResults.slice(0, maxResults);

    logger.info('Hybrid search results merged', {
      semanticCount: semanticResults.length,
      keywordCount: keywordResults.length,
      mergedCount: mergedResults.length,
      weights,
      deduplicationEnabled: enableDeduplication,
    });

    return mergedResults;
  }

  /**
   * Get weights for hybrid search (with A/B testing support)
   */
  static getWeights(
    userId: string,
    options: HybridSearchOptions
  ): HybridSearchWeights {
    // Use provided weights if available
    if (options.weights) {
      return normalizeWeights(options.weights);
    }

    // Use A/B testing if enabled
    const useABTesting = options.useABTesting ?? getABTestConfig().enabled;
    if (useABTesting) {
      const abWeights = selectABTestVariant(userId, getABTestConfig());
      logger.debug('A/B test variant selected', {
        userId,
        weights: abWeights,
      });
      return abWeights;
    }

    // Use default weights from config
    const config = getHybridSearchConfig();
    return config.defaultWeights;
  }

  /**
   * Perform hybrid search (combines semantic and keyword results)
   */
  static async performHybridSearch(
    semanticResults: DocumentContext[],
    keywordResults: KeywordSearchResult[],
    options: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    // Get weights (with A/B testing support)
    const weights = this.getWeights(options.userId, options);

    // Merge results
    const mergedResults = this.mergeResults(
      semanticResults,
      keywordResults,
      weights,
      options
    );

    return mergedResults;
  }

  /**
   * Calculate precision improvement metrics
   * Compares hybrid search results to individual search types
   */
  static calculatePrecisionMetrics(
    semanticResults: DocumentContext[],
    keywordResults: KeywordSearchResult[],
    hybridResults: HybridSearchResult[]
  ): {
    semanticPrecision: number;
    keywordPrecision: number;
    hybridPrecision: number;
    improvement: {
      vsSemantic: number; // Percentage improvement vs semantic
      vsKeyword: number; // Percentage improvement vs keyword
    };
  } {
    // Simple precision metric: average score of top results
    const semanticPrecision = semanticResults.length > 0
      ? semanticResults.reduce((sum, r) => sum + r.score, 0) / semanticResults.length
      : 0;
    
    const keywordPrecision = keywordResults.length > 0
      ? keywordResults.reduce((sum, r) => sum + r.score, 0) / keywordResults.length
      : 0;
    
    const hybridPrecision = hybridResults.length > 0
      ? hybridResults.reduce((sum, r) => sum + r.combinedScore, 0) / hybridResults.length
      : 0;

    const improvement = {
      vsSemantic: semanticPrecision > 0
        ? ((hybridPrecision - semanticPrecision) / semanticPrecision) * 100
        : 0,
      vsKeyword: keywordPrecision > 0
        ? ((hybridPrecision - keywordPrecision) / keywordPrecision) * 100
        : 0,
    };

    return {
      semanticPrecision,
      keywordPrecision,
      hybridPrecision,
      improvement,
    };
  }
}
