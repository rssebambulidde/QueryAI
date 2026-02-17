/**
 * Source Prioritization Service
 * Prioritizes sources (documents vs web) based on rules: recency, authority, relevance
 * Weights sources differently in context formatting
 */

import logger from '../config/logger';
import { SourcePrioritizerConfig } from '../config/thresholds.config';
import { RAGContext, DocumentContext } from './rag.service';
import { DomainAuthorityService } from './domain-authority.service';

export type SourceType = 'document' | 'web';

export interface PrioritizedSource {
  type: SourceType;
  priority: number; // Priority score (0-1, higher = more important)
  weight: number; // Weight in context (0-1, higher = more prominent)
  originalIndex: number; // Original index in array
  metadata: {
    relevanceScore?: number;
    authorityScore?: number;
    freshnessScore?: number;
    qualityScore?: number;
  };
}

export interface PrioritizedDocumentContext extends DocumentContext {
  priority: number;
  weight: number;
  metadata: {
    relevanceScore: number;
    authorityScore: number; // Documents have high authority (user's own docs)
    freshnessScore: number;
    qualityScore?: number;
  };
}

export interface PrioritizedWebResult {
  title: string;
  url: string;
  content: string;
  priority: number;
  weight: number;
  metadata: {
    relevanceScore?: number;
    authorityScore: number;
    freshnessScore: number;
    qualityScore?: number;
  };
}

export interface PrioritizedRAGContext {
  documentContexts: PrioritizedDocumentContext[];
  webSearchResults: PrioritizedWebResult[];
}

export interface PrioritizationRules {
  // Source type weights
  documentWeight: number; // Weight for document sources (0-1, default: 0.6)
  webWeight: number; // Weight for web sources (0-1, default: 0.4)
  // Prioritization factors
  relevanceWeight: number; // Weight for relevance score (0-1, default: 0.4)
  authorityWeight: number; // Weight for authority score (0-1, default: 0.3)
  recencyWeight: number; // Weight for recency/freshness (0-1, default: 0.2)
  qualityWeight: number; // Weight for quality score (0-1, default: 0.1)
  // Authority settings
  preferDocuments: boolean; // Prefer documents over web (default: true)
  preferAuthoritative: boolean; // Prefer authoritative web sources (default: true)
  preferRecent: boolean; // Prefer recent sources (default: true)
  // Recency settings
  recentThresholdDays: number; // Days considered "recent" (default: 30)
  recentBoost: number; // Boost factor for recent sources (default: 1.2)
  // Authority settings
  highAuthorityThreshold: number; // Authority score threshold for "high authority" (default: 0.7)
  highAuthorityBoost: number; // Boost factor for high authority (default: 1.3)
}

export interface PrioritizationOptions {
  rules?: Partial<PrioritizationRules>;
  query?: string; // Query for relevance context
}

export interface PrioritizationStats {
  documentCount: number;
  webResultCount: number;
  averageDocumentPriority: number;
  averageWebPriority: number;
  highPriorityDocuments: number;
  highPriorityWebResults: number;
  processingTimeMs: number;
}

/**
 * Default prioritization rules
 */
export const DEFAULT_PRIORITIZATION_RULES: PrioritizationRules = {
  documentWeight: SourcePrioritizerConfig.weights.document,
  webWeight: SourcePrioritizerConfig.weights.web,
  relevanceWeight: SourcePrioritizerConfig.weights.relevance,
  authorityWeight: SourcePrioritizerConfig.weights.authority,
  recencyWeight: SourcePrioritizerConfig.weights.recency,
  qualityWeight: SourcePrioritizerConfig.weights.quality,
  preferDocuments: true,
  preferAuthoritative: true,
  preferRecent: true,
  recentThresholdDays: SourcePrioritizerConfig.thresholds.recentDays,
  recentBoost: SourcePrioritizerConfig.boosts.recent,
  highAuthorityThreshold: SourcePrioritizerConfig.thresholds.highAuthority,
  highAuthorityBoost: SourcePrioritizerConfig.boosts.highAuthority,
};

/**
 * Source Prioritization Service
 */
export class SourcePrioritizerService {
  /**
   * Calculate freshness score for a source
   */
  private static calculateFreshnessScore(publishedDate?: string): number {
    if (!publishedDate) {
      return SourcePrioritizerConfig.documentDefaults.relevanceScore;
    }

    try {
      const published = new Date(publishedDate);
      const now = new Date();
      
      if (isNaN(published.getTime()) || published > now) {
        return SourcePrioritizerConfig.documentDefaults.relevanceScore;
      }
      
      const daysDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
      
      // Calculate freshness: more recent = higher score
      if (daysDiff <= SourcePrioritizerConfig.freshnessTiers.veryRecent.days) {
        return SourcePrioritizerConfig.freshnessTiers.veryRecent.score;
      } else if (daysDiff <= SourcePrioritizerConfig.freshnessTiers.recent.days) {
        return SourcePrioritizerConfig.freshnessTiers.recent.score;
      } else if (daysDiff <= SourcePrioritizerConfig.freshnessTiers.moderate.days) {
        return SourcePrioritizerConfig.freshnessTiers.moderate.score;
      } else if (daysDiff <= SourcePrioritizerConfig.freshnessTiers.withinYear.days) {
        return SourcePrioritizerConfig.freshnessTiers.withinYear.score;
      } else {
        // Older: decay
        const decay = Math.max(SourcePrioritizerConfig.freshnessTiers.minDecayFactor, 1.0 - (daysDiff - 365) / 365);
        return decay;
      }
    } catch (e) {
      return SourcePrioritizerConfig.documentDefaults.relevanceScore;
    }
  }

  /**
   * Calculate priority score for a document context
   */
  private static calculateDocumentPriority(
    doc: DocumentContext,
    rules: PrioritizationRules
  ): number {
    // Documents have high base authority (user's own content)
    const authorityScore = SourcePrioritizerConfig.documentDefaults.authorityScore;
    
    // Use relevance score from document
    const relevanceScore = doc.score || SourcePrioritizerConfig.documentDefaults.relevanceScore;
    
    // Documents are typically not time-sensitive, so freshness is neutral
    const freshnessScore = SourcePrioritizerConfig.documentDefaults.freshnessScore;
    
    // Calculate priority based on rules
    let priority = 
      relevanceScore * rules.relevanceWeight +
      authorityScore * rules.authorityWeight +
      freshnessScore * rules.recencyWeight;
    
    // Apply document weight boost
    if (rules.preferDocuments) {
      priority *= rules.documentWeight;
    }
    
    return Math.min(1.0, Math.max(0.0, priority));
  }

  /**
   * Calculate priority score for a web result
   */
  private static calculateWebPriority(
    result: { title: string; url: string; content: string; score?: number; publishedDate?: string; authorityScore?: number },
    rules: PrioritizationRules
  ): number {
    // Get authority score (use provided or calculate)
    let authorityScore = result.authorityScore;
    if (authorityScore === undefined) {
      const authorityResult = DomainAuthorityService.getDomainAuthorityScore(result.url);
      authorityScore = authorityResult.score;
    }
    
    // Use relevance score if available
    const relevanceScore = result.score || SourcePrioritizerConfig.documentDefaults.relevanceScore;
    
    // Calculate freshness score
    const freshnessScore = this.calculateFreshnessScore(result.publishedDate);
    
    // Calculate base priority
    let priority = 
      relevanceScore * rules.relevanceWeight +
      authorityScore * rules.authorityWeight +
      freshnessScore * rules.recencyWeight;
    
    // Apply boosts
    if (rules.preferRecent && freshnessScore >= SourcePrioritizerConfig.thresholds.recentFreshness) {
      // Recent content boost
      priority *= rules.recentBoost;
    }
    
    if (rules.preferAuthoritative && authorityScore >= rules.highAuthorityThreshold) {
      // High authority boost
      priority *= rules.highAuthorityBoost;
    }
    
    // Apply web weight
    priority *= rules.webWeight;
    
    return Math.min(1.0, Math.max(0.0, priority));
  }

  /**
   * Calculate weight for source in context (based on priority)
   */
  private static calculateWeight(priority: number, maxPriority: number): number {
    if (maxPriority === 0) {
      return SourcePrioritizerConfig.documentDefaults.relevanceScore;
    }
    
    // Normalize weight based on priority relative to max
    const normalizedPriority = priority / maxPriority;
    
    // Weight ranges from 0.3 to 1.0 (even low priority sources get some weight)
    return SourcePrioritizerConfig.priorityWeightBase + (normalizedPriority * SourcePrioritizerConfig.priorityWeightRange);
  }

  /**
   * Prioritize RAG context sources
   */
  static prioritizeContext(
    context: RAGContext,
    options: PrioritizationOptions = {}
  ): {
    context: PrioritizedRAGContext;
    stats: PrioritizationStats;
  } {
    const startTime = Date.now();
    const rules: PrioritizationRules = { ...DEFAULT_PRIORITIZATION_RULES, ...options.rules };

    // Prioritize document contexts
    const prioritizedDocuments: PrioritizedDocumentContext[] = context.documentContexts.map((doc, index) => {
      const priority = this.calculateDocumentPriority(doc, rules);
      
      return {
        ...doc,
        priority,
        weight: 0, // Will be calculated after we know max priority
        metadata: {
          relevanceScore: doc.score || SourcePrioritizerConfig.documentDefaults.relevanceScore,
          authorityScore: SourcePrioritizerConfig.documentDefaults.authorityScore,
          freshnessScore: SourcePrioritizerConfig.documentDefaults.freshnessScore,
        },
      };
    });

    // Prioritize web results
    const prioritizedWeb: PrioritizedWebResult[] = context.webSearchResults.map((result, index) => {
      const priority = this.calculateWebPriority(
        {
          title: result.title,
          url: result.url,
          content: result.content,
          publishedDate: undefined, // Web results in RAGContext don't have publishedDate
        },
        rules
      );
      
      const authorityScore = DomainAuthorityService.getDomainAuthorityScore(result.url).score;
      const freshnessScore = this.calculateFreshnessScore(undefined);
      
      return {
        ...result,
        priority,
        weight: 0, // Will be calculated after we know max priority
        metadata: {
          relevanceScore: undefined, // Web results don't have scores in RAGContext
          authorityScore,
          freshnessScore,
        },
      };
    });

    // Find max priority for weight calculation
    const allPriorities = [
      ...prioritizedDocuments.map(d => d.priority),
      ...prioritizedWeb.map(w => w.priority),
    ];
    const maxPriority = allPriorities.length > 0 ? Math.max(...allPriorities) : 1.0;

    // Calculate weights
    prioritizedDocuments.forEach(doc => {
      doc.weight = this.calculateWeight(doc.priority, maxPriority);
    });

    prioritizedWeb.forEach(result => {
      result.weight = this.calculateWeight(result.priority, maxPriority);
    });

    // Sort by priority (descending)
    prioritizedDocuments.sort((a, b) => b.priority - a.priority);
    prioritizedWeb.sort((a, b) => b.priority - a.priority);

    // Calculate statistics
    const avgDocPriority = prioritizedDocuments.length > 0
      ? prioritizedDocuments.reduce((sum, d) => sum + d.priority, 0) / prioritizedDocuments.length
      : 0;
    
    const avgWebPriority = prioritizedWeb.length > 0
      ? prioritizedWeb.reduce((sum, w) => sum + w.priority, 0) / prioritizedWeb.length
      : 0;

    const highPriorityThreshold = SourcePrioritizerConfig.thresholds.highPriority;
    const highPriorityDocs = prioritizedDocuments.filter(d => d.priority >= highPriorityThreshold).length;
    const highPriorityWeb = prioritizedWeb.filter(w => w.priority >= highPriorityThreshold).length;

    const processingTimeMs = Date.now() - startTime;

    logger.debug('Sources prioritized', {
      documentCount: prioritizedDocuments.length,
      webResultCount: prioritizedWeb.length,
      avgDocPriority: avgDocPriority.toFixed(2),
      avgWebPriority: avgWebPriority.toFixed(2),
      highPriorityDocs,
      highPriorityWeb,
      processingTimeMs,
    });

    return {
      context: {
        documentContexts: prioritizedDocuments,
        webSearchResults: prioritizedWeb,
      },
      stats: {
        documentCount: prioritizedDocuments.length,
        webResultCount: prioritizedWeb.length,
        averageDocumentPriority: avgDocPriority,
        averageWebPriority: avgWebPriority,
        highPriorityDocuments: highPriorityDocs,
        highPriorityWebResults: highPriorityWeb,
        processingTimeMs,
      },
    };
  }

  /**
   * Get prioritization rules preset
   */
  static getPresetRules(preset: 'documents-first' | 'web-first' | 'balanced' | 'authority-first' | 'recent-first'): PrioritizationRules {
    const presets: Record<string, PrioritizationRules> = {
      'documents-first': {
        ...DEFAULT_PRIORITIZATION_RULES,
        documentWeight: SourcePrioritizerConfig.presets.documentsFirst.documentWeight,
        webWeight: SourcePrioritizerConfig.presets.documentsFirst.webWeight,
        preferDocuments: true,
      },
      'web-first': {
        ...DEFAULT_PRIORITIZATION_RULES,
        documentWeight: SourcePrioritizerConfig.presets.webFirst.documentWeight,
        webWeight: SourcePrioritizerConfig.presets.webFirst.webWeight,
        preferDocuments: false,
      },
      'balanced': {
        ...DEFAULT_PRIORITIZATION_RULES,
        documentWeight: SourcePrioritizerConfig.presets.balanced.documentWeight,
        webWeight: SourcePrioritizerConfig.presets.balanced.webWeight,
      },
      'authority-first': {
        ...DEFAULT_PRIORITIZATION_RULES,
        authorityWeight: SourcePrioritizerConfig.presets.authorityFirst.authorityWeight,
        relevanceWeight: SourcePrioritizerConfig.presets.authorityFirst.relevanceWeight,
        preferAuthoritative: true,
        highAuthorityBoost: SourcePrioritizerConfig.presets.authorityFirst.highAuthorityBoost,
      },
      'recent-first': {
        ...DEFAULT_PRIORITIZATION_RULES,
        recencyWeight: SourcePrioritizerConfig.presets.recentFirst.recencyWeight,
        relevanceWeight: SourcePrioritizerConfig.presets.recentFirst.relevanceWeight,
        preferRecent: true,
        recentBoost: SourcePrioritizerConfig.presets.recentFirst.recentBoost,
      },
    };

    return presets[preset] || DEFAULT_PRIORITIZATION_RULES;
  }
}
