/**
 * Few-Shot Example Selector Service
 * Selects relevant few-shot examples based on query type and context
 * Ensures examples don't exceed token budget
 */

import * as fs from 'fs';
import * as path from 'path';
import { TokenCountService } from './token-count.service';
import { ThresholdOptimizerService, QueryType } from './threshold-optimizer.service';
import logger from '../config/logger';

/**
 * Few-shot example structure
 */
export interface FewShotExample {
  id: string;
  queryType: QueryType;
  question: string;
  answer: string;
  context: {
    hasDocuments: boolean;
    hasWebResults: boolean;
    citationStyle: 'mixed' | 'document-only' | 'web-only' | 'web-heavy';
  };
  tags: string[];
}

/**
 * Few-shot examples database
 */
interface FewShotExamplesDB {
  version: string;
  lastUpdated: string;
  examples: FewShotExample[];
  metadata: {
    totalExamples: number;
    queryTypes: QueryType[];
    citationStyles: string[];
  };
}

/**
 * Few-shot selection options
 */
export interface FewShotSelectionOptions {
  query: string; // User query
  queryType?: QueryType; // Detected query type (optional, will be detected if not provided)
  hasDocuments?: boolean; // Whether context has documents
  hasWebResults?: boolean; // Whether context has web results
  maxExamples?: number; // Maximum number of examples (default: 2)
  maxTokens?: number; // Maximum tokens for examples (default: 500)
  model?: string; // Model for token counting
  preferCitationStyle?: 'mixed' | 'document-only' | 'web-only' | 'web-heavy'; // Preferred citation style
}

/**
 * Few-shot selection result
 */
export interface FewShotSelectionResult {
  examples: FewShotExample[];
  totalTokens: number;
  reasoning: string;
}

/**
 * Few-Shot Example Selector Service
 */
export class FewShotSelectorService {
  private static examplesCache: FewShotExample[] | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load few-shot examples from JSON file
   */
  private static loadExamples(): FewShotExample[] {
    // Check cache
    const now = Date.now();
    if (this.examplesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.examplesCache;
    }

    try {
      const examplesPath = path.join(__dirname, '../data/few-shot-examples.json');
      const fileContent = fs.readFileSync(examplesPath, 'utf-8');
      const db: FewShotExamplesDB = JSON.parse(fileContent);

      this.examplesCache = db.examples;
      this.cacheTimestamp = now;

      logger.debug('Few-shot examples loaded', {
        count: db.examples.length,
        queryTypes: db.metadata.queryTypes,
      });

      return db.examples;
    } catch (error: any) {
      logger.error('Failed to load few-shot examples', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Detect query type from query
   */
  private static detectQueryType(query: string): QueryType {
    try {
      return ThresholdOptimizerService.detectQueryType(query);
    } catch (error: any) {
      logger.warn('Failed to detect query type, using unknown', {
        error: error.message,
      });
      return 'unknown';
    }
  }

  /**
   * Calculate relevance score for an example
   */
  private static calculateRelevanceScore(
    example: FewShotExample,
    query: string,
    queryType: QueryType,
    hasDocuments: boolean,
    hasWebResults: boolean,
    preferCitationStyle?: string
  ): number {
    let score = 0;

    // Query type match (highest weight)
    if (example.queryType === queryType) {
      score += 10;
    } else if (example.queryType === 'unknown' || queryType === 'unknown') {
      score += 5; // Partial match for unknown
    }

    // Context match (high weight)
    if (example.context.hasDocuments === hasDocuments && example.context.hasWebResults === hasWebResults) {
      score += 8;
    } else if (example.context.hasDocuments === hasDocuments || example.context.hasWebResults === hasWebResults) {
      score += 4; // Partial match
    }

    // Citation style match (medium weight)
    if (preferCitationStyle && example.context.citationStyle === preferCitationStyle) {
      score += 5;
    }

    // Keyword overlap (low weight)
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const exampleWords = new Set([
      ...example.question.toLowerCase().split(/\s+/),
      ...example.answer.toLowerCase().split(/\s+/),
    ]);
    
    const overlap = [...queryWords].filter(word => exampleWords.has(word)).length;
    score += Math.min(overlap * 0.5, 3); // Max 3 points for keyword overlap

    return score;
  }

  /**
   * Count tokens in example
   */
  private static countExampleTokens(
    example: FewShotExample,
    model: string = 'gpt-3.5-turbo'
  ): number {
    const encodingType = TokenCountService.getEncodingForModel(model);
    const exampleText = `Question: ${example.question}\nAnswer: ${example.answer}`;
    return TokenCountService.countTokens(exampleText, encodingType);
  }

  /**
   * Select relevant few-shot examples
   */
  static selectExamples(
    options: FewShotSelectionOptions
  ): FewShotSelectionResult {
    const {
      query,
      queryType,
      hasDocuments = true,
      hasWebResults = true,
      maxExamples = 2,
      maxTokens = 500,
      model = 'gpt-3.5-turbo',
      preferCitationStyle,
    } = options;

    // Load examples
    const allExamples = this.loadExamples();
    if (allExamples.length === 0) {
      return {
        examples: [],
        totalTokens: 0,
        reasoning: 'No examples available',
      };
    }

    // Detect query type if not provided
    const detectedQueryType = queryType || this.detectQueryType(query);

    // Determine citation style preference
    let citationStylePreference = preferCitationStyle;
    if (!citationStylePreference) {
      if (hasDocuments && !hasWebResults) {
        citationStylePreference = 'document-only';
      } else if (!hasDocuments && hasWebResults) {
        citationStylePreference = 'web-only';
      } else if (hasDocuments && hasWebResults) {
        citationStylePreference = 'mixed';
      }
    }

    // Calculate relevance scores for all examples
    const scoredExamples = allExamples.map(example => ({
      example,
      score: this.calculateRelevanceScore(
        example,
        query,
        detectedQueryType,
        hasDocuments,
        hasWebResults,
        citationStylePreference
      ),
      tokens: this.countExampleTokens(example, model),
    }));

    // Sort by relevance score (descending)
    scoredExamples.sort((a, b) => b.score - a.score);

    // Select examples within token budget
    const selectedExamples: FewShotExample[] = [];
    let totalTokens = 0;
    const reasoningParts: string[] = [];

    for (const { example, score, tokens } of scoredExamples) {
      if (selectedExamples.length >= maxExamples) {
        break;
      }

      if (totalTokens + tokens <= maxTokens) {
        selectedExamples.push(example);
        totalTokens += tokens;
        reasoningParts.push(`${example.id} (score: ${score.toFixed(1)}, tokens: ${tokens})`);
      } else if (selectedExamples.length === 0) {
        // If we can't fit even one example, take the best one anyway
        selectedExamples.push(example);
        totalTokens += tokens;
        reasoningParts.push(`${example.id} (score: ${score.toFixed(1)}, tokens: ${tokens}, exceeds budget)`);
        break;
      }
    }

    const reasoning = reasoningParts.length > 0
      ? `Selected ${selectedExamples.length} examples: ${reasoningParts.join(', ')}`
      : 'No examples selected (token budget too small)';

    logger.debug('Few-shot examples selected', {
      query: query.substring(0, 100),
      queryType: detectedQueryType,
      selectedCount: selectedExamples.length,
      totalTokens,
      reasoning,
    });

    return {
      examples: selectedExamples,
      totalTokens,
      reasoning,
    };
  }

  /**
   * Format examples for system prompt
   */
  static formatExamplesForPrompt(examples: FewShotExample[]): string {
    if (examples.length === 0) {
      return '';
    }

    let formatted = '\n\nFEW-SHOT EXAMPLES:\n';
    formatted += 'The following examples demonstrate the expected format and citation style:\n\n';

    examples.forEach((example, index) => {
      formatted += `Example ${index + 1}:\n`;
      formatted += `Question: ${example.question}\n`;
      formatted += `Answer: ${example.answer}\n\n`;
    });

    formatted += 'Use these examples as a guide for formatting your response with proper citations.\n';

    return formatted;
  }

  /**
   * Get examples by query type
   */
  static getExamplesByQueryType(queryType: QueryType): FewShotExample[] {
    const allExamples = this.loadExamples();
    return allExamples.filter(ex => ex.queryType === queryType);
  }

  /**
   * Get examples by citation style
   */
  static getExamplesByCitationStyle(
    citationStyle: 'mixed' | 'document-only' | 'web-only' | 'web-heavy'
  ): FewShotExample[] {
    const allExamples = this.loadExamples();
    return allExamples.filter(ex => ex.context.citationStyle === citationStyle);
  }

  /**
   * Clear examples cache
   */
  static clearCache(): void {
    this.examplesCache = null;
    this.cacheTimestamp = 0;
    logger.debug('Few-shot examples cache cleared');
  }
}
