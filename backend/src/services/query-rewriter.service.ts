/**
 * Query Rewriter Service
 * Uses LLM to rewrite/expand queries into multiple variations
 * Generates multiple query variations and combines results
 */

import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError } from '../types/error';

export interface QueryRewritingOptions {
  maxVariations?: number; // Maximum number of query variations to generate (default: 3)
  useCache?: boolean; // Use cached rewritten queries (default: true)
  context?: string; // Additional context for rewriting
  temperature?: number; // Temperature for LLM (default: 0.7)
  model?: string; // Model to use for rewriting (default: gpt-3.5-turbo)
}

export interface RewrittenQuery {
  originalQuery: string;
  variations: string[]; // Multiple query variations
  rewritingTimeMs: number;
  cached?: boolean;
}

export interface AggregatedSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  sourceQuery?: string; // Which query variation found this result
  aggregatedScore?: number; // Aggregated score across queries
}

/**
 * In-memory cache for rewritten queries
 * Key: normalized query, Value: RewrittenQuery
 */
interface CacheEntry {
  rewritten: RewrittenQuery;
  timestamp: number;
}

const rewriteCache = new Map<string, CacheEntry>();

/**
 * Cache TTL: 1 hour (in milliseconds)
 */
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Query Rewriter Service
 */
export class QueryRewriterService {
  private static readonly DEFAULT_MODEL = 'gpt-3.5-turbo';
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_VARIATIONS = 3;

  /**
   * Normalize query for caching
   */
  private static normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Get cached rewritten query if available and not expired
   */
  private static getCachedRewrite(query: string): RewrittenQuery | null {
    const normalized = this.normalizeQuery(query);
    const cached = rewriteCache.get(normalized);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
      rewriteCache.delete(normalized);
      return null;
    }

    logger.debug('Using cached query rewrite', { query: normalized });
    return {
      ...cached.rewritten,
      cached: true,
    };
  }

  /**
   * Cache rewritten query
   */
  private static cacheRewrite(query: string, rewritten: RewrittenQuery): void {
    const normalized = this.normalizeQuery(query);
    rewriteCache.set(normalized, {
      rewritten,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate multiple query variations using LLM
   */
  private static async generateQueryVariations(
    query: string,
    options: QueryRewritingOptions
  ): Promise<string[]> {
    const maxVariations = options.maxVariations || this.DEFAULT_MAX_VARIATIONS;
    const temperature = options.temperature ?? this.DEFAULT_TEMPERATURE;
    const model = options.model || this.DEFAULT_MODEL;
    const context = options.context;

    const systemPrompt = `You are a query rewriting assistant. Your task is to generate ${maxVariations} different query variations of the user's search query. Each variation should:
1. Preserve the core intent and meaning
2. Use different wording and phrasing
3. Be optimized for web search
4. Be concise and clear

Return a JSON object with a "variations" array containing the query strings. Example: {"variations": ["query 1", "query 2", "query 3"]}`;

    const userPrompt = context
      ? `Original query: "${query}"\n\nContext: ${context}\n\nGenerate ${maxVariations} query variations.`
      : `Original query: "${query}"\n\nGenerate ${maxVariations} query variations.`;

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 200, // Enough for multiple queries
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AppError('No response from LLM for query rewriting', 500);
      }

      // Parse JSON response
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        // Try to extract array if response is not valid JSON
        const arrayMatch = content.match(/\[.*\]/s);
        if (arrayMatch) {
          parsed = JSON.parse(arrayMatch[0]);
        } else {
          throw new AppError('Failed to parse LLM response for query rewriting', 500);
        }
      }

      // Extract variations
      let variations: string[] = [];
      if (Array.isArray(parsed)) {
        variations = parsed;
      } else if (parsed.variations && Array.isArray(parsed.variations)) {
        variations = parsed.variations;
      } else if (parsed.queries && Array.isArray(parsed.queries)) {
        variations = parsed.queries;
      } else {
        // Try to find any array in the response
        const values = Object.values(parsed);
        const arrayValue = values.find(v => Array.isArray(v)) as string[] | undefined;
        if (arrayValue) {
          variations = arrayValue;
        }
      }

      // Validate and clean variations
      variations = variations
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map(v => v.trim())
        .slice(0, maxVariations);

      // Ensure we have at least the original query
      if (variations.length === 0) {
        variations = [query];
      }

      // Remove duplicates while preserving order
      const uniqueVariations = Array.from(new Set(variations.map(v => v.toLowerCase())))
        .map(lower => variations.find(v => v.toLowerCase() === lower)!)
        .filter(v => v !== undefined);

      return uniqueVariations.length > 0 ? uniqueVariations : [query];
    } catch (error: any) {
      logger.error('Failed to generate query variations', {
        query: query.substring(0, 100),
        error: error.message,
      });
      // Fallback to original query
      return [query];
    }
  }

  /**
   * Rewrite query into multiple variations
   */
  static async rewriteQuery(
    query: string,
    options: QueryRewritingOptions = {}
  ): Promise<RewrittenQuery> {
    const startTime = Date.now();
    const useCache = options.useCache !== false; // Default to true

    if (!query || query.trim().length === 0) {
      return {
        originalQuery: query,
        variations: [query],
        rewritingTimeMs: Date.now() - startTime,
      };
    }

    // Check cache
    if (useCache) {
      const cached = this.getCachedRewrite(query);
      if (cached) {
        return cached;
      }
    }

    // Generate variations
    const variations = await this.generateQueryVariations(query, options);

    const rewritingTimeMs = Date.now() - startTime;

    const rewritten: RewrittenQuery = {
      originalQuery: query,
      variations,
      rewritingTimeMs,
      cached: false,
    };

    // Cache result
    if (useCache) {
      this.cacheRewrite(query, rewritten);
    }

    logger.info('Query rewritten into variations', {
      originalQuery: query.substring(0, 100),
      variationCount: variations.length,
      rewritingTimeMs,
    });

    return rewritten;
  }

  /**
   * Aggregate search results from multiple query variations
   */
  static aggregateResults(
    resultsByQuery: Array<{
      query: string;
      results: Array<{ title: string; url: string; content: string; score?: number }>;
    }>,
    maxResults?: number
  ): AggregatedSearchResult[] {
    // Map to track results by URL (deduplication)
    const resultMap = new Map<string, AggregatedSearchResult>();

    // Process results from each query
    for (const { query, results } of resultsByQuery) {
      for (const result of results) {
        const url = result.url;
        const score = result.score || 0;

        if (resultMap.has(url)) {
          // Result already exists - update aggregated score
          const existing = resultMap.get(url)!;
          // Use maximum score or average (using max for now)
          existing.aggregatedScore = Math.max(
            existing.aggregatedScore || existing.score,
            score
          );
          // Track multiple source queries
          if (existing.sourceQuery && existing.sourceQuery !== query) {
            existing.sourceQuery = `${existing.sourceQuery}, ${query}`;
          } else if (!existing.sourceQuery) {
            existing.sourceQuery = query;
          }
        } else {
          // New result
          resultMap.set(url, {
            title: result.title,
            url: result.url,
            content: result.content,
            score,
            aggregatedScore: score,
            sourceQuery: query,
          });
        }
      }
    }

    // Convert to array and sort by aggregated score
    const aggregated = Array.from(resultMap.values()).sort(
      (a, b) => (b.aggregatedScore || b.score) - (a.aggregatedScore || a.score)
    );

    // Limit results if specified
    if (maxResults && maxResults > 0) {
      return aggregated.slice(0, maxResults);
    }

    return aggregated;
  }

  /**
   * Clear rewrite cache
   */
  static clearCache(): void {
    rewriteCache.clear();
    logger.info('Query rewrite cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; entries: number } {
    return {
      size: rewriteCache.size,
      entries: rewriteCache.size,
    };
  }
}
