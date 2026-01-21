import { tavilyClient } from '../config/tavily';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';

export interface SearchRequest {
  query: string;
  topic?: string; // Any keyword for topic filtering
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  // Time range filtering
  timeRange?: TimeRange;
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  // Location filtering
  country?: string; // ISO country code (e.g., 'US', 'UG', 'KE')
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
  timeRange?: TimeRange;
  country?: string;
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
    request.timeRange || '',
    request.startDate || '',
    request.endDate || '',
    request.country || '',
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
      
      // Add time-based keywords to query for better filtering (subtle enhancement)
      if (request.timeRange && !request.startDate && !request.endDate) {
        const timeKeywords: Record<string, string> = {
          'day': 'recent OR today OR "last 24 hours"',
          'd': 'recent OR today OR "last 24 hours"',
          'week': 'recent OR "this week" OR "last 7 days"',
          'w': 'recent OR "this week" OR "last 7 days"',
          'month': 'recent OR "this month" OR "last 30 days"',
          'm': 'recent OR "this month" OR "last 30 days"',
          'year': 'recent OR "this year" OR "last 12 months"',
          'y': 'recent OR "this year" OR "last 12 months"',
        };
        
        const timeKeyword = timeKeywords[request.timeRange];
        if (timeKeyword) {
          // Add time context more subtly to help search engine prioritize recent content
          searchQuery = `${searchQuery} ${timeKeyword}`;
        }
      }

      logger.info('Performing Tavily search', {
        query: searchQuery,
        originalQuery: request.query,
        topic: request.topic,
        timeRange: request.timeRange,
        country: request.country,
        maxResults: request.maxResults || 5,
      });

      // Build Tavily search options
      const tavilyOptions: any = {
        maxResults: request.maxResults || 5,
        includeDomains: request.includeDomains,
        excludeDomains: request.excludeDomains,
        searchDepth: 'basic', // Options: 'basic' or 'advanced'
        includeRawContent: false, // Don't include raw content to save tokens
      };

      // Add time range filtering
      if (request.timeRange) {
        tavilyOptions.timeRange = request.timeRange;
      } else if (request.startDate || request.endDate) {
        // Use custom date range if provided
        if (request.startDate) {
          tavilyOptions.startDate = request.startDate;
        }
        if (request.endDate) {
          tavilyOptions.endDate = request.endDate;
        }
      }

      // Add location filtering
      if (request.country) {
        tavilyOptions.country = request.country.toUpperCase();
      }

      // Perform search
      const response = await tavilyClient.search(searchQuery, tavilyOptions);

      // Transform Tavily results to our format
      let results: SearchResult[] = (response.results || []).map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        content: result.content || '',
        score: result.score,
        publishedDate: result.published_date,
        author: result.author,
      }));

      // Filter results by time range if specified
      if (request.timeRange && !request.startDate && !request.endDate) {
        const now = new Date();
        let cutoffDate: Date;
        
        switch (request.timeRange) {
          case 'day':
          case 'd':
            cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
            break;
          case 'week':
          case 'w':
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
            break;
          case 'month':
          case 'm':
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
            break;
          case 'year':
          case 'y':
            cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last 365 days
            break;
          default:
            cutoffDate = new Date(0); // No filtering
        }
        
        if (cutoffDate.getTime() > 0) {
          results = results.filter((result) => {
            if (!result.publishedDate) {
              // If no published date, include it (better to show than hide)
              return true;
            }
            
            try {
              const publishedDate = new Date(result.publishedDate);
              return publishedDate >= cutoffDate;
            } catch (e) {
              // If date parsing fails, include it
              return true;
            }
          });
          
          logger.info('Filtered results by time range', {
            timeRange: request.timeRange,
            cutoffDate: cutoffDate.toISOString(),
            originalCount: (response.results || []).length,
            filteredCount: results.length,
          });
        }
      } else if (request.startDate || request.endDate) {
        // Filter by custom date range
        const startDate = request.startDate ? new Date(request.startDate) : new Date(0);
        const endDate = request.endDate ? new Date(request.endDate) : new Date();
        
        results = results.filter((result) => {
          if (!result.publishedDate) {
            return true; // Include if no date
          }
          
          try {
            const publishedDate = new Date(result.publishedDate);
            return publishedDate >= startDate && publishedDate <= endDate;
          } catch (e) {
            return true; // Include if date parsing fails
          }
        });
        
        logger.info('Filtered results by custom date range', {
          startDate: request.startDate,
          endDate: request.endDate,
          originalCount: (response.results || []).length,
          filteredCount: results.length,
        });
      }

      const searchResponse: SearchResponse = {
        query: request.query,
        results,
        topic: request.topic,
        timeRange: request.timeRange,
        country: request.country,
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
