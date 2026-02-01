/**
 * Web Deduplication Service
 * Detects and removes duplicate web search results (same URL, similar content)
 * Optimized for performance (<150ms target)
 */

import logger from '../config/logger';
import { SearchResult } from './search.service';
import * as crypto from 'crypto';

export interface WebDeduplicationConfig {
  enabled: boolean; // Enable deduplication
  urlExactMatch: boolean; // Remove results with exact same URL (default: true)
  contentSimilarityThreshold: number; // Threshold for content similarity (0.85 = 85% similar, default: 0.85)
  titleSimilarityThreshold: number; // Threshold for title similarity (0.90 = 90% similar, default: 0.90)
  preserveHighestScore: boolean; // Keep result with highest score when duplicates found (default: true)
  useContentHash: boolean; // Use content hash for fast exact duplicate detection (default: true)
  useJaccardSimilarity: boolean; // Use Jaccard similarity for content matching (default: true)
  useTitleMatching: boolean; // Consider title similarity in deduplication (default: true)
  maxProcessingTimeMs: number; // Maximum processing time in milliseconds (default: 150)
}

export interface WebDeduplicationOptions {
  urlExactMatch?: boolean;
  contentSimilarityThreshold?: number;
  titleSimilarityThreshold?: number;
  preserveHighestScore?: boolean;
  useContentHash?: boolean;
  useJaccardSimilarity?: boolean;
  useTitleMatching?: boolean;
  maxProcessingTimeMs?: number;
}

export interface DeduplicatedResult extends SearchResult {
  isDuplicate?: boolean; // Whether this result was identified as duplicate
  duplicateOf?: string; // URL of the result this duplicates (if applicable)
  similarity?: number; // Similarity score to duplicate (if applicable)
}

export interface WebDeduplicationStats {
  originalCount: number;
  deduplicatedCount: number;
  urlDuplicatesRemoved: number;
  contentDuplicatesRemoved: number;
  totalRemoved: number;
  processingTimeMs: number;
  performanceWarning?: boolean; // True if processing exceeded target time
}

/**
 * Default web deduplication configuration
 */
export const DEFAULT_WEB_DEDUPLICATION_CONFIG: WebDeduplicationConfig = {
  enabled: true,
  urlExactMatch: true,
  contentSimilarityThreshold: 0.85, // 85% similar content
  titleSimilarityThreshold: 0.90, // 90% similar title
  preserveHighestScore: true,
  useContentHash: true,
  useJaccardSimilarity: true,
  useTitleMatching: true,
  maxProcessingTimeMs: 150, // Target: <150ms
};

/**
 * Web Deduplication Service
 * Optimized for fast duplicate detection in web search results
 */
export class WebDeduplicationService {
  private static config: WebDeduplicationConfig = DEFAULT_WEB_DEDUPLICATION_CONFIG;

  /**
   * Set deduplication configuration
   */
  static setConfig(config: Partial<WebDeduplicationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Web deduplication configuration updated', { config: this.config });
  }

  /**
   * Get current deduplication configuration
   */
  static getConfig(): WebDeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Normalize URL for comparison (remove protocol, www, trailing slash, etc.)
   */
  private static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      normalized += urlObj.pathname.toLowerCase().replace(/\/$/, '');
      normalized += urlObj.search.toLowerCase();
      return normalized;
    } catch (e) {
      // If URL parsing fails, do simple normalization
      return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    }
  }

  /**
   * Generate content hash for fast exact duplicate detection
   */
  private static generateContentHash(content: string): string {
    const normalized = content.toLowerCase().trim();
    // Use crypto for better hash distribution
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Calculate Jaccard similarity between two texts (word-based)
   * Fast and efficient for large texts
   */
  private static calculateJaccardSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) {
      return 0.0;
    }

    // Normalize and tokenize
    const words1 = new Set(
      text1
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2) // Filter out very short words
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
    );

    if (words1.size === 0 && words2.size === 0) {
      return 1.0; // Both empty, consider identical
    }

    if (words1.size === 0 || words2.size === 0) {
      return 0.0; // One empty, no similarity
    }

    // Calculate intersection and union
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity between two texts (using word frequency vectors)
   * More accurate but slightly slower than Jaccard
   */
  private static calculateCosineSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) {
      return 0.0;
    }

    // Tokenize and count word frequencies
    const tokenize = (text: string): Map<string, number> => {
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      const freq = new Map<string, number>();
      for (const word of words) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
      return freq;
    };

    const freq1 = tokenize(text1);
    const freq2 = tokenize(text2);

    if (freq1.size === 0 || freq2.size === 0) {
      return 0.0;
    }

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Get all unique words
    const allWords = new Set([...freq1.keys(), ...freq2.keys()]);

    for (const word of allWords) {
      const count1 = freq1.get(word) || 0;
      const count2 = freq2.get(word) || 0;
      dotProduct += count1 * count2;
      magnitude1 += count1 * count1;
      magnitude2 += count2 * count2;
    }

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0.0;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Calculate similarity between two search results
   */
  private static calculateResultSimilarity(
    result1: SearchResult,
    result2: SearchResult,
    config: WebDeduplicationConfig
  ): number {
    // Check URL similarity first (fast)
    const url1 = this.normalizeUrl(result1.url);
    const url2 = this.normalizeUrl(result2.url);
    
    if (url1 === url2) {
      return 1.0; // Exact URL match
    }

    // Calculate content similarity
    let contentSimilarity = 0.0;
    if (config.useJaccardSimilarity) {
      contentSimilarity = this.calculateJaccardSimilarity(result1.content, result2.content);
    } else {
      contentSimilarity = this.calculateCosineSimilarity(result1.content, result2.content);
    }

    // Calculate title similarity if enabled
    let titleSimilarity = 0.0;
    if (config.useTitleMatching && result1.title && result2.title) {
      titleSimilarity = this.calculateJaccardSimilarity(result1.title, result2.title);
    }

    // Combine similarities (weighted average)
    if (config.useTitleMatching && titleSimilarity > 0) {
      // Title similarity is more important (60% weight)
      return contentSimilarity * 0.4 + titleSimilarity * 0.6;
    }

    return contentSimilarity;
  }

  /**
   * Remove exact URL duplicates (fast)
   */
  private static removeUrlDuplicates(
    results: SearchResult[],
    preserveHighestScore: boolean
  ): { results: SearchResult[]; removed: number } {
    const urlMap = new Map<string, SearchResult>();
    let removed = 0;

    for (const result of results) {
      const normalizedUrl = this.normalizeUrl(result.url);
      
      if (urlMap.has(normalizedUrl)) {
        removed++;
        const existing = urlMap.get(normalizedUrl)!;
        
        // Keep result with higher score
        if (preserveHighestScore) {
          const existingScore = existing.score || 0;
          const currentScore = result.score || 0;
          
          if (currentScore > existingScore) {
            urlMap.set(normalizedUrl, result);
          }
        }
        // Otherwise, keep first occurrence
      } else {
        urlMap.set(normalizedUrl, result);
      }
    }

    return {
      results: Array.from(urlMap.values()),
      removed,
    };
  }

  /**
   * Remove content-based duplicates using hash (very fast)
   */
  private static removeContentHashDuplicates(
    results: SearchResult[],
    preserveHighestScore: boolean
  ): { results: SearchResult[]; removed: number } {
    const hashMap = new Map<string, SearchResult>();
    let removed = 0;

    for (const result of results) {
      const hash = this.generateContentHash(result.content);
      
      if (hashMap.has(hash)) {
        removed++;
        const existing = hashMap.get(hash)!;
        
        // Keep result with higher score
        if (preserveHighestScore) {
          const existingScore = existing.score || 0;
          const currentScore = result.score || 0;
          
          if (currentScore > existingScore) {
            hashMap.set(hash, result);
          }
        }
      } else {
        hashMap.set(hash, result);
      }
    }

    return {
      results: Array.from(hashMap.values()),
      removed,
    };
  }

  /**
   * Remove similar content duplicates (slower but more accurate)
   * Optimized with early termination for performance
   */
  private static removeSimilarContentDuplicates(
    results: SearchResult[],
    threshold: number,
    config: WebDeduplicationConfig,
    startTime: number,
    maxTimeMs: number
  ): { results: SearchResult[]; removed: number } {
    if (results.length === 0) {
      return { results: [], removed: 0 };
    }

    const deduplicated: SearchResult[] = [];
    const seen = new Set<string>();
    let removed = 0;

    for (let i = 0; i < results.length; i++) {
      // Check time limit
      if (Date.now() - startTime > maxTimeMs) {
        logger.warn('Deduplication time limit reached, stopping early', {
          processed: i,
          total: results.length,
          elapsed: Date.now() - startTime,
        });
        // Add remaining results
        deduplicated.push(...results.slice(i));
        break;
      }

      const result = results[i];
      const normalizedUrl = this.normalizeUrl(result.url);
      
      if (seen.has(normalizedUrl)) {
        continue; // Already processed as URL duplicate
      }

      let isDuplicate = false;
      let bestMatch: SearchResult | null = null;
      let bestSimilarity = 0;

      // Check similarity with existing results (optimized: only check top N)
      const checkLimit = Math.min(deduplicated.length, 20); // Limit comparisons for performance
      for (let j = 0; j < checkLimit; j++) {
        const existing = deduplicated[j];
        const similarity = this.calculateResultSimilarity(result, existing, config);
        
        if (similarity >= threshold) {
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = existing;
          }
          isDuplicate = true;
        }
      }

      if (isDuplicate && bestMatch) {
        removed++;
        // Keep result with higher score
        if (config.preserveHighestScore) {
          const existingScore = bestMatch.score || 0;
          const currentScore = result.score || 0;
          
          if (currentScore > existingScore) {
            const index = deduplicated.indexOf(bestMatch);
            deduplicated[index] = result;
          }
        }
      } else {
        deduplicated.push(result);
        seen.add(normalizedUrl);
      }
    }

    return { results: deduplicated, removed };
  }

  /**
   * Deduplicate web search results
   * Removes exact URL duplicates and similar content duplicates
   */
  static deduplicate(
    results: SearchResult[],
    options: WebDeduplicationOptions = {}
  ): {
    results: SearchResult[];
    stats: WebDeduplicationStats;
  } {
    const startTime = Date.now();
    const config = { ...this.config, ...options };

    if (!config.enabled || results.length === 0) {
      return {
        results: results.map(r => ({ ...r })),
        stats: {
          originalCount: results.length,
          deduplicatedCount: results.length,
          urlDuplicatesRemoved: 0,
          contentDuplicatesRemoved: 0,
          totalRemoved: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    if (results.length === 1) {
      return {
        results: results.map(r => ({ ...r })),
        stats: {
          originalCount: 1,
          deduplicatedCount: 1,
          urlDuplicatesRemoved: 0,
          contentDuplicatesRemoved: 0,
          totalRemoved: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    let deduplicated: SearchResult[] = [...results];
    let urlDuplicatesRemoved = 0;
    let contentDuplicatesRemoved = 0;

    // Step 1: Remove exact URL duplicates (very fast, O(n))
    if (config.urlExactMatch) {
      const urlResult = this.removeUrlDuplicates(deduplicated, config.preserveHighestScore);
      deduplicated = urlResult.results;
      urlDuplicatesRemoved = urlResult.removed;
    }

    // Step 2: Remove exact content duplicates using hash (very fast, O(n))
    if (config.useContentHash && deduplicated.length > 1) {
      const hashResult = this.removeContentHashDuplicates(deduplicated, config.preserveHighestScore);
      contentDuplicatesRemoved += hashResult.removed - urlDuplicatesRemoved; // Don't double count
      deduplicated = hashResult.results;
    }

    // Step 3: Remove similar content duplicates (slower, but optimized)
    if (deduplicated.length > 1 && config.contentSimilarityThreshold < 1.0) {
      const remainingTime = config.maxProcessingTimeMs - (Date.now() - startTime);
      if (remainingTime > 10) { // Only if we have time left
        const similarResult = this.removeSimilarContentDuplicates(
          deduplicated,
          config.contentSimilarityThreshold,
          config,
          startTime,
          remainingTime
        );
        contentDuplicatesRemoved += similarResult.removed;
        deduplicated = similarResult.results;
      } else {
        logger.warn('Skipping similarity deduplication due to time constraints', {
          elapsed: Date.now() - startTime,
          maxTime: config.maxProcessingTimeMs,
        });
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const totalRemoved = urlDuplicatesRemoved + contentDuplicatesRemoved;
    const performanceWarning = processingTimeMs > config.maxProcessingTimeMs;

    if (performanceWarning) {
      logger.warn('Deduplication exceeded target time', {
        processingTimeMs,
        maxTime: config.maxProcessingTimeMs,
        originalCount: results.length,
        deduplicatedCount: deduplicated.length,
      });
    }

    logger.debug('Web deduplication completed', {
      originalCount: results.length,
      deduplicatedCount: deduplicated.length,
      urlDuplicatesRemoved,
      contentDuplicatesRemoved,
      totalRemoved,
      processingTimeMs,
      performanceWarning,
    });

    return {
      results: deduplicated,
      stats: {
        originalCount: results.length,
        deduplicatedCount: deduplicated.length,
        urlDuplicatesRemoved,
        contentDuplicatesRemoved,
        totalRemoved,
        processingTimeMs,
        performanceWarning,
      },
    };
  }

  /**
   * Quick deduplicate (fastest version, URL + hash only)
   * For use when performance is critical
   */
  static quickDeduplicate(
    results: SearchResult[],
    preserveHighestScore: boolean = true
  ): SearchResult[] {
    if (results.length === 0) {
      return [];
    }

    // Remove URL duplicates
    const urlResult = this.removeUrlDuplicates(results, preserveHighestScore);
    
    // Remove content hash duplicates
    const hashResult = this.removeContentHashDuplicates(urlResult.results, preserveHighestScore);
    
    return hashResult.results;
  }

  /**
   * Check if two results are duplicates
   */
  static areDuplicates(
    result1: SearchResult,
    result2: SearchResult,
    config: Partial<WebDeduplicationConfig> = {}
  ): { isDuplicate: boolean; similarity: number; reason: 'url' | 'content' | 'none' } {
    const fullConfig = { ...this.config, ...config };

    // Check URL match
    const url1 = this.normalizeUrl(result1.url);
    const url2 = this.normalizeUrl(result2.url);
    
    if (url1 === url2) {
      return { isDuplicate: true, similarity: 1.0, reason: 'url' };
    }

    // Check content similarity
    const similarity = this.calculateResultSimilarity(result1, result2, fullConfig);
    const isDuplicate = similarity >= fullConfig.contentSimilarityThreshold;

    return {
      isDuplicate,
      similarity,
      reason: isDuplicate ? 'content' : 'none',
    };
  }
}
