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
      const guidelines = this.loadGuidelines();
      
      let formatted = '\n\n=== ANSWER QUALITY GUIDELINES ===\n\n';
      
      // Quality Criteria
      formatted += 'QUALITY CRITERIA:\n';
      formatted += 'Your answers must meet these quality standards:\n\n';
      
      for (const [key, criterion] of Object.entries(guidelines.qualityCriteria)) {
        formatted += `${key.charAt(0).toUpperCase() + key.slice(1)}:\n`;
        formatted += `  ${criterion.description}\n`;
        formatted += `  Requirements:\n`;
        for (const requirement of criterion.requirements) {
          formatted += `  - ${requirement}\n`;
        }
        formatted += `  Indicators:\n`;
        for (const indicator of criterion.indicators) {
          formatted += `  - ${indicator}\n`;
        }
        formatted += '\n';
      }

      // Answer Structure
      formatted += 'ANSWER STRUCTURE TEMPLATES:\n';
      formatted += 'Choose the appropriate structure based on the question type:\n\n';
      
      for (const [key, template] of Object.entries(guidelines.answerStructure)) {
        formatted += `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:\n`;
        formatted += `  ${template.description}\n`;
        formatted += `  Template:\n`;
        const templateLines = template.template.split('\n');
        for (const line of templateLines) {
          formatted += `  ${line}\n`;
        }
        formatted += `  Example:\n`;
        const exampleLines = template.example.split('\n');
        for (const line of exampleLines) {
          formatted += `  ${line}\n`;
        }
        formatted += '\n';
      }

      // Format Requirements
      formatted += 'FORMAT REQUIREMENTS:\n';
      for (const [key, requirement] of Object.entries(guidelines.formatRequirements)) {
        formatted += `${key.charAt(0).toUpperCase() + key.slice(1)}:\n`;
        formatted += `  ${requirement.description}\n`;
        formatted += `  Rules:\n`;
        for (const rule of requirement.rules) {
          formatted += `  - ${rule}\n`;
        }
        formatted += '\n';
      }

      // Quality Examples
      formatted += 'QUALITY EXAMPLES:\n';
      formatted += 'Good Answer Example:\n';
      formatted += `  Question: ${guidelines.qualityExamples.goodAnswer.question}\n`;
      formatted += `  Answer: ${guidelines.qualityExamples.goodAnswer.answer}\n`;
      formatted += `  Quality:\n`;
      for (const [key, value] of Object.entries(guidelines.qualityExamples.goodAnswer.quality)) {
        formatted += `  - ${key}: ${value}\n`;
      }
      formatted += '\n';

      formatted += 'Bad Answer Example:\n';
      formatted += `  Question: ${guidelines.qualityExamples.badAnswer.question}\n`;
      formatted += `  Answer: ${guidelines.qualityExamples.badAnswer.answer}\n`;
      formatted += `  Quality Issues:\n`;
      for (const [key, value] of Object.entries(guidelines.qualityExamples.badAnswer.quality)) {
        formatted += `  - ${key}: ${value}\n`;
      }
      formatted += '\n';

      // Common Mistakes
      formatted += 'COMMON MISTAKES TO AVOID:\n';
      for (const [key, mistake] of Object.entries(guidelines.commonMistakes)) {
        formatted += `${mistake.mistake}:\n`;
        formatted += `  Wrong: ${mistake.example.wrong}\n`;
        formatted += `  Correct: ${mistake.example.correct}\n`;
        formatted += `  Rule: ${mistake.correct}\n\n`;
      }

      // Quality Checklist
      formatted += 'QUALITY CHECKLIST (BEFORE SUBMISSION):\n';
      formatted += 'Verify your answer meets these standards:\n';
      for (const check of guidelines.qualityChecklist.beforeSubmission) {
        formatted += `- ${check}\n`;
      }
      formatted += '\n';

      formatted += 'Accuracy Checks:\n';
      for (const check of guidelines.qualityChecklist.accuracyChecks) {
        formatted += `- ${check}\n`;
      }
      formatted += '\n';

      formatted += 'Completeness Checks:\n';
      for (const check of guidelines.qualityChecklist.completenessChecks) {
        formatted += `- ${check}\n`;
      }
      formatted += '\n';

      formatted += 'Clarity Checks:\n';
      for (const check of guidelines.qualityChecklist.clarityChecks) {
        formatted += `- ${check}\n`;
      }
      formatted += '\n';

      formatted += '=== END ANSWER QUALITY GUIDELINES ===\n';

      return formatted;
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
