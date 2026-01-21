import { tavilyClient } from '../config/tavily';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';

export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';

/**
 * Extract dates from text content using various date formats
 * Returns array of parsed Date objects found in the content
 */
function extractDatesFromContent(content: string): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  
  if (!content) return dates;
  
  // Pattern 1: Full dates like "November 5, 2025" or "Nov 5, 2025"
  const fullDatePattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s,]+(\d{1,2})[\s,]+(\d{4})\b/gi;
  let match;
  while ((match = fullDatePattern.exec(content)) !== null) {
    try {
      const dateStr = match[0];
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        dates.push(parsed);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Pattern 2: ISO dates like "2025-11-05" or "2025/11/05"
  const isoDatePattern = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  while ((match = isoDatePattern.exec(content)) !== null) {
    try {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // Month is 0-indexed
      const day = parseInt(match[3]);
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime()) && year >= 2000 && year <= currentYear + 1) {
        dates.push(parsed);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Pattern 3: US format dates like "11/5/2025" or "11-5-2025"
  const usDatePattern = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g;
  while ((match = usDatePattern.exec(content)) !== null) {
    try {
      const month = parseInt(match[1]) - 1; // Month is 0-indexed
      const day = parseInt(match[2]);
      const year = parseInt(match[3]);
      if (year >= 2000 && year <= currentYear + 1 && month >= 0 && month <= 11) {
        const parsed = new Date(year, month, day);
        if (!isNaN(parsed.getTime())) {
          dates.push(parsed);
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Pattern 4: Years like "2025", "2026" (standalone years)
  const yearPattern = /\b(20[2-9][0-9])\b/g;
  const years = new Set<number>();
  while ((match = yearPattern.exec(content)) !== null) {
    const year = parseInt(match[1]);
    if (year >= 2000 && year <= currentYear + 1) {
      years.add(year);
    }
  }
  
  // For standalone years, create dates at the start of that year
  years.forEach(year => {
    dates.push(new Date(year, 0, 1));
  });
  
  return dates;
}

/**
 * Check if content mentions dates that are clearly outside the time range
 */
function hasDatesOutsideRange(content: string, cutoffDate: Date, isStrict: boolean): boolean {
  if (!content) return false;
  
  const extractedDates = extractDatesFromContent(content);
  const now = new Date();
  
  for (const date of extractedDates) {
    // Exclude future dates (they're likely errors or irrelevant for recent content)
    if (date > now) {
      return true; // Has future date
    }
    
    // For strict mode (last 24 hours), exclude any date outside range
    if (isStrict && date < cutoffDate) {
      return true; // Has date outside range
    }
    
    // For non-strict mode, only exclude if date is clearly very old (more than 2x the range)
    if (!isStrict) {
      const rangeMs = now.getTime() - cutoffDate.getTime();
      const dateDiff = now.getTime() - date.getTime();
      if (dateDiff > rangeMs * 2) {
        return true; // Date is clearly outside reasonable range
      }
    }
  }
  
  return false;
}

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
      
      // Add topic to query if provided - use quotes to make it more specific
      if (request.topic) {
        // Use quoted phrase to ensure the topic is treated as a required term
        const topicPhrase = request.topic.includes(' ') ? `"${request.topic}"` : request.topic;
        searchQuery = `${topicPhrase} ${searchQuery}`;
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

      // Filter results by topic/keyword if provided - ensure results are actually about the topic
      if (request.topic) {
        const topicLower = request.topic.toLowerCase().trim();
        const topicWords = topicLower.split(/\s+/);
        
        results = results.filter((result) => {
          // Check if topic appears in title or content
          const titleLower = (result.title || '').toLowerCase();
          const contentLower = (result.content || '').toLowerCase();
          const combinedText = `${titleLower} ${contentLower}`;
          
          // For multi-word topics, check if all significant words appear
          // For single-word topics, check if the word appears
          if (topicWords.length > 1) {
            // Multi-word topic: require the full phrase or all significant words
            const hasFullPhrase = combinedText.includes(topicLower);
            // Also check if all significant words (2+ chars) appear
            const significantWords = topicWords.filter(w => w.length >= 2);
            const hasAllWords = significantWords.length > 0 && 
              significantWords.every(word => combinedText.includes(word));
            
            return hasFullPhrase || hasAllWords;
          } else {
            // Single-word topic: just check if it appears
            return combinedText.includes(topicLower);
          }
        });
        
        logger.info('Filtered results by topic/keyword', {
          topic: request.topic,
          originalCount: (response.results || []).length,
          filteredCount: results.length,
        });
      }

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
          const now = new Date();
          // Determine if this is a strict time range (last 24 hours = very strict)
          const isStrict = request.timeRange === 'day' || request.timeRange === 'd';
          
          results = results.filter((result) => {
            let hasValidPublishedDate = false;
            let publishedDateWithinRange = false;
            
            // Layer 1: Check publishedDate if available
            if (result.publishedDate) {
              try {
                const publishedDate = new Date(result.publishedDate);
                
                // Exclude future dates (they're likely errors)
                if (publishedDate > now) {
                  logger.warn('Excluding result with future publishedDate', {
                    url: result.url,
                    publishedDate: result.publishedDate,
                    title: result.title,
                  });
                  return false;
                }
                
                // Check if publishedDate is within the time range
                publishedDateWithinRange = publishedDate >= cutoffDate;
                hasValidPublishedDate = true;
                
                // For strict mode (last 24 hours), if publishedDate is outside range, exclude
                if (isStrict && !publishedDateWithinRange) {
                  logger.warn('Excluding result: publishedDate outside strict time range', {
                    url: result.url,
                    publishedDate: result.publishedDate,
                    cutoffDate: cutoffDate.toISOString(),
                    title: result.title,
                  });
                  return false;
                }
              } catch (e) {
                logger.warn('Failed to parse publishedDate', {
                  url: result.url,
                  publishedDate: result.publishedDate,
                  error: e,
                });
                // If we can't parse publishedDate, continue to content check
              }
            }
            
            // Layer 2: Check content for dates
            if (result.content) {
              // Extract dates from content
              const contentDates = extractDatesFromContent(result.content);
              
              // For strict mode (last 24 hours), exclude if no publishedDate and content has dates outside range
              if (isStrict) {
                if (!hasValidPublishedDate) {
                  // No publishedDate available - exclude if content has any dates
                  if (contentDates.length > 0) {
                    logger.warn('Excluding result: no publishedDate but content has dates (strict mode)', {
                      url: result.url,
                      contentDates: contentDates.map(d => d.toISOString()),
                      title: result.title,
                    });
                    return false;
                  }
                  // No dates in content and no publishedDate - exclude in strict mode
                  return false;
                }
                
                // Check if content mentions dates outside range
                if (hasDatesOutsideRange(result.content, cutoffDate, true)) {
                  logger.warn('Excluding result: content has dates outside strict time range', {
                    url: result.url,
                    publishedDate: result.publishedDate,
                    contentDates: contentDates.map(d => d.toISOString()),
                    title: result.title,
                  });
                  return false;
                }
              } else {
                // Non-strict mode: use content dates as secondary check
                if (!hasValidPublishedDate && contentDates.length > 0) {
                  // No publishedDate, but we have content dates - check them
                  const hasRecentContentDate = contentDates.some(date => date >= cutoffDate && date <= now);
                  if (!hasRecentContentDate) {
                    logger.warn('Excluding result: content dates outside time range', {
                      url: result.url,
                      contentDates: contentDates.map(d => d.toISOString()),
                      title: result.title,
                    });
                    return false;
                  }
                  return true; // Content has recent date
                }
                
                // Check if content has dates clearly outside range
                if (hasDatesOutsideRange(result.content, cutoffDate, false)) {
                  logger.warn('Excluding result: content has dates clearly outside time range', {
                    url: result.url,
                    publishedDate: result.publishedDate,
                    contentDates: contentDates.map(d => d.toISOString()),
                    title: result.title,
                  });
                  return false;
                }
              }
            }
            
            // Layer 3: Final decision
            // For strict mode, must have valid publishedDate within range
            if (isStrict) {
              return hasValidPublishedDate && publishedDateWithinRange;
            }
            
            // For non-strict mode:
            // - If we have valid publishedDate, use it
            // - If no publishedDate but content has recent dates, allow it
            // - If no publishedDate and no content dates, exclude it
            if (hasValidPublishedDate) {
              return publishedDateWithinRange;
            }
            
            // No publishedDate - exclude if we can't verify from content
            return false;
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
        
        const now = new Date();
        results = results.filter((result) => {
          let hasValidPublishedDate = false;
          let publishedDateInRange = false;
          
          // Layer 1: Check publishedDate
          if (result.publishedDate) {
            try {
              const publishedDate = new Date(result.publishedDate);
              
              // Exclude future dates
              if (publishedDate > now) {
                logger.warn('Excluding result with future date in custom range', {
                  url: result.url,
                  publishedDate: result.publishedDate,
                  title: result.title,
                });
                return false;
              }
              
              publishedDateInRange = publishedDate >= startDate && publishedDate <= endDate;
              hasValidPublishedDate = true;
            } catch (e) {
              logger.warn('Failed to parse published date in custom range', {
                url: result.url,
                publishedDate: result.publishedDate,
                error: e,
              });
            }
          }
          
          // Layer 2: Check content dates
          if (result.content) {
            const contentDates = extractDatesFromContent(result.content);
            
            if (!hasValidPublishedDate && contentDates.length > 0) {
              // No publishedDate, but we have content dates - check them
              const hasDateInRange = contentDates.some(date => 
                date >= startDate && date <= endDate && date <= now
              );
              if (hasDateInRange) {
                return true; // Content has date in range
              }
            }
            
            // Check if content has dates clearly outside range
            const hasDatesOutside = contentDates.some(date => 
              date < startDate || (date > endDate && date <= now) || date > now
            );
            if (hasDatesOutside && !hasValidPublishedDate) {
              logger.warn('Excluding result: content dates outside custom range', {
                url: result.url,
                contentDates: contentDates.map(d => d.toISOString()),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                title: result.title,
              });
              return false;
            }
          }
          
          // Final decision: use publishedDate if available, otherwise exclude
          if (hasValidPublishedDate) {
            return publishedDateInRange;
          }
          
          // No publishedDate and can't verify from content - exclude
          return false;
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
