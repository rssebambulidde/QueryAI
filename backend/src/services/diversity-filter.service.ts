/**
 * Diversity Filter Service
 * Implements Maximal Marginal Relevance (MMR) algorithm for result diversification
 * Balances relevance and diversity in search results
 */

import { DocumentContext } from './rag.service';
import logger from '../config/logger';

export interface DiversityConfig {
  enabled: boolean; // Enable diversity filtering
  lambda: number; // Diversity parameter (0-1): higher = more relevance, lower = more diversity
  maxResults: number; // Maximum number of results after diversity filtering
  similarityThreshold: number; // Minimum similarity to consider documents similar (0-1)
  useEmbeddingSimilarity: boolean; // Use embedding similarity (if available) vs text similarity
}

export interface DiversityOptions {
  lambda?: number; // Override default lambda
  maxResults?: number; // Override default maxResults
  similarityThreshold?: number; // Override default similarity threshold
  useEmbeddingSimilarity?: boolean; // Override embedding similarity preference
}

export interface DiversityResult extends DocumentContext {
  diversityScore?: number; // MMR score
  marginalRelevance?: number; // Marginal relevance contribution
}

/**
 * Default diversity configuration
 */
export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  enabled: true,
  lambda: 0.7, // Default: 70% relevance, 30% diversity
  maxResults: 10,
  similarityThreshold: 0.7, // Documents with >70% similarity are considered similar
  useEmbeddingSimilarity: false, // Use text-based similarity by default
};

/**
 * Diversity Filter Service
 * Implements MMR algorithm for result diversification
 */
export class DiversityFilterService {
  private static config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG;

  /**
   * Set diversity configuration
   */
  static setConfig(config: Partial<DiversityConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Diversity configuration updated', { config: this.config });
  }

  /**
   * Get current diversity configuration
   */
  static getConfig(): DiversityConfig {
    return { ...this.config };
  }

  /**
   * Calculate text similarity between two documents
   * Uses Jaccard similarity on word sets
   */
  private static calculateTextSimilarity(
    doc1: DocumentContext,
    doc2: DocumentContext
  ): number {
    const text1 = doc1.content.toLowerCase();
    const text2 = doc2.content.toLowerCase();

    // Tokenize into words
    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 0));

    if (words1.size === 0 && words2.size === 0) {
      return 1.0; // Both empty, consider identical
    }

    if (words1.size === 0 || words2.size === 0) {
      return 0.0; // One empty, no similarity
    }

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate embedding similarity between two documents
   * Uses cosine similarity if embeddings are available
   */
  private static calculateEmbeddingSimilarity(
    doc1: DocumentContext,
    doc2: DocumentContext
  ): number {
    // If embeddings are available in metadata, use them
    // For now, fall back to text similarity
    // This can be enhanced if embeddings are stored with results
    return this.calculateTextSimilarity(doc1, doc2);
  }

  /**
   * Calculate similarity between two documents
   */
  private static calculateSimilarity(
    doc1: DocumentContext,
    doc2: DocumentContext,
    useEmbedding: boolean
  ): number {
    if (useEmbedding) {
      return this.calculateEmbeddingSimilarity(doc1, doc2);
    }
    return this.calculateTextSimilarity(doc1, doc2);
  }

  /**
   * Calculate Maximal Marginal Relevance (MMR) score
   * 
   * MMR = λ * Relevance(doc, query) - (1-λ) * max(Similarity(doc, selected_doc))
   * 
   * Where:
   * - λ (lambda) is the diversity parameter (0-1)
   * - Higher λ = more weight on relevance
   * - Lower λ = more weight on diversity
   */
  private static calculateMMRScore(
    candidate: DocumentContext,
    selectedDocs: DocumentContext[],
    lambda: number,
    useEmbedding: boolean
  ): number {
    // Relevance score (normalized to 0-1)
    const relevance = candidate.score || 0;

    // Find maximum similarity to already selected documents
    let maxSimilarity = 0;
    for (const selectedDoc of selectedDocs) {
      const similarity = this.calculateSimilarity(candidate, selectedDoc, useEmbedding);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // MMR formula
    const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

    return mmrScore;
  }

  /**
   * Apply MMR algorithm to diversify results
   * 
   * Algorithm:
   * 1. Start with highest relevance document
   * 2. For each remaining document, calculate MMR score
   * 3. Select document with highest MMR score
   * 4. Repeat until desired number of results
   */
  static applyMMR(
    results: DocumentContext[],
    options: DiversityOptions = {}
  ): DiversityResult[] {
    const config = { ...this.config, ...options };
    
    if (!config.enabled || results.length === 0) {
      return results.map(r => ({ ...r }));
    }

    if (results.length <= 1) {
      return results.map(r => ({ ...r }));
    }

    const lambda = Math.max(0, Math.min(1, config.lambda));
    const maxResults = config.maxResults || results.length;
    const useEmbedding = config.useEmbeddingSimilarity || false;

    // Sort by relevance first (descending)
    const sortedResults = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Selected documents (diversified)
    const selected: DiversityResult[] = [];
    // Remaining candidates
    const candidates = [...sortedResults];

    // Start with highest relevance document
    if (candidates.length > 0) {
      const first = candidates.shift()!;
      selected.push({
        ...first,
        diversityScore: first.score || 0,
        marginalRelevance: first.score || 0,
      });
    }

    // Apply MMR for remaining results
    while (selected.length < maxResults && candidates.length > 0) {
      let bestMMR = -Infinity;
      let bestIndex = -1;
      let bestMarginalRelevance = 0;

      // Find candidate with highest MMR score
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const mmrScore = this.calculateMMRScore(candidate, selected, lambda, useEmbedding);
        
        if (mmrScore > bestMMR) {
          bestMMR = mmrScore;
          bestIndex = i;
          // Calculate marginal relevance (relevance - max similarity to selected)
          const maxSim = selected.reduce((max, sel) => {
            const sim = this.calculateSimilarity(candidate, sel, useEmbedding);
            return Math.max(max, sim);
          }, 0);
          bestMarginalRelevance = (candidate.score || 0) - maxSim;
        }
      }

      // Add best candidate to selected
      if (bestIndex >= 0) {
        const best = candidates.splice(bestIndex, 1)[0];
        selected.push({
          ...best,
          diversityScore: bestMMR,
          marginalRelevance: bestMarginalRelevance,
        });
      } else {
        // No good candidate found, break
        break;
      }
    }

    logger.debug('MMR diversity filtering applied', {
      originalCount: results.length,
      diversifiedCount: selected.length,
      lambda,
      maxResults,
    });

    return selected;
  }

  /**
   * Calculate diversity metrics for a set of results
   */
  static calculateDiversityMetrics(
    results: DocumentContext[]
  ): {
    averageSimilarity: number;
    maxSimilarity: number;
    minSimilarity: number;
    diversityScore: number; // Lower = more diverse
  } {
    if (results.length <= 1) {
      return {
        averageSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0,
        diversityScore: 1.0, // Perfectly diverse (only one result)
      };
    }

    const similarities: number[] = [];

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const similarity = this.calculateTextSimilarity(results[i], results[j]);
        similarities.push(similarity);
      }
    }

    if (similarities.length === 0) {
      return {
        averageSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0,
        diversityScore: 1.0,
      };
    }

    const averageSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
    const maxSimilarity = Math.max(...similarities);
    const minSimilarity = Math.min(...similarities);

    // Diversity score: inverse of average similarity (lower similarity = higher diversity)
    const diversityScore = 1 - averageSimilarity;

    return {
      averageSimilarity,
      maxSimilarity,
      minSimilarity,
      diversityScore,
    };
  }

  /**
   * Filter results for diversity (convenience method)
   */
  static filterForDiversity(
    results: DocumentContext[],
    options: DiversityOptions = {}
  ): DiversityResult[] {
    return this.applyMMR(results, options);
  }
}
