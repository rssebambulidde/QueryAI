/**
 * Deduplication Service
 * Detects and removes duplicate or highly similar document chunks
 * Supports exact duplicates, near-duplicates, and similarity-based deduplication
 */

import { DocumentContext } from './rag.service';
import logger from '../config/logger';

export interface DeduplicationConfig {
  enabled: boolean; // Enable deduplication
  exactDuplicateThreshold: number; // Threshold for exact duplicates (1.0 = exact match)
  nearDuplicateThreshold: number; // Threshold for near-duplicates (0.95 = 95% similar)
  similarityThreshold: number; // Threshold for similarity-based deduplication (0.85 = 85% similar)
  useContentHash: boolean; // Use content hash for fast exact duplicate detection
  useFuzzyMatching: boolean; // Use fuzzy matching for near-duplicates
  preserveHighestScore: boolean; // Keep result with highest score when duplicates found
}

export interface DeduplicationOptions {
  exactDuplicateThreshold?: number;
  nearDuplicateThreshold?: number;
  similarityThreshold?: number;
  useContentHash?: boolean;
  useFuzzyMatching?: boolean;
  preserveHighestScore?: boolean;
}

export interface DeduplicationResult extends DocumentContext {
  isDuplicate?: boolean; // Whether this result was identified as duplicate
  duplicateOf?: string; // ID of the result this duplicates (if applicable)
  similarity?: number; // Similarity score to duplicate (if applicable)
}

export interface DeduplicationStats {
  originalCount: number;
  deduplicatedCount: number;
  exactDuplicatesRemoved: number;
  nearDuplicatesRemoved: number;
  similarityDuplicatesRemoved: number;
  totalRemoved: number;
  processingTimeMs: number;
}

/**
 * Default deduplication configuration
 */
export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  enabled: true,
  exactDuplicateThreshold: 1.0, // Exact match
  nearDuplicateThreshold: 0.95, // 95% similar
  similarityThreshold: 0.85, // 85% similar
  useContentHash: true, // Fast exact duplicate detection
  useFuzzyMatching: true, // Better near-duplicate detection
  preserveHighestScore: true, // Keep highest scoring duplicate
};

/**
 * Deduplication Service
 * Detects and removes duplicate or highly similar results
 */
export class DeduplicationService {
  private static config: DeduplicationConfig = DEFAULT_DEDUPLICATION_CONFIG;

  /**
   * Set deduplication configuration
   */
  static setConfig(config: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Deduplication configuration updated', { config: this.config });
  }

  /**
   * Get current deduplication configuration
   */
  static getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Generate content hash for fast exact duplicate detection
   */
  private static generateContentHash(content: string): string {
    // Simple hash function (can be replaced with crypto hash for production)
    let hash = 0;
    const normalized = content.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Calculate Jaccard similarity between two texts
   */
  private static calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 0));

    if (words1.size === 0 && words2.size === 0) {
      return 1.0; // Both empty, consider identical
    }

    if (words1.size === 0 || words2.size === 0) {
      return 0.0; // One empty, no similarity
    }

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate character-level similarity (for near-duplicates)
   */
  private static calculateCharacterSimilarity(text1: string, text2: string): number {
    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();

    if (normalized1 === normalized2) {
      return 1.0;
    }

    if (normalized1.length === 0 || normalized2.length === 0) {
      return 0.0;
    }

    // Calculate longest common subsequence ratio
    const lcs = this.longestCommonSubsequence(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    return lcs / maxLength;
  }

  /**
   * Calculate longest common subsequence length
   */
  private static longestCommonSubsequence(text1: string, text2: string): number {
    const m = text1.length;
    const n = text2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (text1[i - 1] === text2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate similarity between two documents
   */
  private static calculateSimilarity(
    doc1: DocumentContext,
    doc2: DocumentContext,
    useFuzzy: boolean
  ): number {
    // Check if same document and chunk (exact duplicate)
    if (doc1.documentId === doc2.documentId && doc1.chunkIndex === doc2.chunkIndex) {
      return 1.0;
    }

    // Use character-level similarity for near-duplicates if fuzzy matching enabled
    if (useFuzzy) {
      const charSimilarity = this.calculateCharacterSimilarity(doc1.content, doc2.content);
      const wordSimilarity = this.calculateJaccardSimilarity(doc1.content, doc2.content);
      // Combine both metrics (weighted average)
      return (charSimilarity * 0.6 + wordSimilarity * 0.4);
    }

    // Use word-based Jaccard similarity
    return this.calculateJaccardSimilarity(doc1.content, doc2.content);
  }

  /**
   * Detect exact duplicates using content hash
   */
  private static detectExactDuplicates(
    results: DocumentContext[],
    threshold: number
  ): Map<string, DocumentContext> {
    const uniqueResults = new Map<string, DocumentContext>();
    const hashMap = new Map<string, string>(); // hash -> result key

    for (const result of results) {
      const hash = this.generateContentHash(result.content);
      const resultKey = `${result.documentId}_${result.chunkIndex}`;

      if (hashMap.has(hash)) {
        // Potential exact duplicate found
        const existingKey = hashMap.get(hash)!;
        const existing = uniqueResults.get(existingKey)!;

        // Verify exact match (hash collision possible)
        const similarity = this.calculateCharacterSimilarity(result.content, existing.content);
        
        if (similarity >= threshold) {
          // Exact duplicate - keep highest score
          if (this.config.preserveHighestScore && result.score > existing.score) {
            uniqueResults.delete(existingKey);
            uniqueResults.set(resultKey, result);
            hashMap.set(hash, resultKey);
          }
          // Otherwise, keep existing (first one or higher score)
        } else {
          // Hash collision but not duplicate - add both
          uniqueResults.set(resultKey, result);
          // Note: hash collision means we can't use hash for this case
        }
      } else {
        // New unique result
        uniqueResults.set(resultKey, result);
        hashMap.set(hash, resultKey);
      }
    }

    return uniqueResults;
  }

  /**
   * Deduplicate results using similarity-based detection
   */
  private static deduplicateBySimilarity(
    results: DocumentContext[],
    threshold: number,
    useFuzzy: boolean
  ): DocumentContext[] {
    if (results.length === 0) {
      return [];
    }

    const deduplicated: DocumentContext[] = [];
    const seen = new Set<string>(); // Track seen document-chunk pairs

    for (const result of results) {
      const resultKey = `${result.documentId}_${result.chunkIndex}`;
      
      // Skip if exact duplicate (same document and chunk)
      if (seen.has(resultKey)) {
        continue;
      }

      let isDuplicate = false;
      let bestMatch: DocumentContext | null = null;
      let bestSimilarity = 0;

      // Check similarity with existing results
      for (const existing of deduplicated) {
        const similarity = this.calculateSimilarity(result, existing, useFuzzy);
        
        if (similarity >= threshold) {
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = existing;
          }
          isDuplicate = true;
        }
      }

      if (isDuplicate && bestMatch) {
        // Keep result with higher score
        if (this.config.preserveHighestScore && result.score > bestMatch.score) {
          const index = deduplicated.indexOf(bestMatch);
          deduplicated[index] = result;
        }
        // Otherwise, keep existing (first one or higher score)
      } else {
        // Not a duplicate, add to results
        deduplicated.push(result);
        seen.add(resultKey);
      }
    }

    return deduplicated;
  }

  /**
   * Deduplicate results
   * Removes exact duplicates, near-duplicates, and highly similar results
   */
  static deduplicate(
    results: DocumentContext[],
    options: DeduplicationOptions = {}
  ): {
    results: DocumentContext[];
    stats: DeduplicationStats;
  } {
    const startTime = Date.now();
    const config = { ...this.config, ...options };

    if (!config.enabled || results.length === 0) {
      return {
        results: results.map(r => ({ ...r })),
        stats: {
          originalCount: results.length,
          deduplicatedCount: results.length,
          exactDuplicatesRemoved: 0,
          nearDuplicatesRemoved: 0,
          similarityDuplicatesRemoved: 0,
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
          exactDuplicatesRemoved: 0,
          nearDuplicatesRemoved: 0,
          similarityDuplicatesRemoved: 0,
          totalRemoved: 0,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    let deduplicated: DocumentContext[] = [...results];
    let exactDuplicatesRemoved = 0;
    let nearDuplicatesRemoved = 0;
    let similarityDuplicatesRemoved = 0;

    // Step 1: Remove exact duplicates using content hash (fast)
    if (config.useContentHash) {
      const beforeExact = deduplicated.length;
      const uniqueByHash = this.detectExactDuplicates(deduplicated, config.exactDuplicateThreshold);
      deduplicated = Array.from(uniqueByHash.values());
      exactDuplicatesRemoved = beforeExact - deduplicated.length;
    }

    // Step 2: Remove near-duplicates (95%+ similar)
    if (config.nearDuplicateThreshold < 1.0) {
      const beforeNear = deduplicated.length;
      deduplicated = this.deduplicateBySimilarity(
        deduplicated,
        config.nearDuplicateThreshold,
        config.useFuzzyMatching
      );
      nearDuplicatesRemoved = beforeNear - deduplicated.length;
    }

    // Step 3: Remove similarity-based duplicates (85%+ similar)
    if (config.similarityThreshold < config.nearDuplicateThreshold) {
      const beforeSimilarity = deduplicated.length;
      deduplicated = this.deduplicateBySimilarity(
        deduplicated,
        config.similarityThreshold,
        config.useFuzzyMatching
      );
      similarityDuplicatesRemoved = beforeSimilarity - deduplicated.length;
    }

    const processingTimeMs = Date.now() - startTime;
    const totalRemoved = exactDuplicatesRemoved + nearDuplicatesRemoved + similarityDuplicatesRemoved;

    logger.debug('Deduplication completed', {
      originalCount: results.length,
      deduplicatedCount: deduplicated.length,
      exactDuplicatesRemoved,
      nearDuplicatesRemoved,
      similarityDuplicatesRemoved,
      totalRemoved,
      processingTimeMs,
    });

    return {
      results: deduplicated,
      stats: {
        originalCount: results.length,
        deduplicatedCount: deduplicated.length,
        exactDuplicatesRemoved,
        nearDuplicatesRemoved,
        similarityDuplicatesRemoved,
        totalRemoved,
        processingTimeMs,
      },
    };
  }

  /**
   * Quick deduplicate (simplified version for performance)
   * Uses only content hash for fast exact duplicate detection
   */
  static quickDeduplicate(
    results: DocumentContext[],
    threshold: number = 0.95
  ): DocumentContext[] {
    if (results.length === 0) {
      return [];
    }

    const uniqueResults = new Map<string, DocumentContext>();
    const hashMap = new Map<string, string>();

    for (const result of results) {
      const hash = this.generateContentHash(result.content);
      const resultKey = `${result.documentId}_${result.chunkIndex}`;

      if (hashMap.has(hash)) {
        const existingKey = hashMap.get(hash)!;
        const existing = uniqueResults.get(existingKey)!;
        
        // Quick similarity check
        const similarity = this.calculateJaccardSimilarity(result.content, existing.content);
        
        if (similarity >= threshold) {
          // Keep highest score
          if (result.score > existing.score) {
            uniqueResults.delete(existingKey);
            uniqueResults.set(resultKey, result);
            hashMap.set(hash, resultKey);
          }
        } else {
          // Not duplicate, add both
          uniqueResults.set(resultKey, result);
        }
      } else {
        uniqueResults.set(resultKey, result);
        hashMap.set(hash, resultKey);
      }
    }

    return Array.from(uniqueResults.values());
  }
}
