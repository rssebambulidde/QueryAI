/**
 * Conflict Resolution Service
 * Provides conflict resolution guidelines and strategies
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../config/logger';

/**
 * Conflict resolution guidelines structure
 */
interface ConflictResolutionGuidelines {
  conflictResolution: {
    strategies: {
      sourceAuthority: Strategy;
      recency: Strategy;
      consensus: Strategy;
      contextualRelevance: Strategy;
      evidenceStrength: Strategy;
    };
    handlingConflicts: {
      acknowledgeConflict: ConflictHandling;
      presentBothPerspectives: ConflictHandling;
      prioritizeWithExplanation: ConflictHandling;
      avoidSpeculation: ConflictHandling;
    };
    acknowledgingUncertainty: {
      whenToAcknowledge: {
        conflictingSources: string;
        limitedSources: string;
        outdatedInformation: string;
        methodologicalLimitations: string;
        incompleteInformation: string;
        ambiguousInformation: string;
      };
      howToAcknowledge: {
        explicitStatements: string[];
        examples: string[];
      };
      uncertaintyPhrases: string[];
    };
    examples: {
      conflictExample1: ConflictExample;
      conflictExample2: ConflictExample;
      conflictExample3: ConflictExample;
      conflictExample4: ConflictExample;
      uncertaintyExample1: UncertaintyExample;
      uncertaintyExample2: UncertaintyExample;
      uncertaintyExample3: UncertaintyExample;
    };
    bestPractices: {
      transparency: string[];
      fairness: string[];
      userEmpowerment: string[];
      sourceAttribution: string[];
    };
    commonMistakes: Record<string, CommonMistake>;
    checklist: {
      beforeSubmission: string[];
    };
  };
}

interface Strategy {
  description: string;
  whenToUse: string;
  approach: string[];
  example: string;
}

interface ConflictHandling {
  description: string;
  requirements: string[];
  example: string;
}

interface ConflictExample {
  scenario: string;
  conflict: string;
  resolution: string;
}

interface UncertaintyExample {
  scenario: string;
  situation: string;
  acknowledgment: string;
}

interface CommonMistake {
  mistake: string;
  correct: string;
  example: {
    wrong: string;
    correct: string;
  };
}

/**
 * Conflict Resolution Service
 */
export class ConflictResolutionService {
  private static guidelinesCache: ConflictResolutionGuidelines | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load conflict resolution guidelines from JSON file
   */
  private static loadGuidelines(): ConflictResolutionGuidelines {
    // Check cache
    const now = Date.now();
    if (this.guidelinesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.guidelinesCache;
    }

    try {
      const guidelinesPath = path.join(__dirname, '../data/conflict-resolution-guidelines.json');
      const fileContent = fs.readFileSync(guidelinesPath, 'utf-8');
      const data = JSON.parse(fileContent);

      this.guidelinesCache = data;
      this.cacheTimestamp = now;

      logger.debug('Conflict resolution guidelines loaded');

      return this.guidelinesCache!;
    } catch (error: any) {
      logger.error('Failed to load conflict resolution guidelines', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Format conflict resolution guidelines for prompt
   */
  static formatConflictResolutionGuidelines(): string {
    try {
      // Load guidelines to validate they exist (keeps cache warm for resolution methods)
      this.loadGuidelines();

      // Condensed conflict-resolution guidelines — 4 key bullets.
      return `When sources conflict:
- Acknowledge the conflict explicitly; cite each side.
- Prefer authoritative/recent sources; explain why.
- Present both perspectives if credibility is equal.
- Use hedging language ("sources differ", "may vary") for genuine uncertainty.`;
    } catch (error: any) {
      logger.warn('Failed to format conflict resolution guidelines, using fallback', {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * Get conflict resolution strategy for specific situation
   */
  static getStrategy(strategyType: 'sourceAuthority' | 'recency' | 'consensus' | 'contextualRelevance' | 'evidenceStrength'): Strategy | null {
    try {
      const guidelines = this.loadGuidelines();
      return guidelines.conflictResolution.strategies[strategyType] || null;
    } catch (error: any) {
      logger.warn('Failed to get conflict resolution strategy', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get conflict examples
   */
  static getConflictExamples(): ConflictExample[] {
    try {
      const guidelines = this.loadGuidelines();
      const examples: ConflictExample[] = [];
      for (const [key, example] of Object.entries(guidelines.conflictResolution.examples)) {
        if (key.startsWith('conflictExample')) {
          examples.push(example as ConflictExample);
        }
      }
      return examples;
    } catch (error: any) {
      logger.warn('Failed to get conflict examples', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Clear guidelines cache
   */
  static clearCache(): void {
    this.guidelinesCache = null;
    this.cacheTimestamp = 0;
    logger.debug('Conflict resolution guidelines cache cleared');
  }
}
