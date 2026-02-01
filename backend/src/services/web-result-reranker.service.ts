/**
 * Web Result Re-ranker Service
 * Re-ranks web search results based on domain authority, freshness, and relevance
 */

import logger from '../config/logger';
import { SearchResult } from './search.service';

export interface RerankingConfig {
  // Weight factors (0-1, should sum to ~1.0)
  relevanceWeight?: number; // Weight for relevance score (default: 0.4)
  domainAuthorityWeight?: number; // Weight for domain authority (default: 0.3)
  freshnessWeight?: number; // Weight for freshness (default: 0.2)
  originalScoreWeight?: number; // Weight for original Tavily score (default: 0.1)
  // Domain authority settings
  trustedDomains?: string[]; // List of trusted domains (e.g., ['wikipedia.org', 'edu', 'gov'])
  domainAuthorityBoost?: number; // Boost factor for trusted domains (default: 1.2)
  // Freshness settings
  freshnessDecayDays?: number; // Days for freshness decay (default: 365)
  maxFreshnessBoost?: number; // Maximum freshness boost (default: 1.3)
  // Relevance settings
  titleMatchWeight?: number; // Weight for title matches (default: 0.6)
  contentMatchWeight?: number; // Weight for content matches (default: 0.4)
}

export interface RerankedResult extends SearchResult {
  rerankedScore: number; // Final re-ranked score
  relevanceScore?: number; // Relevance score component
  domainAuthorityScore?: number; // Domain authority score component
  freshnessScore?: number; // Freshness score component
  rankingFactors?: {
    relevance: number;
    domainAuthority: number;
    freshness: number;
    originalScore: number;
  };
}

export interface RerankingResult {
  results: RerankedResult[];
  originalCount: number;
  rerankingTimeMs: number;
}

/**
 * Default re-ranking configuration
 */
export const DEFAULT_RERANKING_CONFIG: Required<Omit<RerankingConfig, 'trustedDomains'>> & {
  trustedDomains: string[];
} = {
  relevanceWeight: 0.4,
  domainAuthorityWeight: 0.3,
  freshnessWeight: 0.2,
  originalScoreWeight: 0.1,
  trustedDomains: [
    'wikipedia.org',
    'edu',
    'gov',
    'org',
    'ac.uk',
    'edu.au',
    'nih.gov',
    'nature.com',
    'science.org',
    'ieee.org',
    'acm.org',
  ],
  domainAuthorityBoost: 1.2,
  freshnessDecayDays: 365,
  maxFreshnessBoost: 1.3,
  titleMatchWeight: 0.6,
  contentMatchWeight: 0.4,
};

/**
 * Web Result Re-ranker Service
 */
export class WebResultRerankerService {
  private static config: Required<Omit<RerankingConfig, 'trustedDomains'>> & {
    trustedDomains: string[];
  } = DEFAULT_RERANKING_CONFIG;

  /**
   * Set re-ranking configuration
   */
  static setConfig(config: Partial<RerankingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      trustedDomains: config.trustedDomains || this.config.trustedDomains,
    };
    logger.info('Web result re-ranking configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  static getConfig(): Required<Omit<RerankingConfig, 'trustedDomains'>> & {
    trustedDomains: string[];
  } {
    return { ...this.config };
  }

  /**
   * Extract domain from URL
   */
  private static extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      // Remove www. prefix
      return hostname.replace(/^www\./, '');
    } catch (e) {
      // If URL parsing fails, try simple extraction
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      return match ? match[1].toLowerCase() : '';
    }
  }

  /**
   * Calculate domain authority score
   */
  private static calculateDomainAuthorityScore(url: string): number {
    const domain = this.extractDomain(url);
    if (!domain) {
      return 0.5; // Default score for invalid URLs
    }

    // Check if domain is in trusted domains list
    const isTrusted = this.config.trustedDomains.some(trusted => {
      // Exact match
      if (domain === trusted) {
        return true;
      }
      // Suffix match (e.g., 'edu' matches 'mit.edu')
      if (domain.endsWith(`.${trusted}`) || domain.endsWith(`-${trusted}`)) {
        return true;
      }
      // Contains trusted domain
      if (domain.includes(trusted)) {
        return true;
      }
      return false;
    });

    if (isTrusted) {
      return 1.0 * this.config.domainAuthorityBoost;
    }

    // Score based on domain characteristics
    let score = 0.5; // Base score

    // Boost for .edu, .gov, .org domains
    if (domain.endsWith('.edu') || domain.endsWith('.gov') || domain.endsWith('.org')) {
      score = 0.8;
    }

    // Boost for .ac.uk, .edu.au (academic domains)
    if (domain.endsWith('.ac.uk') || domain.endsWith('.edu.au')) {
      score = 0.9;
    }

    // Penalize suspicious domains
    if (domain.includes('blogspot') || domain.includes('wordpress') || domain.includes('tumblr')) {
      score = Math.min(score, 0.6);
    }

    // Normalize to 0-1 range
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Calculate freshness score
   */
  private static calculateFreshnessScore(publishedDate?: string): number {
    if (!publishedDate) {
      return 0.5; // Default score if no date available
    }

    try {
      const published = new Date(publishedDate);
      const now = new Date();
      
      // Check if date is valid
      if (isNaN(published.getTime())) {
        return 0.5; // Default score for invalid dates
      }
      
      const daysDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

      // Exclude future dates
      if (isNaN(daysDiff) || daysDiff < 0) {
        return 0.3; // Penalize future dates or invalid calculations
      }

      // Calculate freshness score with decay
      const decayDays = this.config.freshnessDecayDays;
      const maxBoost = this.config.maxFreshnessBoost;

      if (daysDiff <= 7) {
        // Very recent (last week): maximum boost
        return 1.0 * maxBoost;
      } else if (daysDiff <= 30) {
        // Recent (last month): high boost
        return 0.9 * maxBoost;
      } else if (daysDiff <= 90) {
        // Recent (last 3 months): moderate boost
        return 0.8 * maxBoost;
      } else if (daysDiff <= 180) {
        // Somewhat recent (last 6 months): slight boost
        return 0.7 * maxBoost;
      } else if (daysDiff <= 365) {
        // Within year: neutral
        return 1.0;
      } else {
        // Older: decay
        const decayFactor = Math.max(0.3, 1.0 - (daysDiff - 365) / (decayDays - 365));
        return decayFactor;
      }
    } catch (e) {
      logger.warn('Failed to parse published date for freshness scoring', {
        publishedDate,
        error: e,
      });
      return 0.5; // Default score on error
    }
  }

  /**
   * Calculate relevance score based on query matching
   */
  private static calculateRelevanceScore(
    result: SearchResult,
    query: string
  ): number {
    const queryLower = query.toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const contentLower = (result.content || '').toLowerCase();

    // Extract query keywords
    const queryKeywords = queryLower
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .map(word => word.replace(/[^\w]/g, ''));

    if (queryKeywords.length === 0) {
      return 0.5; // Default score if no keywords
    }

    // Calculate title match score
    let titleScore = 0;
    let titleMatches = 0;
    for (const keyword of queryKeywords) {
      if (titleLower.includes(keyword)) {
        titleMatches++;
        // Boost for exact phrase match
        if (titleLower.includes(queryLower)) {
          titleScore += 2;
        } else {
          titleScore += 1;
        }
      }
    }
    titleScore = titleMatches > 0 ? titleScore / queryKeywords.length : 0;

    // Calculate content match score
    let contentScore = 0;
    let contentMatches = 0;
    for (const keyword of queryKeywords) {
      if (contentLower.includes(keyword)) {
        contentMatches++;
        contentScore += 1;
      }
    }
    contentScore = contentMatches > 0 ? contentScore / queryKeywords.length : 0;

    // Combine title and content scores
    const relevanceScore =
      titleScore * this.config.titleMatchWeight +
      contentScore * this.config.contentMatchWeight;

    // Normalize to 0-1 range
    return Math.min(1.0, Math.max(0.0, relevanceScore));
  }

  /**
   * Re-rank web search results
   */
  static rerankResults(
    results: SearchResult[],
    query: string,
    config?: Partial<RerankingConfig>
  ): RerankingResult {
    const startTime = Date.now();
    const rerankingConfig = config
      ? { ...this.config, ...config, trustedDomains: config.trustedDomains || this.config.trustedDomains }
      : this.config;

    if (!results || results.length === 0) {
      return {
        results: [],
        originalCount: 0,
        rerankingTimeMs: Date.now() - startTime,
      };
    }

    // Calculate scores for each result
    const reranked: RerankedResult[] = results.map(result => {
      // Calculate component scores
      const relevanceScore = this.calculateRelevanceScore(result, query);
      const domainAuthorityScore = this.calculateDomainAuthorityScore(result.url);
      const freshnessScore = this.calculateFreshnessScore(result.publishedDate);
      const originalScore = result.score || 0.5; // Default to 0.5 if no score

      // Normalize original score to 0-1 range (assuming Tavily scores are 0-1)
      const normalizedOriginalScore = Math.min(1.0, Math.max(0.0, originalScore));

      // Calculate weighted combined score
      const rerankedScore =
        relevanceScore * rerankingConfig.relevanceWeight +
        domainAuthorityScore * rerankingConfig.domainAuthorityWeight +
        freshnessScore * rerankingConfig.freshnessWeight +
        normalizedOriginalScore * rerankingConfig.originalScoreWeight;

      return {
        ...result,
        rerankedScore,
        relevanceScore: relevanceScore,
        domainAuthorityScore: domainAuthorityScore,
        freshnessScore: freshnessScore,
        rankingFactors: {
          relevance: relevanceScore,
          domainAuthority: domainAuthorityScore,
          freshness: freshnessScore,
          originalScore: normalizedOriginalScore,
        },
      };
    });

    // Sort by re-ranked score (descending)
    reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);

    const rerankingTimeMs = Date.now() - startTime;

    logger.info('Web results re-ranked', {
      originalCount: results.length,
      rerankedCount: reranked.length,
      rerankingTimeMs,
      query: query.substring(0, 100),
    });

    return {
      results: reranked,
      originalCount: results.length,
      rerankingTimeMs,
    };
  }

  /**
   * Quick re-rank (simplified version)
   */
  static quickRerank(results: SearchResult[], query: string): RerankedResult[] {
    const result = this.rerankResults(results, query);
    return result.results;
  }
}
