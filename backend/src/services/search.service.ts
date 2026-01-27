import { tavilyClient } from '../config/tavily';
import { QueryOptimizerService, QueryOptimizationOptions } from './query-optimizer.service';
import { TopicQueryBuilderService, TopicQueryOptions } from './topic-query-builder.service';
import { QueryRewriterService, QueryRewritingOptions } from './query-rewriter.service';
import { WebResultRerankerService, RerankingConfig } from './web-result-reranker.service';
import { ResultQualityScorerService, QualityScoringConfig } from './result-quality-scorer.service';
import { DomainAuthorityService, DomainAuthorityConfig } from './domain-authority.service';
import { WebDeduplicationService, WebDeduplicationOptions } from './web-deduplication.service';
import { FilteringStrategyService, FilteringOptions } from './filtering-strategy.service';
import { RedisCacheService } from './redis-cache.service';
import { RetryService } from './retry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { 
  FilteringMode, 
  FilteringStrategy,
  getFilteringStrategy,
  selectFilteringVariant,
  getFilteringABTestConfig,
} from '../config/filtering.config';
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
  // Query optimization options
  optimizeQuery?: boolean; // Enable query optimization
  optimizationContext?: string; // Additional context for optimization
  // Topic integration options
  useTopicAwareQuery?: boolean; // Use topic-aware query construction (default: true)
  topicQueryOptions?: TopicQueryOptions; // Options for topic-aware query construction
  // Query rewriting options
  enableQueryRewriting?: boolean; // Enable query rewriting (default: false)
  queryRewritingOptions?: QueryRewritingOptions; // Options for query rewriting
  // Web result re-ranking options
  enableWebResultReranking?: boolean; // Enable web result re-ranking (default: false)
  rerankingConfig?: RerankingConfig; // Re-ranking configuration
  // Quality scoring options
  enableQualityScoring?: boolean; // Enable quality scoring (default: false)
  qualityScoringConfig?: QualityScoringConfig; // Quality scoring configuration
  minQualityScore?: number; // Minimum quality score threshold (0-1, default: 0.5)
  filterByQuality?: boolean; // Filter results by quality threshold (default: false)
  // Domain authority options
  enableDomainAuthority?: boolean; // Enable domain authority scoring (default: true)
  domainAuthorityConfig?: DomainAuthorityConfig; // Domain authority configuration
  filterByAuthority?: boolean; // Filter results by authority threshold (default: false)
  minAuthorityScore?: number; // Minimum authority score threshold (0-1, default: 0.5)
  prioritizeAuthoritative?: boolean; // Prioritize authoritative sources in ranking (default: true)
  // Web deduplication options
  enableDeduplication?: boolean; // Enable web result deduplication (default: true)
  deduplicationOptions?: WebDeduplicationOptions; // Deduplication configuration
  // Filtering strategy options
  filteringMode?: FilteringMode; // Filtering mode: 'strict', 'moderate', 'lenient' (default: 'moderate')
  filteringStrategy?: FilteringStrategy; // Custom filtering strategy
  enableFilteringABTesting?: boolean; // Enable A/B testing for filtering strategies (default: false)
  userId?: string; // User ID for A/B testing (optional)
  // Legacy filtering options (deprecated, use filteringMode instead)
  filterByQuality?: boolean; // Filter results by quality threshold (default: false) - DEPRECATED
  filterByAuthority?: boolean; // Filter results by authority threshold (default: false) - DEPRECATED
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

// Cache configuration
const CACHE_TTL = 3600; // 1 hour in seconds (for Redis)
const CACHE_PREFIX = 'search'; // Cache key prefix for namespacing

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

      // Check cache first (Redis or in-memory fallback)
      const cacheKey = generateCacheKey(request);
      const cached = await RedisCacheService.get<SearchResponse>(cacheKey, {
        prefix: CACHE_PREFIX,
        ttl: CACHE_TTL,
      });
      
      if (cached) {
        logger.info('Search result retrieved from cache', {
          query: request.query,
          topic: request.topic,
        });
        return {
          ...cached,
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

      // Query rewriting (if enabled) - happens before other optimizations
      const enableQueryRewriting = request.enableQueryRewriting ?? false; // Default to false
      let queryVariations: string[] = [request.query.trim()];

      if (enableQueryRewriting) {
        const rewritingOptions = request.queryRewritingOptions || {
          maxVariations: 3,
          useCache: true,
          context: request.optimizationContext,
        };

        const rewritten = await QueryRewriterService.rewriteQuery(
          request.query.trim(),
          rewritingOptions
        );

        queryVariations = rewritten.variations;

        logger.info('Query rewritten into variations', {
          originalQuery: request.query.substring(0, 100),
          variationCount: queryVariations.length,
          rewritingTimeMs: rewritten.rewritingTimeMs,
          cached: rewritten.cached,
        });
      }

      // Process each query variation
      const allResults: Array<{ query: string; results: SearchResult[] }> = [];

      for (const queryVariation of queryVariations) {
        // Build search query with topic-aware construction
        let searchQuery = queryVariation;
        const useTopicAwareQuery = request.useTopicAwareQuery ?? true; // Default to true

        if (request.topic && useTopicAwareQuery) {
          // Use topic-aware query construction
          const topicQueryResult = TopicQueryBuilderService.buildTopicQuery(
            searchQuery,
            request.topic,
            request.topicQueryOptions || {
              useTopicAsContext: true,
              extractTopicKeywords: true,
              useTopicTemplates: true,
              topicWeight: 'medium',
            }
          );

          searchQuery = topicQueryResult.enhancedQuery;

          if (queryVariations.length === 1) {
            // Only log if not using query rewriting (to avoid spam)
            logger.info('Topic-aware query constructed', {
              originalQuery: request.query.substring(0, 100),
              enhancedQuery: searchQuery.substring(0, 100),
              topic: request.topic,
              integrationMethod: topicQueryResult.integrationMethod,
              topicKeywordsCount: topicQueryResult.topicKeywords.length,
              queryTemplate: topicQueryResult.queryTemplate,
            });
          }
        } else if (request.topic) {
          // Fallback to simple prefix approach
          const topicPhrase = request.topic.includes(' ')
            ? `"${request.topic}"`
            : request.topic;
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

        if (queryVariations.length === 1) {
          // Only log if not using query rewriting (to avoid spam)
          logger.info('Performing Tavily search', {
            query: searchQuery,
            originalQuery: request.query,
            topic: request.topic,
            timeRange: request.timeRange,
            country: request.country,
            maxResults: request.maxResults || 5,
          });
        }

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

        // Perform search with circuit breaker and retry logic
        const circuitResult = await CircuitBreakerService.execute(
          'tavily-search',
          async () => {
            const retryResult = await RetryService.execute(
              async () => {
                return await tavilyClient.search(searchQuery, tavilyOptions);
              },
              {
                maxRetries: 3,
                initialDelay: 1000,
                multiplier: 2,
                maxDelay: 10000,
                onRetry: (error, attempt, delay) => {
                  logger.warn('Retrying Tavily search', {
                    attempt,
                    delay,
                    error: error.message,
                    query: searchQuery.substring(0, 100),
                  });
                },
              }
            );
            return retryResult.result;
          },
          {
            failureThreshold: 5,
            resetTimeout: 60000, // 60 seconds
            monitoringWindow: 60000,
            timeout: 30000, // 30 seconds
            errorFilter: (error) => {
              // Only count server errors as failures
              return error.status >= 500 || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
            },
          }
        );

        const response = circuitResult.result;

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
          
          if (queryVariations.length === 1) {
            // Only log if not using query rewriting (to avoid spam)
            logger.info('Filtered results by topic/keyword', {
              topic: request.topic,
              originalCount: (response.results || []).length,
              filteredCount: results.length,
            });
          }
        }

        // Store results for this query variation
        allResults.push({
          query: queryVariation,
          results,
        });
      }

      // Aggregate results if using query rewriting
      let finalResults: SearchResult[];
      if (enableQueryRewriting && allResults.length > 1) {
        // Aggregate results from all query variations
        const aggregated = QueryRewriterService.aggregateResults(
          allResults.map(({ query, results }) => ({
            query,
            results: results.map(r => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score || 0,
            })),
          })),
          request.maxResults
        );

        // Convert back to SearchResult format
        finalResults = aggregated.map(agg => ({
          title: agg.title,
          url: agg.url,
          content: agg.content,
          score: agg.aggregatedScore || agg.score,
          publishedDate: undefined, // Not available after aggregation
          author: undefined, // Not available after aggregation
        }));

        logger.info('Aggregated results from query variations', {
          originalQuery: request.query.substring(0, 100),
          variationCount: queryVariations.length,
          totalResults: finalResults.length,
        });
      } else {
        // Use results from single query (or first variation)
        finalResults = allResults[0]?.results || [];
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
          
          finalResults = finalResults.filter((result: SearchResult) => {
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
            originalCount: finalResults.length,
            filteredCount: finalResults.length,
          });
        }
      } else if (request.startDate || request.endDate) {
        // Filter by custom date range
        const startDate = request.startDate ? new Date(request.startDate) : new Date(0);
        const endDate = request.endDate ? new Date(request.endDate) : new Date();
        
        const now = new Date();
        finalResults = finalResults.filter((result: SearchResult) => {
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
          originalCount: finalResults.length,
          filteredCount: finalResults.length,
        });
      }

      // Re-rank web results if enabled
      const enableWebResultReranking = request.enableWebResultReranking ?? false; // Default to false
      if (enableWebResultReranking && finalResults.length > 0) {
        const rerankingResult = WebResultRerankerService.rerankResults(
          finalResults,
          request.query,
          request.rerankingConfig
        );

        // Update final results with re-ranked results
        finalResults = rerankingResult.results;

        logger.info('Web results re-ranked', {
          originalQuery: request.query.substring(0, 100),
          originalCount: rerankingResult.originalCount,
          rerankedCount: finalResults.length,
          rerankingTimeMs: rerankingResult.rerankingTimeMs,
        });
      }

      // Quality scoring and filtering if enabled
      const enableQualityScoring = request.enableQualityScoring ?? false; // Default to false
      const filterByQuality = request.filterByQuality ?? false; // Default to false
      const minQualityScore = request.minQualityScore ?? 0.5; // Default threshold
      
      if (enableQualityScoring && finalResults.length > 0) {
        const startTime = Date.now();
        
        if (filterByQuality) {
          // Filter results by quality threshold
          const beforeCount = finalResults.length;
          finalResults = ResultQualityScorerService.filterByQuality(
            finalResults,
            minQualityScore,
            request.qualityScoringConfig
          );
          
          logger.info('Results filtered by quality', {
            originalQuery: request.query.substring(0, 100),
            beforeCount,
            afterCount: finalResults.length,
            minQualityScore,
            filteringTimeMs: Date.now() - startTime,
          });
        } else {
          // Sort by quality (but don't filter)
          finalResults = ResultQualityScorerService.sortByQuality(
            finalResults,
            request.qualityScoringConfig
          );
          
          logger.info('Results sorted by quality', {
            originalQuery: request.query.substring(0, 100),
            resultCount: finalResults.length,
            sortingTimeMs: Date.now() - startTime,
          });
        }
      }

      // Domain authority scoring and filtering if enabled
      const enableDomainAuthority = request.enableDomainAuthority ?? true; // Default to true
      const filterByAuthority = request.filterByAuthority ?? false; // Default to false
      const minAuthorityScore = request.minAuthorityScore ?? 0.5; // Default threshold
      const prioritizeAuthoritative = request.prioritizeAuthoritative ?? true; // Default to true
      
      if (enableDomainAuthority && finalResults.length > 0) {
        const startTime = Date.now();
        
        // Apply domain authority configuration if provided
        if (request.domainAuthorityConfig) {
          DomainAuthorityService.setConfig(request.domainAuthorityConfig);
        }
        
        if (filterByAuthority) {
          // Filter results by authority threshold
          const beforeCount = finalResults.length;
          finalResults = DomainAuthorityService.filterByAuthority(
            finalResults,
            minAuthorityScore
          );
          
          logger.info('Results filtered by domain authority', {
            originalQuery: request.query.substring(0, 100),
            beforeCount,
            afterCount: finalResults.length,
            minAuthorityScore,
            filteringTimeMs: Date.now() - startTime,
          });
        }
        
        if (prioritizeAuthoritative) {
          // Sort by domain authority (prioritize authoritative sources)
          const baseScores = finalResults.map(r => r.score || 0.5);
          finalResults = DomainAuthorityService.sortByAuthority(finalResults, baseScores);
          
          logger.info('Results prioritized by domain authority', {
            originalQuery: request.query.substring(0, 100),
            resultCount: finalResults.length,
            sortingTimeMs: Date.now() - startTime,
          });
        }
        
        // Log authority statistics
        const authorityStats = DomainAuthorityService.getAuthorityStatistics(finalResults);
        logger.info('Domain authority statistics', {
          originalQuery: request.query.substring(0, 100),
          ...authorityStats,
        });
        
        // Apply authority scoring to result scores
        const scoredResults = DomainAuthorityService.scoreResultsWithAuthority(
          finalResults,
          finalResults.map(r => r.score || 0.5)
        );
        
        // Update results with authority-adjusted scores
        finalResults = scoredResults.map(({ result, score, authorityScore }) => ({
          ...result,
          score: score, // Authority-adjusted score
        }));
      }

      // Web result deduplication if enabled
      const enableDeduplication = request.enableDeduplication ?? true; // Default to true
      
      if (enableDeduplication && finalResults.length > 1) {
        const startTime = Date.now();
        
        const deduplicationResult = WebDeduplicationService.deduplicate(
          finalResults,
          request.deduplicationOptions
        );
        
        finalResults = deduplicationResult.results;
        
        logger.info('Web results deduplicated', {
          originalQuery: request.query.substring(0, 100),
          originalCount: deduplicationResult.stats.originalCount,
          deduplicatedCount: deduplicationResult.stats.deduplicatedCount,
          urlDuplicatesRemoved: deduplicationResult.stats.urlDuplicatesRemoved,
          contentDuplicatesRemoved: deduplicationResult.stats.contentDuplicatesRemoved,
          totalRemoved: deduplicationResult.stats.totalRemoved,
          processingTimeMs: deduplicationResult.stats.processingTimeMs,
          performanceWarning: deduplicationResult.stats.performanceWarning,
        });
        
        if (deduplicationResult.stats.performanceWarning) {
          logger.warn('Deduplication exceeded target time', {
            processingTimeMs: deduplicationResult.stats.processingTimeMs,
            targetTime: 150,
          });
        }
      }

      // Apply filtering strategy (replaces old hard filtering)
      const filteringMode = request.filteringMode || 'moderate'; // Default to moderate
      const enableFilteringABTesting = request.enableFilteringABTesting ?? false;
      
      if (finalResults.length > 0) {
        const startTime = Date.now();
        
        // Calculate cutoff date for time range filtering
        let cutoffDate: Date | null = null;
        let isStrict = false;
        
        if (request.timeRange && !request.startDate && !request.endDate) {
          const now = new Date();
          switch (request.timeRange) {
            case 'day':
            case 'd':
              cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              isStrict = true;
              break;
            case 'week':
            case 'w':
              cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
            case 'm':
              cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
            case 'year':
            case 'y':
              cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
              break;
          }
        } else if (request.startDate || request.endDate) {
          cutoffDate = request.startDate ? new Date(request.startDate) : new Date(0);
        }

        // Apply filtering strategy
        const filteringOptions: FilteringOptions = {
          mode: filteringMode,
          strategy: request.filteringStrategy,
          userId: request.userId,
          enableABTesting: enableFilteringABTesting,
        };

        const filteringResult = FilteringStrategyService.applyFilteringStrategy(
          finalResults,
          filteringOptions
        );

        // Apply contextual filtering (time range and topic)
        if (cutoffDate !== null || request.topic) {
          const strategy = request.filteringStrategy || 
            (enableFilteringABTesting && request.userId 
              ? selectFilteringVariant(request.userId, getFilteringABTestConfig())
              : getFilteringStrategy(filteringMode));

          // Convert to FilteringResult format for contextual filtering
          let filteringResults = filteringResult.results.map(r => ({
            ...r,
            originalScore: r.score,
            filteringScore: r.score || 0.5,
          }));

          filteringResults = FilteringStrategyService.applyContextualFiltering(
            filteringResults,
            strategy,
            {
              cutoffDate,
              isStrict,
              topic: request.topic,
            }
          );

          // Convert back to SearchResult
          finalResults = filteringResults.map(r => ({
            ...r,
            score: r.filteringScore || r.originalScore || r.score,
          }));
        } else {
          finalResults = filteringResult.results;
        }

        logger.info('Filtering strategy applied', {
          originalQuery: request.query.substring(0, 100),
          mode: filteringMode,
          originalCount: filteringResult.stats.originalCount,
          filteredCount: filteringResult.stats.filteredCount,
          hardFilteredCount: filteringResult.stats.hardFilteredCount,
          rankingAdjustedCount: filteringResult.stats.rankingAdjustedCount,
          diversityFilteredCount: filteringResult.stats.diversityFilteredCount,
          processingTimeMs: filteringResult.stats.processingTimeMs,
        });
      }

      const searchResponse: SearchResponse = {
        query: request.query,
        results: finalResults,
        topic: request.topic,
        timeRange: request.timeRange,
        country: request.country,
        cached: false,
      };

      // Cache the results in Redis (with automatic fallback if Redis unavailable)
      await RedisCacheService.set(cacheKey, searchResponse, {
        prefix: CACHE_PREFIX,
        ttl: CACHE_TTL,
      });

      logger.info('Search completed', {
        query: request.query,
        resultsCount: finalResults.length,
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
