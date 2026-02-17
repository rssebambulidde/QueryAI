/**
 * Result Quality Scorer Service
 * Scores search results based on content length, readability, and structure
 */

import logger from '../config/logger';
import { QualityScorerConfig, RetrievalConfig } from '../config/thresholds.config';
import { SearchResult } from './search.service';

export interface QualityMetrics {
  contentLength: number; // Character count of content
  wordCount: number; // Word count
  sentenceCount: number; // Number of sentences
  paragraphCount: number; // Number of paragraphs
  readabilityScore: number; // Readability score (0-1)
  structureScore: number; // Structure quality score (0-1)
  completenessScore: number; // Content completeness score (0-1)
}

export interface QualityScore {
  overallScore: number; // Overall quality score (0-1)
  metrics: QualityMetrics;
  factors: {
    contentLength: number;
    readability: number;
    structure: number;
    completeness: number;
  };
}

export interface QualityScoringConfig {
  // Weight factors (0-1, should sum to ~1.0)
  contentLengthWeight?: number; // Weight for content length (default: 0.25)
  readabilityWeight?: number; // Weight for readability (default: 0.30)
  structureWeight?: number; // Weight for structure (default: 0.25)
  completenessWeight?: number; // Weight for completeness (default: 0.20)
  // Content length thresholds
  minContentLength?: number; // Minimum content length (default: 50)
  optimalContentLength?: number; // Optimal content length (default: 500)
  maxContentLength?: number; // Maximum content length before penalty (default: 5000)
  // Readability settings
  minWordsPerSentence?: number; // Minimum words per sentence (default: 5)
  maxWordsPerSentence?: number; // Maximum words per sentence (default: 25)
  minSentences?: number; // Minimum sentences for good quality (default: 3)
  // Structure settings
  minParagraphs?: number; // Minimum paragraphs for good structure (default: 1)
  requireTitle?: boolean; // Require title for quality (default: true)
  // Completeness settings
  minWordCount?: number; // Minimum word count (default: 20)
  optimalWordCount?: number; // Optimal word count (default: 200)
}

/**
 * Default quality scoring configuration
 */
export const DEFAULT_QUALITY_CONFIG: Required<QualityScoringConfig> = {
  contentLengthWeight: QualityScorerConfig.weights.contentLength,
  readabilityWeight: QualityScorerConfig.weights.readability,
  structureWeight: QualityScorerConfig.weights.structure,
  completenessWeight: QualityScorerConfig.weights.completeness,
  minContentLength: QualityScorerConfig.content.minLength,
  optimalContentLength: QualityScorerConfig.content.optimalLength,
  maxContentLength: QualityScorerConfig.content.maxLength,
  minWordsPerSentence: QualityScorerConfig.readability.minWordsPerSentence,
  maxWordsPerSentence: QualityScorerConfig.readability.maxWordsPerSentence,
  minSentences: QualityScorerConfig.readability.minSentences,
  minParagraphs: QualityScorerConfig.structure.minParagraphs,
  requireTitle: true,
  minWordCount: QualityScorerConfig.content.minWordCount,
  optimalWordCount: QualityScorerConfig.content.optimalWordCount,
};

/**
 * Result Quality Scorer Service
 */
export class ResultQualityScorerService {
  private static config: Required<QualityScoringConfig> = DEFAULT_QUALITY_CONFIG;

  /**
   * Set quality scoring configuration
   */
  static setConfig(config: Partial<QualityScoringConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Result quality scoring configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  static getConfig(): Required<QualityScoringConfig> {
    return { ...this.config };
  }

  /**
   * Calculate quality metrics for a search result
   */
  private static calculateMetrics(result: SearchResult): QualityMetrics {
    const content = result.content || '';
    const title = result.title || '';

    // Basic counts
    const contentLength = content.length;
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Sentence detection (period, exclamation, question mark followed by space or end)
    const sentences = content.match(/[.!?]+[\s\n]|$/g) || [];
    const sentenceCount = Math.max(1, sentences.length); // At least 1 sentence

    // Paragraph detection (double newlines or HTML paragraph tags)
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = Math.max(1, paragraphs.length); // At least 1 paragraph

    // Readability score (based on sentence length and complexity)
    const readabilityScore = this.calculateReadabilityScore(words, sentenceCount);

    // Structure score (based on paragraphs, title, formatting)
    const structureScore = this.calculateStructureScore(
      title,
      paragraphCount,
      content
    );

    // Completeness score (based on content length and word count)
    const completenessScore = this.calculateCompletenessScore(
      contentLength,
      wordCount
    );

    return {
      contentLength,
      wordCount,
      sentenceCount,
      paragraphCount,
      readabilityScore,
      structureScore,
      completenessScore,
    };
  }

  /**
   * Calculate readability score
   */
  private static calculateReadabilityScore(
    words: string[],
    sentenceCount: number
  ): number {
    if (words.length === 0 || sentenceCount === 0) {
      return 0.0;
    }

    const avgWordsPerSentence = words.length / sentenceCount;
    const minWords = this.config.minWordsPerSentence;
    const maxWords = this.config.maxWordsPerSentence;
    const minSentences = this.config.minSentences;

    // Score based on average words per sentence
    let sentenceLengthScore = 1.0;
    if (avgWordsPerSentence < minWords) {
      // Too short sentences (likely incomplete or fragmented)
      sentenceLengthScore = Math.max(QualityScorerConfig.readability.minSentenceLengthScore, avgWordsPerSentence / minWords);
    } else if (avgWordsPerSentence > maxWords) {
      // Too long sentences (likely hard to read)
      const excess = avgWordsPerSentence - maxWords;
      const penalty = Math.min(QualityScorerConfig.readability.maxLongSentencePenalty, excess / maxWords);
      sentenceLengthScore = 1.0 - penalty;
    }

    // Score based on number of sentences
    let sentenceCountScore = Math.min(1.0, sentenceCount / minSentences);

    // Combine scores
    const readabilityScore = (sentenceLengthScore * QualityScorerConfig.readability.sentenceLengthWeight + sentenceCountScore * QualityScorerConfig.readability.sentenceCountWeight);

    return Math.min(1.0, Math.max(0.0, readabilityScore));
  }

  /**
   * Calculate structure score
   */
  private static calculateStructureScore(
    title: string,
    paragraphCount: number,
    content: string
  ): number {
    let score = 0.0;

    // Title presence (30% weight)
    if (this.config.requireTitle) {
      if (title && title.trim().length > 0 && title !== 'Untitled') {
        score += QualityScorerConfig.structure.titlePresenceScore;
      }
    } else {
      // If title not required, give base score
      score += QualityScorerConfig.structure.titlePresenceScore;
    }

    // Paragraph structure (40% weight)
    const minParagraphs = this.config.minParagraphs;
    if (paragraphCount >= minParagraphs) {
      // Good structure with multiple paragraphs
      const paragraphScore = Math.min(1.0, paragraphCount / Math.max(2, minParagraphs));
      score += QualityScorerConfig.structure.paragraphScoreWeight * paragraphScore;
    } else {
      // Single paragraph or no clear structure
      score += QualityScorerConfig.structure.paragraphScoreWeight * (paragraphCount / minParagraphs);
    }

    // Content formatting (30% weight)
    // Check for formatting indicators (lists, headers, etc.)
    const hasFormatting =
      content.includes('\n-') ||
      content.includes('\n*') ||
      content.includes('\n1.') ||
      content.includes('<h') ||
      content.includes('#');
    if (hasFormatting) {
      score += QualityScorerConfig.structure.formattingScore;
    } else if (paragraphCount > 1) {
      // Multiple paragraphs indicate some structure
      score += QualityScorerConfig.structure.multipleParagraphsBonus;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Calculate completeness score
   */
  private static calculateCompletenessScore(
    contentLength: number,
    wordCount: number
  ): number {
    const minLength = this.config.minContentLength;
    const optimalLength = this.config.optimalContentLength;
    const maxLength = this.config.maxContentLength;
    const minWords = this.config.minWordCount;
    const optimalWords = this.config.optimalWordCount;

    // Score based on content length
    let lengthScore = 0.0;
    if (contentLength < minLength) {
      // Too short - likely incomplete
      lengthScore = contentLength / minLength;
    } else if (contentLength <= optimalLength) {
      // Optimal length
      lengthScore = 1.0;
    } else if (contentLength <= maxLength) {
      // Good length, slight penalty for being long
      const excess = contentLength - optimalLength;
      const penalty = Math.min(QualityScorerConfig.completeness.moderateLengthPenalty, excess / (maxLength - optimalLength));
      lengthScore = 1.0 - penalty;
    } else {
      // Too long - likely verbose or contains noise
      const excess = contentLength - maxLength;
      const penalty = Math.min(QualityScorerConfig.completeness.severeLengthPenalty, excess / maxLength);
      lengthScore = 1.0 - penalty;
    }

    // Score based on word count
    let wordScore = 0.0;
    if (wordCount < minWords) {
      // Too few words
      wordScore = wordCount / minWords;
    } else if (wordCount <= optimalWords) {
      // Optimal word count
      wordScore = 1.0;
    } else {
      // More words than optimal (still good, but slight penalty)
      const excess = wordCount - optimalWords;
      const penalty = Math.min(QualityScorerConfig.completeness.excessWordPenalty, excess / optimalWords);
      wordScore = 1.0 - penalty;
    }

    // Combine length and word scores
    const completenessScore = (lengthScore * QualityScorerConfig.completeness.lengthWeight + wordScore * QualityScorerConfig.completeness.wordCountWeight);

    return Math.min(1.0, Math.max(0.0, completenessScore));
  }

  /**
   * Calculate content length score component
   */
  private static calculateContentLengthScore(contentLength: number): number {
    const minLength = this.config.minContentLength;
    const optimalLength = this.config.optimalContentLength;
    const maxLength = this.config.maxContentLength;

    if (contentLength < minLength) {
      return Math.max(0.0, contentLength / minLength);
    } else if (contentLength <= optimalLength) {
      return 1.0;
    } else if (contentLength <= maxLength) {
      const excess = contentLength - optimalLength;
      const penalty = Math.min(QualityScorerConfig.completeness.moderateLengthPenalty, excess / (maxLength - optimalLength));
      return 1.0 - penalty;
    } else {
      const excess = contentLength - maxLength;
      const penalty = Math.min(QualityScorerConfig.completeness.severeLengthPenalty, excess / maxLength);
      return Math.max(QualityScorerConfig.completeness.minContentLengthScore, 1.0 - penalty);
    }
  }

  /**
   * Score a search result
   */
  static scoreResult(result: SearchResult, config?: Partial<QualityScoringConfig>): QualityScore {
    const scoringConfig = config ? { ...this.config, ...config } : this.config;

    // Calculate metrics
    const metrics = this.calculateMetrics(result);

    // Calculate component scores
    const contentLengthScore = this.calculateContentLengthScore(metrics.contentLength);
    const readabilityScore = metrics.readabilityScore;
    const structureScore = metrics.structureScore;
    const completenessScore = metrics.completenessScore;

    // Calculate weighted overall score
    const overallScore =
      contentLengthScore * scoringConfig.contentLengthWeight +
      readabilityScore * scoringConfig.readabilityWeight +
      structureScore * scoringConfig.structureWeight +
      completenessScore * scoringConfig.completenessWeight;

    return {
      overallScore: Math.min(1.0, Math.max(0.0, overallScore)),
      metrics,
      factors: {
        contentLength: contentLengthScore,
        readability: readabilityScore,
        structure: structureScore,
        completeness: completenessScore,
      },
    };
  }

  /**
   * Score multiple results
   */
  static scoreResults(
    results: SearchResult[],
    config?: Partial<QualityScoringConfig>
  ): Array<{ result: SearchResult; qualityScore: QualityScore }> {
    return results.map(result => ({
      result,
      qualityScore: this.scoreResult(result, config),
    }));
  }

  /**
   * Filter results by quality threshold
   */
  static filterByQuality(
    results: SearchResult[],
    minQualityScore: number = RetrievalConfig.qualityThreshold,
    config?: Partial<QualityScoringConfig>
  ): SearchResult[] {
    if (minQualityScore <= 0) {
      return results; // No filtering if threshold is 0 or negative
    }

    return results.filter(result => {
      const qualityScore = this.scoreResult(result, config);
      return qualityScore.overallScore >= minQualityScore;
    });
  }

  /**
   * Sort results by quality score
   */
  static sortByQuality(
    results: SearchResult[],
    config?: Partial<QualityScoringConfig>
  ): SearchResult[] {
    const scored = this.scoreResults(results, config);
    scored.sort((a, b) => b.qualityScore.overallScore - a.qualityScore.overallScore);
    return scored.map(item => item.result);
  }

  /**
   * Filter and sort results by quality
   */
  static filterAndSortByQuality(
    results: SearchResult[],
    minQualityScore: number = RetrievalConfig.qualityThreshold,
    config?: Partial<QualityScoringConfig>
  ): SearchResult[] {
    const filtered = this.filterByQuality(results, minQualityScore, config);
    return this.sortByQuality(filtered, config);
  }
}
