/**
 * Query Expansion Service
 * Expands user queries with related terms, synonyms, and context to improve retrieval recall
 * Supports multiple expansion strategies: LLM-based, embedding-based synonyms, and hybrid
 */

import { openai } from '../config/openai';
import { EmbeddingService } from './embedding.service';
import logger from '../config/logger';
import { AppError } from '../types/error';

export type ExpansionStrategy = 'llm' | 'embedding' | 'hybrid' | 'none';

export interface QueryExpansionOptions {
  strategy?: ExpansionStrategy;
  maxExpansions?: number; // Maximum number of expansion terms
  useCache?: boolean; // Use cached expansions
  context?: string; // Additional context for expansion
}

export interface ExpandedQuery {
  originalQuery: string;
  expandedTerms: string[]; // Additional terms to add
  expandedQuery: string; // Full expanded query
  strategy: ExpansionStrategy;
  confidence?: number; // Confidence in expansions (0-1)
}

/**
 * In-memory cache for query expansions
 * Key: normalized query, Value: ExpandedQuery
 */
const expansionCache = new Map<string, ExpandedQuery>();

/**
 * Cache TTL: 1 hour (in milliseconds)
 */
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Cache entry with timestamp
 */
interface CacheEntry {
  expansion: ExpandedQuery;
  timestamp: number;
}

const cacheWithTimestamps = new Map<string, CacheEntry>();

/**
 * Query Expansion Service
 */
export class QueryExpansionService {
  /**
   * Normalize query for caching (lowercase, trim, remove extra spaces)
   */
  private static normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Get cached expansion if available and not expired
   */
  private static getCachedExpansion(query: string): ExpandedQuery | null {
    const normalized = this.normalizeQuery(query);
    const cached = cacheWithTimestamps.get(normalized);
    
    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
      cacheWithTimestamps.delete(normalized);
      return null;
    }

    logger.debug('Using cached query expansion', { query: normalized });
    // Return cached expansion but update originalQuery and expandedQuery to use current query
    const cachedExpansion = cached.expansion;
    // Rebuild expanded query with current query (preserve expansion terms)
    const expandedQuery = cachedExpansion.expandedTerms.length > 0
      ? `${query} ${cachedExpansion.expandedTerms.join(' ')}`
      : query;
    
    return {
      ...cachedExpansion,
      originalQuery: query, // Preserve the current query as original
      expandedQuery, // Rebuild with current query
    };
  }

  /**
   * Cache expansion result
   */
  private static cacheExpansion(query: string, expansion: ExpandedQuery): void {
    const normalized = this.normalizeQuery(query);
    cacheWithTimestamps.set(normalized, {
      expansion,
      timestamp: Date.now(),
    });
    
    // Clean up old entries periodically (simple: remove if cache gets too large)
    if (cacheWithTimestamps.size > 1000) {
      const now = Date.now();
      for (const [key, entry] of cacheWithTimestamps.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
          cacheWithTimestamps.delete(key);
        }
      }
    }
  }

  /**
   * Expand query using LLM to generate related terms
   */
  private static async expandWithLLM(
    query: string,
    options: QueryExpansionOptions
  ): Promise<ExpandedQuery> {
    try {
      const maxExpansions = options.maxExpansions || 5;
      const context = options.context ? `\nContext: ${options.context}` : '';

      const prompt = `Given the following search query, generate ${maxExpansions} related terms, synonyms, or alternative phrasings that would help find relevant information. Return only the terms, separated by commas, without explanations.

Query: "${query}"${context}

Related terms:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates search query expansions. Return only comma-separated terms.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new AppError('LLM returned empty expansion', 500, 'LLM_EXPANSION_ERROR');
      }

      // Parse comma-separated terms
      const queryLower = query.toLowerCase();
      const expandedTerms = content
        .split(',')
        .map(term => term.trim())
        .filter(term => {
          // Filter out empty terms and exact matches with original query
          if (term.length === 0) return false;
          // Also filter out terms that are substrings of the original query
          if (queryLower.includes(term.toLowerCase()) || term.toLowerCase().includes(queryLower)) {
            return false;
          }
          return true;
        })
        .slice(0, maxExpansions);

      // Combine original query with expansions
      const expandedQuery = [query, ...expandedTerms].join(' ');

      logger.info('Query expanded with LLM', {
        originalQuery: query.substring(0, 100),
        expansionCount: expandedTerms.length,
      });

      return {
        originalQuery: query,
        expandedTerms,
        expandedQuery,
        strategy: 'llm',
        confidence: 0.8, // LLM expansions are generally high confidence
      };
    } catch (error: any) {
      logger.error('LLM query expansion failed', {
        query: query.substring(0, 100),
        error: error.message,
      });
      throw new AppError('Query expansion failed', 500, 'QUERY_EXPANSION_ERROR');
    }
  }

  /**
   * Expand query using embedding similarity to find synonyms
   * This is a simplified version - in production, you might use a synonym dictionary
   */
  private static async expandWithEmbeddings(
    query: string,
    options: QueryExpansionOptions
  ): Promise<ExpandedQuery> {
    try {
      // For embedding-based expansion, we would typically:
      // 1. Have a pre-built synonym dictionary with embeddings
      // 2. Find similar terms using cosine similarity
      // 3. Return top similar terms
      
      // For now, we'll use a simple approach: extract key terms and suggest variations
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      
      // Simple synonym mapping (can be extended with a proper thesaurus)
      const synonymMap: Record<string, string[]> = {
        'ai': ['artificial intelligence', 'machine learning', 'neural network'],
        'ml': ['machine learning', 'artificial intelligence', 'deep learning'],
        'learn': ['study', 'understand', 'comprehend', 'grasp'],
        'help': ['assist', 'support', 'aid', 'guide'],
        'create': ['make', 'build', 'generate', 'produce'],
        'find': ['search', 'locate', 'discover', 'identify'],
        'explain': ['describe', 'clarify', 'elaborate', 'detail'],
      };

      const expandedTerms: string[] = [];
      const maxExpansions = options.maxExpansions || 5;

      for (const word of words) {
        if (synonymMap[word]) {
          expandedTerms.push(...synonymMap[word]);
        }
      }

      // Remove duplicates and limit
      const uniqueTerms = Array.from(new Set(expandedTerms))
        .filter(term => term.toLowerCase() !== query.toLowerCase())
        .slice(0, maxExpansions);

      const expandedQuery = uniqueTerms.length > 0
        ? `${query} ${uniqueTerms.join(' ')}`
        : query;

      logger.info('Query expanded with embeddings', {
        originalQuery: query.substring(0, 100),
        expansionCount: uniqueTerms.length,
      });

      return {
        originalQuery: query,
        expandedTerms: uniqueTerms,
        expandedQuery,
        strategy: 'embedding',
        confidence: 0.6, // Embedding-based expansions are moderate confidence
      };
    } catch (error: any) {
      logger.error('Embedding query expansion failed', {
        query: query.substring(0, 100),
        error: error.message,
      });
      // Fallback to no expansion
      return {
        originalQuery: query,
        expandedTerms: [],
        expandedQuery: query,
        strategy: 'embedding',
        confidence: 0,
      };
    }
  }

  /**
   * Expand query using hybrid approach (LLM + embeddings)
   */
  private static async expandWithHybrid(
    query: string,
    options: QueryExpansionOptions
  ): Promise<ExpandedQuery> {
    try {
      // Run both strategies in parallel
      const [llmExpansion, embeddingExpansion] = await Promise.all([
        this.expandWithLLM(query, options).catch(() => null),
        this.expandWithEmbeddings(query, options).catch(() => null),
      ]);

      // Combine results
      const allTerms = new Set<string>();
      
      if (llmExpansion) {
        llmExpansion.expandedTerms.forEach(term => allTerms.add(term));
      }
      
      if (embeddingExpansion) {
        embeddingExpansion.expandedTerms.forEach(term => allTerms.add(term));
      }

      const expandedTerms = Array.from(allTerms).slice(0, options.maxExpansions || 5);
      const expandedQuery = expandedTerms.length > 0
        ? `${query} ${expandedTerms.join(' ')}`
        : query;

      // Calculate average confidence
      const confidences = [llmExpansion?.confidence, embeddingExpansion?.confidence]
        .filter((c): c is number => c !== undefined && c > 0);
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : 0.5;

      logger.info('Query expanded with hybrid approach', {
        originalQuery: query.substring(0, 100),
        expansionCount: expandedTerms.length,
        llmTerms: llmExpansion?.expandedTerms.length || 0,
        embeddingTerms: embeddingExpansion?.expandedTerms.length || 0,
      });

      return {
        originalQuery: query,
        expandedTerms,
        expandedQuery,
        strategy: 'hybrid',
        confidence: avgConfidence,
      };
    } catch (error: any) {
      logger.error('Hybrid query expansion failed', {
        query: query.substring(0, 100),
        error: error.message,
      });
      // Fallback to no expansion
      return {
        originalQuery: query,
        expandedTerms: [],
        expandedQuery: query,
        strategy: 'hybrid',
        confidence: 0,
      };
    }
  }

  /**
   * Expand a query using the specified strategy
   */
  static async expandQuery(
    query: string,
    options: QueryExpansionOptions = {}
  ): Promise<ExpandedQuery> {
    const strategy = options.strategy || 'hybrid';
    const useCache = options.useCache !== false; // Default to true

    // Check cache first
    if (useCache) {
      const cached = this.getCachedExpansion(query);
      if (cached) {
        return cached;
      }
    }

    // Perform expansion based on strategy
    let expansion: ExpandedQuery;

    switch (strategy) {
      case 'llm':
        expansion = await this.expandWithLLM(query, options);
        break;
      case 'embedding':
        expansion = await this.expandWithEmbeddings(query, options);
        break;
      case 'hybrid':
        expansion = await this.expandWithHybrid(query, options);
        break;
      case 'none':
      default:
        expansion = {
          originalQuery: query,
          expandedTerms: [],
          expandedQuery: query,
          strategy: 'none',
          confidence: 1.0,
        };
        break;
    }

    // Cache the result
    if (useCache) {
      this.cacheExpansion(query, expansion);
    }

    return expansion;
  }

  /**
   * Expand multiple queries in batch
   */
  static async expandQueries(
    queries: string[],
    options: QueryExpansionOptions = {}
  ): Promise<ExpandedQuery[]> {
    // Expand queries in parallel (with rate limiting consideration)
    const expansions = await Promise.all(
      queries.map(query => this.expandQuery(query, options).catch(error => {
        logger.warn('Query expansion failed for query', {
          query: query.substring(0, 100),
          error: error.message,
        });
        // Return no expansion on error
        return {
          originalQuery: query,
          expandedTerms: [],
          expandedQuery: query,
          strategy: options.strategy || 'none',
          confidence: 0,
        };
      }))
    );

    return expansions;
  }

  /**
   * Clear expansion cache
   */
  static clearCache(): void {
    cacheWithTimestamps.clear();
    logger.info('Query expansion cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    entries: number;
  } {
    const now = Date.now();
    let validEntries = 0;

    for (const entry of cacheWithTimestamps.values()) {
      if (now - entry.timestamp <= CACHE_TTL) {
        validEntries++;
      }
    }

    return {
      size: cacheWithTimestamps.size,
      entries: validEntries,
    };
  }
}
