/**
 * Domain Authority Service
 * Scores domains based on authoritative domain database and patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../config/logger';
import { SearchResult } from './search.service';

export interface DomainAuthorityEntry {
  authorityScore: number; // 0-100
  category: string; // tech, news, academic, government, etc.
  tier: string; // tier1, tier2, tier3
  description: string;
}

export interface DomainPattern {
  authorityScore: number;
  category: string;
  tier: string;
  description: string;
  pattern: string; // Regex pattern
}

export interface AuthoritativeDomainsData {
  version: string;
  lastUpdated: string;
  domains: Record<string, DomainAuthorityEntry>;
  domainPatterns: Record<string, DomainPattern>;
  categoryWeights: Record<string, number>;
}

export interface DomainAuthorityScore {
  score: number; // Normalized score 0-1
  rawScore: number; // Raw authority score 0-100
  category?: string;
  tier?: string;
  source: 'exact' | 'pattern' | 'tld' | 'default'; // How the score was determined
  matchedDomain?: string; // Matched domain or pattern
}

export interface DomainAuthorityConfig {
  // Weight for domain authority in search ranking (0-1)
  authorityWeight?: number; // Default: 0.3
  // Minimum authority score to boost (0-1)
  minAuthorityScore?: number; // Default: 0.5
  // Boost factor for high-authority domains
  highAuthorityBoost?: number; // Default: 1.2
  // Penalty factor for low-authority domains
  lowAuthorityPenalty?: number; // Default: 0.9
  // Enable domain authority scoring
  enabled?: boolean; // Default: true
  // Custom domain overrides (domain -> score)
  customDomainScores?: Record<string, number>;
}

/**
 * Default domain authority configuration
 */
export const DEFAULT_DOMAIN_AUTHORITY_CONFIG: Required<Omit<DomainAuthorityConfig, 'customDomainScores'>> & {
  customDomainScores: Record<string, number>;
} = {
  authorityWeight: 0.3,
  minAuthorityScore: 0.5,
  highAuthorityBoost: 1.2,
  lowAuthorityPenalty: 0.9,
  enabled: true,
  customDomainScores: {},
};

/**
 * Domain Authority Service
 */
export class DomainAuthorityService {
  private static authoritativeDomains: AuthoritativeDomainsData | null = null;
  private static config: Required<Omit<DomainAuthorityConfig, 'customDomainScores'>> & {
    customDomainScores: Record<string, number>;
  } = DEFAULT_DOMAIN_AUTHORITY_CONFIG;

  /**
   * Load authoritative domains database
   */
  private static loadAuthoritativeDomains(): AuthoritativeDomainsData {
    if (this.authoritativeDomains) {
      return this.authoritativeDomains;
    }

    try {
      const dataPath = path.join(__dirname, '../data/authoritative-domains.json');
      const data = fs.readFileSync(dataPath, 'utf-8');
      this.authoritativeDomains = JSON.parse(data) as AuthoritativeDomainsData;
      
      logger.info('Authoritative domains database loaded', {
        version: this.authoritativeDomains.version,
        lastUpdated: this.authoritativeDomains.lastUpdated,
        domainCount: Object.keys(this.authoritativeDomains.domains).length,
        patternCount: Object.keys(this.authoritativeDomains.domainPatterns).length,
      });
      
      return this.authoritativeDomains;
    } catch (error: any) {
      logger.error('Failed to load authoritative domains database', {
        error: error.message,
        path: path.join(__dirname, '../data/authoritative-domains.json'),
      });
      
      // Return empty database as fallback
      return {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        domains: {},
        domainPatterns: {},
        categoryWeights: { default: 0.5 },
      };
    }
  }

  /**
   * Reload authoritative domains database
   */
  static reloadAuthoritativeDomains(): void {
    this.authoritativeDomains = null;
    this.loadAuthoritativeDomains();
    logger.info('Authoritative domains database reloaded');
  }

  /**
   * Set domain authority configuration
   */
  static setConfig(config: Partial<DomainAuthorityConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      customDomainScores: config.customDomainScores || this.config.customDomainScores,
    };
    logger.info('Domain authority configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  static getConfig(): Required<Omit<DomainAuthorityConfig, 'customDomainScores'>> & {
    customDomainScores: Record<string, number>;
  } {
    return { ...this.config };
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string {
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
   * Get domain authority score for a URL
   */
  static getDomainAuthorityScore(url: string): DomainAuthorityScore {
    if (!this.config.enabled) {
      return {
        score: 0.5,
        rawScore: 50,
        source: 'default',
      };
    }

    const domain = this.extractDomain(url);
    if (!domain) {
      return {
        score: 0.5,
        rawScore: 50,
        source: 'default',
      };
    }

    // Check custom domain scores first
    if (this.config.customDomainScores[domain]) {
      const rawScore = this.config.customDomainScores[domain];
      return {
        score: rawScore / 100,
        rawScore,
        source: 'exact',
        matchedDomain: domain,
      };
    }

    const db = this.loadAuthoritativeDomains();

    // Check exact domain match
    if (db.domains[domain]) {
      const entry = db.domains[domain];
      const tierWeight = db.categoryWeights[entry.tier] || db.categoryWeights.default;
      const normalizedScore = (entry.authorityScore / 100) * tierWeight;
      
      return {
        score: normalizedScore,
        rawScore: entry.authorityScore,
        category: entry.category,
        tier: entry.tier,
        source: 'exact',
        matchedDomain: domain,
      };
    }

    // Check domain patterns (e.g., .edu, .gov)
    for (const [patternName, pattern] of Object.entries(db.domainPatterns)) {
      const regex = new RegExp(pattern.pattern);
      if (regex.test(domain)) {
        const tierWeight = db.categoryWeights[pattern.tier] || db.categoryWeights.default;
        const normalizedScore = (pattern.authorityScore / 100) * tierWeight;
        
        return {
          score: normalizedScore,
          rawScore: pattern.authorityScore,
          category: pattern.category,
          tier: pattern.tier,
          source: 'pattern',
          matchedDomain: patternName,
        };
      }
    }

    // Check TLD-based scoring (fallback)
    const tld = domain.split('.').pop() || '';
    if (tld === 'edu' || tld === 'gov' || tld === 'org') {
      const tldScores: Record<string, number> = {
        edu: 85,
        gov: 90,
        org: 70,
      };
      const rawScore = tldScores[tld] || 50;
      
      return {
        score: rawScore / 100,
        rawScore,
        category: tld === 'edu' ? 'academic' : tld === 'gov' ? 'government' : 'organization',
        source: 'tld',
        matchedDomain: tld,
      };
    }

    // Default score for unknown domains
    return {
      score: 0.5,
      rawScore: 50,
      source: 'default',
    };
  }

  /**
   * Score a search result with domain authority
   */
  static scoreResultWithAuthority(
    result: SearchResult,
    baseScore: number = 0.5
  ): { score: number; authorityScore: DomainAuthorityScore } {
    const authorityScore = this.getDomainAuthorityScore(result.url);
    
    // Apply authority boost/penalty
    let finalScore = baseScore;
    
    if (authorityScore.score >= this.config.minAuthorityScore) {
      // High authority: apply boost
      finalScore = baseScore * this.config.highAuthorityBoost;
    } else if (authorityScore.score < 0.3) {
      // Low authority: apply penalty
      finalScore = baseScore * this.config.lowAuthorityPenalty;
    }
    
    // Normalize to 0-1 range
    finalScore = Math.min(1.0, Math.max(0.0, finalScore));
    
    return {
      score: finalScore,
      authorityScore,
    };
  }

  /**
   * Score multiple results with domain authority
   */
  static scoreResultsWithAuthority(
    results: SearchResult[],
    baseScores?: number[]
  ): Array<{ result: SearchResult; score: number; authorityScore: DomainAuthorityScore }> {
    return results.map((result, index) => {
      const baseScore = baseScores?.[index] ?? (result.score || 0.5);
      const scored = this.scoreResultWithAuthority(result, baseScore);
      return {
        result,
        score: scored.score,
        authorityScore: scored.authorityScore,
      };
    });
  }

  /**
   * Sort results by domain authority (prioritize authoritative sources)
   */
  static sortByAuthority(
    results: SearchResult[],
    baseScores?: number[]
  ): SearchResult[] {
    const scored = this.scoreResultsWithAuthority(results, baseScores);
    scored.sort((a, b) => {
      // First sort by authority score
      if (b.authorityScore.score !== a.authorityScore.score) {
        return b.authorityScore.score - a.authorityScore.score;
      }
      // Then by combined score
      return b.score - a.score;
    });
    return scored.map(item => item.result);
  }

  /**
   * Filter results by minimum authority score
   */
  static filterByAuthority(
    results: SearchResult[],
    minAuthorityScore: number = 0.5
  ): SearchResult[] {
    return results.filter(result => {
      const authorityScore = this.getDomainAuthorityScore(result.url);
      return authorityScore.score >= minAuthorityScore;
    });
  }

  /**
   * Get authority statistics for a set of results
   */
  static getAuthorityStatistics(results: SearchResult[]): {
    totalResults: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    defaultCount: number;
    averageAuthorityScore: number;
    categoryDistribution: Record<string, number>;
  } {
    const authorityScores = results.map(r => this.getDomainAuthorityScore(r.url));
    const tier1Count = authorityScores.filter(s => s.tier === 'tier1').length;
    const tier2Count = authorityScores.filter(s => s.tier === 'tier2').length;
    const tier3Count = authorityScores.filter(s => s.tier === 'tier3').length;
    const defaultCount = authorityScores.filter(s => !s.tier).length;
    
    const averageAuthorityScore = authorityScores.length > 0
      ? authorityScores.reduce((sum, s) => sum + s.score, 0) / authorityScores.length
      : 0;
    
    const categoryDistribution: Record<string, number> = {};
    authorityScores.forEach(score => {
      if (score.category) {
        categoryDistribution[score.category] = (categoryDistribution[score.category] || 0) + 1;
      }
    });
    
    return {
      totalResults: results.length,
      tier1Count,
      tier2Count,
      tier3Count,
      defaultCount,
      averageAuthorityScore,
      categoryDistribution,
    };
  }

  /**
   * Check if a domain is in the authoritative database
   */
  static isAuthoritativeDomain(url: string): boolean {
    const authorityScore = this.getDomainAuthorityScore(url);
    return authorityScore.source !== 'default' && authorityScore.score >= this.config.minAuthorityScore;
  }

  /**
   * Get all authoritative domains (for admin/debugging)
   */
  static getAllAuthoritativeDomains(): AuthoritativeDomainsData {
    return this.loadAuthoritativeDomains();
  }
}
