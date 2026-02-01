/**
 * Threshold Optimizer Service
 * Implements adaptive similarity thresholds based on query characteristics and score distributions
 * Provides dynamic threshold calculation, per-query adjustment, and fallback strategies
 */

import logger from '../config/logger';

export type QueryType = 'factual' | 'conceptual' | 'procedural' | 'exploratory' | 'unknown';

export interface ThresholdConfig {
  defaultThreshold: number; // Default threshold (0.7)
  minThreshold: number; // Minimum allowed threshold (0.3)
  maxThreshold: number; // Maximum allowed threshold (0.95)
  adaptiveEnabled: boolean; // Enable adaptive thresholds
  fallbackEnabled: boolean; // Enable fallback strategies
  // Per query type thresholds
  queryTypeThresholds: Record<QueryType, number>;
  // Score distribution analysis
  useDistributionAnalysis: boolean; // Analyze score distribution
  percentileThreshold: number; // Use Nth percentile as threshold (e.g., 0.75 = 75th percentile)
}

export interface ScoreDistribution {
  scores: number[];
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: {
    p25: number;
    p50: number; // median
    p75: number;
    p90: number;
    p95: number;
  };
}

export interface ThresholdResult {
  threshold: number;
  strategy: 'default' | 'adaptive' | 'query-type' | 'distribution' | 'fallback';
  confidence: number; // Confidence in threshold (0-1)
  reasoning?: string; // Explanation of threshold choice
  queryType?: QueryType;
}

/**
 * Default threshold configuration
 */
export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  defaultThreshold: 0.7,
  minThreshold: 0.3,
  maxThreshold: 0.95,
  adaptiveEnabled: true,
  fallbackEnabled: true,
  queryTypeThresholds: {
    factual: 0.75, // Higher threshold for factual queries (need precise matches)
    conceptual: 0.65, // Lower threshold for conceptual queries (broader matches)
    procedural: 0.70, // Standard threshold for how-to queries
    exploratory: 0.60, // Lower threshold for exploratory queries (cast wider net)
    unknown: 0.70, // Default for unknown query types
  },
  useDistributionAnalysis: true,
  percentileThreshold: 0.75, // Use 75th percentile
};

/**
 * Threshold Optimizer Service
 */
export class ThresholdOptimizerService {
  private static config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG;

  /**
   * Set threshold configuration
   */
  static setConfig(config: Partial<ThresholdConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Threshold configuration updated', { config: this.config });
  }

  /**
   * Get current threshold configuration
   */
  static getConfig(): ThresholdConfig {
    return { ...this.config };
  }

  /**
   * Detect query type based on query characteristics
   */
  static detectQueryType(query: string): QueryType {
    const lowerQuery = query.toLowerCase();
    
    // Conceptual queries: "explain", "understand", "meaning", "concept"
    // Check these first as they can overlap with factual patterns
    const conceptualPatterns = [
      /\b(explain|understand|meaning|concept|theory|idea|definition)\b/i,
      /^(what does|what do|what means)/i,
    ];
    if (conceptualPatterns.some(pattern => pattern.test(query))) {
      return 'conceptual';
    }

    // Factual queries: "what is", "who is", "when did", "where is"
    // But exclude "what does/do" which are conceptual
    const factualPatterns = [
      /^(what|who|when|where|which)\s+(is|are|was|were|did|does|do)/i,
      /^(how many|how much)/i,
      // Also match questions starting with who/what/when/where/which followed by a verb
      /^(who|what|when|where|which)\s+\w+/i, // But check it's not "what does/do"
    ];
    // Check if it matches factual but not conceptual
    if (factualPatterns.some(pattern => pattern.test(query)) && 
        !/^(what does|what do|what means)/i.test(query)) {
      return 'factual';
    }

    // Procedural queries: "how to", "steps", "process", "method"
    const proceduralPatterns = [
      /^(how to|how do|how can|how should)/i,
      /\b(steps|process|method|procedure|guide|tutorial|way to)\b/i,
    ];
    if (proceduralPatterns.some(pattern => pattern.test(query))) {
      return 'procedural';
    }

    // Exploratory queries: "tell me about", "learn about", "information about"
    const exploratoryPatterns = [
      /^(tell me about|learn about|information about|know about|find out about)/i,
      /\b(overview|introduction|background|general)\b/i,
    ];
    if (exploratoryPatterns.some(pattern => pattern.test(query))) {
      return 'exploratory';
    }

    return 'unknown';
  }

  /**
   * Analyze score distribution
   */
  static analyzeScoreDistribution(scores: number[]): ScoreDistribution {
    if (scores.length === 0) {
      return {
        scores: [],
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        percentiles: {
          p25: 0,
          p50: 0,
          p75: 0,
          p90: 0,
          p95: 0,
        },
      };
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const median = sorted[Math.floor(sorted.length / 2)];

    const percentile = (p: number) => {
      const index = Math.floor(sorted.length * p);
      return sorted[Math.min(index, sorted.length - 1)];
    };

    return {
      scores: sorted,
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      percentiles: {
        p25: percentile(0.25),
        p50: median,
        p75: percentile(0.75),
        p90: percentile(0.90),
        p95: percentile(0.95),
      },
    };
  }

  /**
   * Calculate adaptive threshold based on score distribution
   */
  private static calculateAdaptiveThreshold(
    distribution: ScoreDistribution,
    config: ThresholdConfig
  ): number {
    if (distribution.scores.length === 0) {
      return config.defaultThreshold;
    }

    // Use percentile-based threshold
    const percentile = config.percentileThreshold;
    let threshold: number;

    if (percentile === 0.75) {
      threshold = distribution.percentiles.p75;
    } else if (percentile === 0.90) {
      threshold = distribution.percentiles.p90;
    } else if (percentile === 0.95) {
      threshold = distribution.percentiles.p95;
    } else {
      // Interpolate between percentiles
      const p50 = distribution.percentiles.p50;
      const p75 = distribution.percentiles.p75;
      threshold = p50 + (p75 - p50) * (percentile - 0.5) / 0.25;
    }

    // Ensure threshold is within bounds
    threshold = Math.max(config.minThreshold, Math.min(config.maxThreshold, threshold));

    // If distribution is tight (low std dev), use mean-based threshold
    if (distribution.stdDev < 0.1 && distribution.mean > 0.5) {
      threshold = Math.max(threshold, distribution.mean - 0.1);
    }

    return threshold;
  }

  /**
   * Calculate threshold with fallback strategies
   */
  static calculateThreshold(
    query: string,
    initialResults?: Array<{ score: number }>,
    options?: {
      minResults?: number; // Minimum number of results desired
      maxResults?: number; // Maximum number of results desired
    }
  ): ThresholdResult {
    const config = this.config;
    const minResults = options?.minResults || 3;
    const maxResults = options?.maxResults || 10;

    // If adaptive is disabled, use default
    if (!config.adaptiveEnabled) {
      return {
        threshold: config.defaultThreshold,
        strategy: 'default',
        confidence: 1.0,
        reasoning: 'Adaptive thresholds disabled, using default',
      };
    }

    // Detect query type
    const queryType = this.detectQueryType(query);
    let threshold = config.queryTypeThresholds[queryType];
    let strategy: ThresholdResult['strategy'] = 'query-type';
    let confidence = 0.7;
    let reasoning = `Query type: ${queryType}, using type-specific threshold`;

    // If we have initial results, analyze distribution
    if (initialResults && initialResults.length > 0 && config.useDistributionAnalysis) {
      const scores = initialResults.map(r => r.score);
      const distribution = this.analyzeScoreDistribution(scores);

      // Calculate adaptive threshold from distribution
      const adaptiveThreshold = this.calculateAdaptiveThreshold(distribution, config);

      // Use distribution-based threshold if it's reasonable
      if (adaptiveThreshold >= config.minThreshold && adaptiveThreshold <= config.maxThreshold) {
        threshold = adaptiveThreshold;
        strategy = 'distribution';
        confidence = 0.8;
        reasoning = `Distribution-based threshold (mean: ${distribution.mean.toFixed(3)}, p75: ${distribution.percentiles.p75.toFixed(3)})`;
      }
    }

    // Apply fallback strategies if enabled
    if (config.fallbackEnabled && initialResults) {
      const resultCount = initialResults.length;
      
      // If too few results, lower threshold
      if (resultCount < minResults && threshold > config.minThreshold) {
        const originalThreshold = threshold;
        threshold = Math.max(
          config.minThreshold,
          threshold - 0.1 // Lower by 0.1
        );
        strategy = 'fallback';
        confidence = 0.6;
        reasoning = `Fallback: Lowered threshold from ${originalThreshold.toFixed(3)} to ${threshold.toFixed(3)} to get more results (had ${resultCount}, need ${minResults})`;
      }
      
      // If too many results, raise threshold
      if (resultCount > maxResults && threshold < config.maxThreshold) {
        const originalThreshold = threshold;
        threshold = Math.min(
          config.maxThreshold,
          threshold + 0.05 // Raise by 0.05
        );
        strategy = 'fallback';
        confidence = 0.6;
        reasoning = `Fallback: Raised threshold from ${originalThreshold.toFixed(3)} to ${threshold.toFixed(3)} to get fewer results (had ${resultCount}, want max ${maxResults})`;
      }
    }

    // Ensure threshold is within bounds
    threshold = Math.max(config.minThreshold, Math.min(config.maxThreshold, threshold));

    return {
      threshold,
      strategy,
      confidence,
      reasoning,
      queryType,
    };
  }

  /**
   * Optimize threshold iteratively based on result count
   */
  static async optimizeThreshold(
    query: string,
    searchFunction: (threshold: number) => Promise<Array<{ score: number }>>,
    options?: {
      minResults?: number;
      maxResults?: number;
      maxIterations?: number;
    }
  ): Promise<ThresholdResult> {
    const config = this.config;
    const minResults = options?.minResults || 3;
    const maxResults = options?.maxResults || 10;
    const maxIterations = options?.maxIterations || 5;

    // Start with query-type based threshold
    const queryType = this.detectQueryType(query);
    let threshold = config.queryTypeThresholds[queryType];
    let iteration = 0;
    let bestThreshold = threshold;
    let bestResultCount = 0;

    while (iteration < maxIterations) {
      const results = await searchFunction(threshold);
      const resultCount = results.length;

      logger.debug('Threshold optimization iteration', {
        iteration,
        threshold,
        resultCount,
        minResults,
        maxResults,
      });

      // If we have the right number of results, we're done
      if (resultCount >= minResults && resultCount <= maxResults) {
        return {
          threshold,
          strategy: 'adaptive',
          confidence: 0.9,
          reasoning: `Optimized threshold after ${iteration + 1} iterations`,
          queryType,
        };
      }

      // Track best threshold (closest to desired range)
      const distanceToRange = resultCount < minResults
        ? minResults - resultCount
        : resultCount - maxResults;
      
      if (iteration === 0 || distanceToRange < Math.abs(bestResultCount - (minResults + maxResults) / 2)) {
        bestThreshold = threshold;
        bestResultCount = resultCount;
      }

      // Adjust threshold
      if (resultCount < minResults) {
        // Too few results, lower threshold
        threshold = Math.max(
          config.minThreshold,
          threshold - 0.05
        );
      } else if (resultCount > maxResults) {
        // Too many results, raise threshold
        threshold = Math.min(
          config.maxThreshold,
          threshold + 0.05
        );
      } else {
        // In range, we're done
        break;
      }

      iteration++;
    }

    // Return best threshold found
    return {
      threshold: bestThreshold,
      strategy: 'adaptive',
      confidence: 0.7,
      reasoning: `Optimized threshold after ${iteration} iterations (best: ${bestResultCount} results)`,
      queryType,
    };
  }

  /**
   * Get threshold for a query (non-iterative, fast)
   */
  static getThreshold(
    query: string,
    initialResults?: Array<{ score: number }>,
    options?: {
      minResults?: number;
      maxResults?: number;
    }
  ): number {
    const result = this.calculateThreshold(query, initialResults, options);
    return result.threshold;
  }
}
