import { tavilyClient } from '../config/tavily';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

export interface SearchRequest {
  query: string;
  topic?: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
  author?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  topic?: string;
  cached?: boolean;
}

// Simple in-memory cache (can be replaced with Redis in production)
interface CacheEntry {
  data: SearchResponse;
  timestamp: number;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_CACHE_SIZE = 1000; // Maximum number of cached entries

/**
 * Generate cache key from search request
 */
function generateCacheKey(request: SearchRequest): string {
  const parts = [
    request.query.toLowerCase().trim(),
    request.topic || '',
    request.maxResults || 5,
    (request.includeDomains || []).sort().join(','),
    (request.excludeDomains || []).sort().join(','),
  ];
  return parts.join('|');
}

/**
 * Clean expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of searchCache.entries()) {
    if (entry.expiresAt < now) {
      searchCache.delete(key);
    }
  }

  // If cache is still too large, remove oldest entries
  if (searchCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(searchCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, searchCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      searchCache.delete(key);
    }
  }
}

/**
 * Search Service
 * Handles web search using Tavily Search API
 */
export class SearchService {
  /**
   * Perform web search with optional topic filtering
   */
  static async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      // Validate input
      if (!request.query || request.query.trim().length === 0) {
        throw new ValidationError('Search query is required');
      }

      if (request.query.length > 500) {
        throw new ValidationError('Search query is too long (max 500 characters)');
      }

      // Check cache first
      const cacheKey = generateCacheKey(request);
      cleanCache();
      
      const cached = searchCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        logger.info('Search result retrieved from cache', {
          query: request.query,
          topic: request.topic,
        });
        return {
          ...cached.data,
          cached: true,
        };
      }

      // Check if Tavily is configured
      if (!tavilyClient) {
        logger.warn('Tavily client not available, returning empty results');
        return {
          query: request.query,
          results: [],
          topic: request.topic,
          cached: false,
        };
      }

      // Build search query with topic filtering
      let searchQuery = request.query.trim();
      
      // Add topic to query if provided
      if (request.topic) {
        searchQuery = `${request.topic} ${searchQuery}`;
      }

      logger.info('Performing Tavily search', {
        query: searchQuery,
        originalQuery: request.query,
        topic: request.topic,
        maxResults: request.maxResults || 5,
      });

      // Perform search
      const response = await tavilyClient.search(searchQuery, {
        maxResults: request.maxResults || 5,
        includeDomains: request.includeDomains,
        excludeDomains: request.excludeDomains,
        searchDepth: 'basic', // Options: 'basic' or 'advanced'
        includeRawContent: false, // Don't include raw content to save tokens
      });

      // Transform Tavily results to our format
      const results: SearchResult[] = (response.results || []).map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        content: result.content || '',
        score: result.score,
        publishedDate: result.published_date,
        author: result.author,
      }));

      const searchResponse: SearchResponse = {
        query: request.query,
        results,
        topic: request.topic,
        cached: false,
      };

      // Cache the results
      searchCache.set(cacheKey, {
        data: searchResponse,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL,
      });

      logger.info('Search completed', {
        query: request.query,
        resultsCount: results.length,
        topic: request.topic,
      });

      return searchResponse;
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error('Search error:', {
        error: error.message,
        query: request.query,
        topic: request.topic,
      });

      // If it's a Tavily API error, provide helpful message
      if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        throw new AppError(
          'Search service authentication failed. Please check TAVILY_API_KEY configuration.',
          500,
          'SEARCH_AUTH_ERROR'
        );
      }

      if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
        throw new AppError(
          'Search API rate limit exceeded. Please try again later.',
          429,
          'SEARCH_RATE_LIMIT'
        );
      }

      throw new AppError(
        `Search failed: ${error.message || 'Unknown error'}`,
        500,
        'SEARCH_ERROR'
      );
    }
  }

  /**
   * Clear search cache
   */
  static clearCache(): void {
    searchCache.clear();
    logger.info('Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    maxSize: number;
    entries: number;
  } {
    cleanCache();
    return {
      size: searchCache.size,
      maxSize: MAX_CACHE_SIZE,
      entries: searchCache.size,
    };
  }
}
