/**
 * Filtering Strategy Service
 * Implements configurable filtering strategies with ranking-based penalties
 * Supports strict, moderate, and lenient filtering modes
 */

import logger from '../config/logger';
import { SearchResult } from './search.service';
import {
  FilteringStrategy,
  FilteringMode,
  getFilteringStrategy,
  selectFilteringVariant,
  getFilteringABTestConfig,
} from '../config/filtering.config';
import { ResultQualityScorerService } from './result-quality-scorer.service';
import { DomainAuthorityService } from './domain-authority.service';

export interface FilteringResult extends SearchResult {
  originalScore?: number; // Original score before filtering adjustments
  filteringPenalties?: {
    timeRange?: number;
    topic?: number;
    quality?: number;
    authority?: number;
  };
  filteringScore?: number; // Final score after filtering adjustments
}

export interface FilteringStats {
  originalCount: number;
  filteredCount: number;
  hardFilteredCount: number;
  rankingAdjustedCount: number;
  diversityFilteredCount: number;
  processingTimeMs: number;
  strategy: FilteringMode;
}

export interface FilteringOptions {
  strategy?: FilteringStrategy;
  mode?: FilteringMode;
  userId?: string; // For A/B testing
  enableABTesting?: boolean;
}

/**
 * Filtering Strategy Service
 */
export class FilteringStrategyService {
  /**
   * Extract domain from URL
   */
  private static extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      return match ? match[1].toLowerCase() : '';
    }
  }

  /**
   * Calculate topic match score
   */
  private static calculateTopicMatchScore(
    result: SearchResult,
    topic: string
  ): number {
    if (!topic) {
      return 1.0; // No topic = perfect match
    }

    const topicLower = topic.toLowerCase().trim();
    const topicWords = topicLower.split(/\s+/).filter(w => w.length >= 2);
    const titleLower = (result.title || '').toLowerCase();
    const contentLower = (result.content || '').toLowerCase();
    const combinedText = `${titleLower} ${contentLower}`;

    if (topicWords.length === 0) {
      return 1.0;
    }

    // Check for exact phrase match
    if (combinedText.includes(topicLower)) {
      return 1.0;
    }

    // Check for all significant words
    const significantWords = topicWords.filter(w => w.length >= 2);
    if (significantWords.length > 0) {
      const matchedWords = significantWords.filter(word => combinedText.includes(word));
      return matchedWords.length / significantWords.length;
    }

    return 0.0;
  }

  /**
   * Calculate time range score
   */
  private static calculateTimeRangeScore(
    result: SearchResult,
    cutoffDate: Date | null,
    isStrict: boolean
  ): number {
    if (!cutoffDate) {
      return 1.0; // No time range = perfect score
    }

    const now = new Date();
    let score = 1.0;

    // Check publishedDate
    if (result.publishedDate) {
      try {
        const publishedDate = new Date(result.publishedDate);
        
        if (publishedDate > now) {
          return 0.0; // Future dates always get 0
        }

        if (publishedDate >= cutoffDate) {
          return 1.0; // Within range
        }

        // Outside range - calculate penalty based on how far outside
        const daysDiff = (cutoffDate.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        const penalty = Math.min(0.8, daysDiff / 365); // Max 80% penalty
        score = 1.0 - penalty;
      } catch (e) {
        // Invalid date - apply penalty
        score = 0.5;
      }
    } else {
      // No publishedDate - apply penalty
      if (isStrict) {
        score = 0.3; // Heavy penalty in strict mode
      } else {
        score = 0.6; // Moderate penalty
      }
    }

    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Apply time range filtering/ranking
   */
  private static applyTimeRangeFiltering(
    results: SearchResult[],
    strategy: FilteringStrategy,
    cutoffDate: Date | null,
    isStrict: boolean
  ): FilteringResult[] {
    if (!strategy.timeRangeFiltering.enabled || !cutoffDate) {
      return results.map(r => ({ ...r, filteringScore: r.score || 0.5 }));
    }

    const threshold = strategy.timeRangeFiltering[strategy.mode === 'strict' ? 'strictThreshold' : 
                                                   strategy.mode === 'moderate' ? 'moderateThreshold' : 
                                                   'lenientThreshold'];

    return results.map(result => {
      const timeScore = this.calculateTimeRangeScore(result, cutoffDate, isStrict);
      const originalScore = result.score || 0.5;
      let filteringScore = originalScore;
      let penalty = 0;

      if (strategy.timeRangeFiltering.useHardFilter) {
        // Hard filter: exclude if below threshold
        if (timeScore < threshold) {
          return null; // Will be filtered out
        }
      } else {
        // Ranking penalty: apply penalty if below threshold
        if (timeScore < threshold) {
          penalty = strategy.timeRangeFiltering.rankingPenalty;
          filteringScore = originalScore * (1 - penalty);
        }
      }

      return {
        ...result,
        originalScore,
        filteringPenalties: { timeRange: penalty },
        filteringScore,
      };
    }).filter((r): r is FilteringResult => r !== null);
  }

  /**
   * Apply topic filtering/ranking
   */
  private static applyTopicFiltering(
    results: FilteringResult[],
    strategy: FilteringStrategy,
    topic: string | undefined
  ): FilteringResult[] {
    if (!strategy.topicFiltering.enabled || !topic) {
      return results;
    }

    const threshold = strategy.topicFiltering[strategy.mode === 'strict' ? 'strictThreshold' : 
                                              strategy.mode === 'moderate' ? 'moderateThreshold' : 
                                              'lenientThreshold'];

    return results.map(result => {
      const topicScore = this.calculateTopicMatchScore(result, topic);
      const currentScore = result.filteringScore || result.originalScore || result.score || 0.5;
      let filteringScore = currentScore;
      let penalty = result.filteringPenalties?.topic || 0;

      if (strategy.topicFiltering.useHardFilter) {
        // Hard filter: exclude if below threshold
        if (topicScore < threshold) {
          return null;
        }
      } else {
        // Ranking penalty: apply penalty if below threshold
        if (topicScore < threshold) {
          penalty = strategy.topicFiltering.rankingPenalty;
          filteringScore = currentScore * (1 - penalty);
        }
      }

      return {
        ...result,
        filteringPenalties: {
          ...result.filteringPenalties,
          topic: penalty,
        },
        filteringScore,
      };
    }).filter((r): r is FilteringResult => r !== null);
  }

  /**
   * Apply quality filtering/ranking
   */
  private static applyQualityFiltering(
    results: FilteringResult[],
    strategy: FilteringStrategy
  ): FilteringResult[] {
    if (!strategy.qualityFiltering.enabled) {
      return results;
    }

    const threshold = strategy.qualityFiltering[strategy.mode === 'strict' ? 'strictThreshold' : 
                                                 strategy.mode === 'moderate' ? 'moderateThreshold' : 
                                                 'lenientThreshold'];

    return results.map(result => {
      const qualityScore = ResultQualityScorerService.scoreResult(result);
      const qualityValue = qualityScore.overallScore;
      const currentScore = result.filteringScore || result.originalScore || result.score || 0.5;
      let filteringScore = currentScore;
      let penalty = result.filteringPenalties?.quality || 0;

      if (strategy.qualityFiltering.useHardFilter) {
        // Hard filter: exclude if below threshold
        if (qualityValue < threshold) {
          return null;
        }
      } else {
        // Ranking penalty: apply penalty if below threshold
        if (qualityValue < threshold) {
          penalty = strategy.qualityFiltering.rankingPenalty;
          filteringScore = currentScore * (1 - penalty);
        }
      }

      return {
        ...result,
        filteringPenalties: {
          ...result.filteringPenalties,
          quality: penalty,
        },
        filteringScore,
      };
    }).filter((r): r is FilteringResult => r !== null);
  }

  /**
   * Apply authority filtering/ranking
   */
  private static applyAuthorityFiltering(
    results: FilteringResult[],
    strategy: FilteringStrategy
  ): FilteringResult[] {
    if (!strategy.authorityFiltering.enabled) {
      return results;
    }

    const threshold = strategy.authorityFiltering[strategy.mode === 'strict' ? 'strictThreshold' : 
                                                  strategy.mode === 'moderate' ? 'moderateThreshold' : 
                                                  'lenientThreshold'];

    return results.map(result => {
      const authorityScore = DomainAuthorityService.getDomainAuthorityScore(result.url);
      const authorityValue = authorityScore.score;
      const currentScore = result.filteringScore || result.originalScore || result.score || 0.5;
      let filteringScore = currentScore;
      let penalty = result.filteringPenalties?.authority || 0;

      if (strategy.authorityFiltering.useHardFilter) {
        // Hard filter: exclude if below threshold
        if (authorityValue < threshold) {
          return null;
        }
      } else {
        // Ranking penalty: apply penalty if below threshold
        if (authorityValue < threshold) {
          penalty = strategy.authorityFiltering.rankingPenalty;
          filteringScore = currentScore * (1 - penalty);
        }
      }

      return {
        ...result,
        filteringPenalties: {
          ...result.filteringPenalties,
          authority: penalty,
        },
        filteringScore,
      };
    }).filter((r): r is FilteringResult => r !== null);
  }

  /**
   * Apply diversity filtering
   */
  private static applyDiversityFiltering(
    results: FilteringResult[],
    strategy: FilteringStrategy
  ): FilteringResult[] {
    if (!strategy.diversity.enabled) {
      return results;
    }

    const domainCounts = new Map<string, number>();
    const domainResults = new Map<string, FilteringResult[]>();

    // Group results by domain
    for (const result of results) {
      const domain = this.extractDomain(result.url);
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      
      if (!domainResults.has(domain)) {
        domainResults.set(domain, []);
      }
      domainResults.get(domain)!.push(result);
    }

    // Filter results per domain
    const filtered: FilteringResult[] = [];
    const maxPerDomain = strategy.diversity.maxResultsPerDomain;

    // Sort results by filtering score (descending)
    const sorted = [...results].sort((a, b) => 
      (b.filteringScore || b.score || 0) - (a.filteringScore || a.score || 0)
    );

    const domainAdded = new Map<string, number>();

    for (const result of sorted) {
      const domain = this.extractDomain(result.url);
      const added = domainAdded.get(domain) || 0;

      if (added < maxPerDomain) {
        filtered.push(result);
        domainAdded.set(domain, added + 1);
      }
    }

    // Check minimum domain diversity
    const uniqueDomains = new Set(filtered.map(r => this.extractDomain(r.url)));
    const diversityRatio = uniqueDomains.size / Math.max(1, filtered.length);
    const minDiversity = strategy.diversity.minDomainDiversity;

    if (diversityRatio < minDiversity && filtered.length > 0) {
      // Add more diverse results if needed
      const remaining = results.filter(r => !filtered.includes(r));
      const needed = Math.ceil(filtered.length * minDiversity) - uniqueDomains.size;

      for (const result of remaining) {
        if (needed <= 0) break;
        const domain = this.extractDomain(result.url);
        if (!uniqueDomains.has(domain)) {
          filtered.push(result);
          uniqueDomains.add(domain);
          needed--;
        }
      }
    }

    return filtered;
  }

  /**
   * Apply filtering strategy to search results
   */
  static applyFilteringStrategy(
    results: SearchResult[],
    options: FilteringOptions = {}
  ): {
    results: SearchResult[];
    stats: FilteringStats;
  } {
    const startTime = Date.now();

    if (!results || results.length === 0) {
      return {
        results: [],
        stats: {
          originalCount: 0,
          filteredCount: 0,
          hardFilteredCount: 0,
          rankingAdjustedCount: 0,
          diversityFilteredCount: 0,
          processingTimeMs: Date.now() - startTime,
          strategy: 'moderate',
        },
      };
    }

    // Determine strategy
    let strategy: FilteringStrategy;
    if (options.strategy) {
      strategy = options.strategy;
    } else if (options.mode) {
      strategy = getFilteringStrategy(options.mode);
    } else if (options.enableABTesting && options.userId) {
      const abConfig = getFilteringABTestConfig();
      strategy = selectFilteringVariant(options.userId, abConfig);
    } else {
      strategy = getFilteringStrategy('moderate');
    }

    let filtered: FilteringResult[] = results.map(r => ({
      ...r,
      originalScore: r.score,
      filteringScore: r.score || 0.5,
    }));

    const originalCount = filtered.length;
    let hardFilteredCount = 0;
    let rankingAdjustedCount = 0;

    // Apply filtering stages (order matters)
    // Note: Time range and topic filtering need additional context
    // These will be applied in search.service.ts with proper context

    // Apply quality filtering
    const beforeQuality = filtered.length;
    filtered = this.applyQualityFiltering(filtered, strategy);
    hardFilteredCount += beforeQuality - filtered.length;
    rankingAdjustedCount += filtered.filter(r => 
      (r.filteringPenalties?.quality || 0) > 0
    ).length;

    // Apply authority filtering
    const beforeAuthority = filtered.length;
    filtered = this.applyAuthorityFiltering(filtered, strategy);
    hardFilteredCount += beforeAuthority - filtered.length;
    rankingAdjustedCount += filtered.filter(r => 
      (r.filteringPenalties?.authority || 0) > 0
    ).length;

    // Apply diversity filtering
    const beforeDiversity = filtered.length;
    filtered = this.applyDiversityFiltering(filtered, strategy);
    const diversityFilteredCount = beforeDiversity - filtered.length;

    // Sort by filtering score
    filtered.sort((a, b) => 
      (b.filteringScore || b.score || 0) - (a.filteringScore || a.score || 0)
    );

    // Convert back to SearchResult format
    const finalResults: SearchResult[] = filtered.map(r => ({
      ...r,
      score: r.filteringScore || r.originalScore || r.score,
    }));

    const processingTimeMs = Date.now() - startTime;

    logger.debug('Filtering strategy applied', {
      strategy: strategy.mode,
      originalCount,
      filteredCount: finalResults.length,
      hardFilteredCount,
      rankingAdjustedCount,
      diversityFilteredCount,
      processingTimeMs,
    });

    return {
      results: finalResults,
      stats: {
        originalCount,
        filteredCount: finalResults.length,
        hardFilteredCount,
        rankingAdjustedCount,
        diversityFilteredCount,
        processingTimeMs,
        strategy: strategy.mode,
      },
    };
  }

  /**
   * Apply time range and topic filtering (called from search service with context)
   */
  static applyContextualFiltering(
    results: FilteringResult[],
    strategy: FilteringStrategy,
    options: {
      cutoffDate?: Date | null;
      isStrict?: boolean;
      topic?: string;
    }
  ): FilteringResult[] {
    let filtered = results;

    // Apply time range filtering
    if (options.cutoffDate !== undefined) {
      const beforeTime = filtered.length;
      filtered = this.applyTimeRangeFiltering(
        filtered,
        strategy,
        options.cutoffDate,
        options.isStrict || false
      );
    }

    // Apply topic filtering
    if (options.topic !== undefined) {
      filtered = this.applyTopicFiltering(filtered, strategy, options.topic);
    }

    return filtered;
  }
}
