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
      const guidelines = this.loadGuidelines();
      const cr = guidelines.conflictResolution;
      
      let formatted = '\n\n=== CONFLICT RESOLUTION GUIDELINES ===\n\n';
      
      // Conflict Resolution Strategies
      formatted += 'CONFLICT RESOLUTION STRATEGIES:\n';
      formatted += 'When sources provide conflicting information, use these strategies:\n\n';
      
      for (const [key, strategy] of Object.entries(cr.strategies)) {
        const strategyName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        formatted += `${strategyName}:\n`;
        formatted += `  ${strategy.description}\n`;
        formatted += `  When to use: ${strategy.whenToUse}\n`;
        formatted += `  Approach:\n`;
        for (const approach of strategy.approach) {
          formatted += `  - ${approach}\n`;
        }
        formatted += `  Example: ${strategy.example}\n\n`;
      }

      // Handling Conflicts
      formatted += 'HANDLING CONFLICTS:\n';
      formatted += 'When sources conflict, follow these guidelines:\n\n';
      
      for (const [key, handling] of Object.entries(cr.handlingConflicts)) {
        const handlingName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        formatted += `${handlingName}:\n`;
        formatted += `  ${handling.description}\n`;
        formatted += `  Requirements:\n`;
        for (const requirement of handling.requirements) {
          formatted += `  - ${requirement}\n`;
        }
        formatted += `  Example: ${handling.example}\n\n`;
      }

      // Acknowledging Uncertainty
      formatted += 'ACKNOWLEDGING UNCERTAINTY:\n';
      formatted += 'Acknowledge uncertainty in these situations:\n\n';
      
      formatted += 'When to Acknowledge:\n';
      for (const [key, description] of Object.entries(cr.acknowledgingUncertainty.whenToAcknowledge)) {
        const situationName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        formatted += `- ${situationName}: ${description}\n`;
      }
      formatted += '\n';

      formatted += 'How to Acknowledge:\n';
      formatted += 'Use explicit statements:\n';
      for (const statement of cr.acknowledgingUncertainty.howToAcknowledge.explicitStatements) {
        formatted += `- ${statement}\n`;
      }
      formatted += '\n';

      formatted += 'Examples:\n';
      for (const example of cr.acknowledgingUncertainty.howToAcknowledge.examples) {
        formatted += `- ${example}\n`;
      }
      formatted += '\n';

      formatted += 'Uncertainty Phrases:\n';
      for (const phrase of cr.acknowledgingUncertainty.uncertaintyPhrases) {
        formatted += `- "${phrase}"\n`;
      }
      formatted += '\n';

      // Examples
      formatted += 'CONFLICT RESOLUTION EXAMPLES:\n';
      formatted += 'Conflict Examples:\n';
      for (const [key, example] of Object.entries(cr.examples)) {
        if (key.startsWith('conflictExample')) {
          formatted += `Scenario: ${example.scenario}\n`;
          formatted += `Conflict: ${example.conflict}\n`;
          formatted += `Resolution: ${example.resolution}\n\n`;
        }
      }

      formatted += 'Uncertainty Examples:\n';
      for (const [key, example] of Object.entries(cr.examples)) {
        if (key.startsWith('uncertaintyExample')) {
          formatted += `Scenario: ${example.scenario}\n`;
          formatted += `Situation: ${example.situation}\n`;
          formatted += `Acknowledgment: ${example.acknowledgment}\n\n`;
        }
      }

      // Best Practices
      formatted += 'BEST PRACTICES:\n';
      for (const [key, practices] of Object.entries(cr.bestPractices)) {
        const practiceName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        formatted += `${practiceName}:\n`;
        for (const practice of practices) {
          formatted += `- ${practice}\n`;
        }
        formatted += '\n';
      }

      // Common Mistakes
      formatted += 'COMMON MISTAKES TO AVOID:\n';
      for (const [key, mistake] of Object.entries(cr.commonMistakes)) {
        const mistakeName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        formatted += `${mistakeName}:\n`;
        formatted += `  Mistake: ${mistake.mistake}\n`;
        formatted += `  Correct: ${mistake.correct}\n`;
        formatted += `  Wrong: ${mistake.example.wrong}\n`;
        formatted += `  Correct: ${mistake.example.correct}\n\n`;
      }

      // Checklist
      formatted += 'CONFLICT RESOLUTION CHECKLIST (BEFORE SUBMISSION):\n';
      for (const check of cr.checklist.beforeSubmission) {
        formatted += `- ${check}\n`;
      }
      formatted += '\n';

      formatted += '=== END CONFLICT RESOLUTION GUIDELINES ===\n';

      return formatted;
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
