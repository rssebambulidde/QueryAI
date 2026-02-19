/**
 * Answer Quality Service
 * Provides answer quality guidelines and structure templates
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../config/logger';

/**
 * Answer quality guidelines structure
 */
interface AnswerQualityGuidelines {
  qualityCriteria: {
    accuracy: QualityCriterion;
    completeness: QualityCriterion;
    clarity: QualityCriterion;
    relevance: QualityCriterion;
    structure: QualityCriterion;
  };
  answerStructure: {
    paragraphBased: StructureTemplate;
    directAnswer: StructureTemplate;
    comparative: StructureTemplate;
    procedural: StructureTemplate;
  };
  formatRequirements: {
    paragraphs: FormatRequirement;
    citations: FormatRequirement;
    formatting: FormatRequirement;
    length: FormatRequirement;
  };
  qualityExamples: {
    goodAnswer: QualityExample;
    badAnswer: QualityExample;
    goodAnswerFactual: QualityExample;
    badAnswerFactual: QualityExample;
    goodAnswerConceptual: QualityExample;
    badAnswerConceptual: QualityExample;
  };
  commonMistakes: Record<string, CommonMistake>;
  qualityChecklist: {
    beforeSubmission: string[];
    accuracyChecks: string[];
    completenessChecks: string[];
    clarityChecks: string[];
  };
}

interface QualityCriterion {
  description: string;
  requirements: string[];
  indicators: string[];
}

interface StructureTemplate {
  description: string;
  template: string;
  example: string;
}

interface FormatRequirement {
  description: string;
  rules: string[];
}

interface QualityExample {
  question: string;
  answer: string;
  quality: {
    accuracy: string;
    completeness: string;
    clarity: string;
    relevance: string;
    structure: string;
  };
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
 * Answer Quality Service
 */
export class AnswerQualityService {
  private static guidelinesCache: AnswerQualityGuidelines | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load answer quality guidelines from JSON file
   */
  private static loadGuidelines(): AnswerQualityGuidelines {
    // Check cache
    const now = Date.now();
    if (this.guidelinesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.guidelinesCache;
    }

    try {
      const guidelinesPath = path.join(__dirname, '../data/answer-quality-guidelines.json');
      const fileContent = fs.readFileSync(guidelinesPath, 'utf-8');
      const data = JSON.parse(fileContent);

      this.guidelinesCache = data;
      this.cacheTimestamp = now;

      logger.debug('Answer quality guidelines loaded');

      return this.guidelinesCache!;
    } catch (error: any) {
      logger.error('Failed to load answer quality guidelines', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Format answer quality guidelines for prompt
   */
  static formatQualityGuidelines(): string {
    try {
      // Load guidelines to validate they exist (keeps cache warm for scoring methods)
      this.loadGuidelines();

      // Condensed quality guidelines — 4 key bullets instead of verbose expansion.
      return `Quality standards:
- Accuracy: all claims sourced; distinguish fact from opinion; admit uncertainty.
- Completeness: address every part of the question; include relevant context.
- Clarity: plain language; define technical terms; logical structure.
- Relevance: stay focused on the question; omit tangential information.`;
    } catch (error: any) {
      logger.warn('Failed to format answer quality guidelines, using fallback', {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * Get structure template for question type
   */
  static getStructureTemplate(questionType?: 'factual' | 'conceptual' | 'procedural' | 'comparative'): string {
    try {
      const guidelines = this.loadGuidelines();
      
      if (questionType === 'procedural') {
        return guidelines.answerStructure.procedural.template;
      } else if (questionType === 'comparative') {
        return guidelines.answerStructure.comparative.template;
      } else {
        return guidelines.answerStructure.paragraphBased.template;
      }
    } catch (error: any) {
      logger.warn('Failed to get structure template', {
        error: error.message,
      });
      return '';
    }
  }

  /**
   * Get quality examples
   */
  static getQualityExamples(type?: 'good' | 'bad'): QualityExample[] {
    try {
      const guidelines = this.loadGuidelines();
      
      if (type === 'good') {
        return [
          guidelines.qualityExamples.goodAnswer,
          guidelines.qualityExamples.goodAnswerFactual,
          guidelines.qualityExamples.goodAnswerConceptual,
        ];
      } else if (type === 'bad') {
        return [
          guidelines.qualityExamples.badAnswer,
          guidelines.qualityExamples.badAnswerFactual,
          guidelines.qualityExamples.badAnswerConceptual,
        ];
      } else {
        return Object.values(guidelines.qualityExamples);
      }
    } catch (error: any) {
      logger.warn('Failed to get quality examples', {
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
    logger.debug('Answer quality guidelines cache cleared');
  }
}
