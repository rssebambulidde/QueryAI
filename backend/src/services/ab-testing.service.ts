/**
 * A/B Testing Service
 * Framework for testing new features vs old, measuring improvements, and analyzing results
 */

import logger from '../config/logger';
import { supabaseAdmin } from '../config/database';
import { MetricsService, RetrievalMetrics } from './metrics.service';

/**
 * A/B Test Variant
 */
export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>; // Variant-specific configuration
  weight?: number; // Traffic weight (0-1), default 0.5 for 50/50 split
}

/**
 * A/B Test Definition
 */
export interface ABTest {
  id: string;
  name: string;
  description: string;
  feature: string; // Feature being tested (e.g., 'reranking', 'chunking', 'context-selection')
  variantA: ABTestVariant; // Control (old)
  variantB: ABTestVariant; // Treatment (new)
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate?: string;
  endDate?: string;
  minSampleSize?: number; // Minimum samples per variant
  significanceLevel?: number; // Statistical significance level (default 0.05)
  createdAt: string;
  updatedAt: string;
}

/**
 * A/B Test Assignment
 */
export interface ABTestAssignment {
  testId: string;
  userId: string;
  queryId: string;
  variant: 'A' | 'B';
  assignedAt: string;
}

/**
 * A/B Test Result
 */
export interface ABTestResult {
  testId: string;
  queryId: string;
  userId: string;
  variant: 'A' | 'B';
  metrics: {
    // Retrieval metrics
    precision?: number;
    recall?: number;
    f1Score?: number;
    mrr?: number;
    averagePrecision?: number;
    // Performance metrics
    responseTime?: number; // milliseconds
    tokenUsage?: number;
    // Quality metrics
    answerQuality?: number; // 0-100
    citationAccuracy?: number; // 0-100
    relevanceScore?: number; // 0-1
    // User feedback
    userRating?: number; // 1-5
    userFeedback?: string;
  };
  timestamp: string;
}

/**
 * A/B Test Analysis
 */
export interface ABTestAnalysis {
  testId: string;
  variantA: {
    sampleSize: number;
    metrics: {
      averagePrecision: number;
      averageRecall: number;
      averageF1Score: number;
      averageMRR: number;
      averageResponseTime: number;
      averageAnswerQuality: number;
      averageCitationAccuracy: number;
      averageRelevanceScore: number;
      averageUserRating: number;
    };
  };
  variantB: {
    sampleSize: number;
    metrics: {
      averagePrecision: number;
      averageRecall: number;
      averageF1Score: number;
      averageMRR: number;
      averageResponseTime: number;
      averageAnswerQuality: number;
      averageCitationAccuracy: number;
      averageRelevanceScore: number;
      averageUserRating: number;
    };
  };
  comparison: {
    improvement: {
      precision: number; // Percentage improvement
      recall: number;
      f1Score: number;
      mrr: number;
      responseTime: number; // Negative = faster
      answerQuality: number;
      citationAccuracy: number;
      relevanceScore: number;
      userRating: number;
    };
    statisticalSignificance: {
      precision: boolean;
      recall: boolean;
      f1Score: boolean;
      responseTime: boolean;
      answerQuality: boolean;
      citationAccuracy: boolean;
      relevanceScore: boolean;
      userRating: boolean;
    };
    pValues: {
      precision?: number;
      recall?: number;
      f1Score?: number;
      responseTime?: number;
      answerQuality?: number;
      citationAccuracy?: number;
      relevanceScore?: number;
      userRating?: number;
    };
    winner?: 'A' | 'B' | 'tie';
    confidence: number; // 0-1
  };
  recommendations: string[];
  generatedAt: string;
}

/**
 * A/B Testing Service
 */
export class ABTestingService {
  /**
   * Create a new A/B test
   */
  static async createTest(test: Omit<ABTest, 'createdAt' | 'updatedAt'>): Promise<ABTest> {
    try {
      const now = new Date().toISOString();
      const testData = {
        ...test,
        createdAt: now,
        updatedAt: now,
      };

      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .insert(testData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating A/B test:', error);
        throw error;
      }

      logger.info(`A/B test created: ${test.id}`);
      return data;
    } catch (error: any) {
      logger.error('Failed to create A/B test:', error);
      throw error;
    }
  }

  /**
   * Get A/B test by ID
   */
  static async getTest(testId: string): Promise<ABTest | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .select('*')
        .eq('id', testId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching A/B test:', error);
        throw error;
      }

      return data;
    } catch (error: any) {
      logger.error('Failed to get A/B test:', error);
      return null;
    }
  }

  /**
   * Get active A/B tests
   */
  static async getActiveTests(): Promise<ABTest[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('ab_tests')
        .select('*')
        .eq('status', 'active');

      if (error) {
        logger.error('Error fetching active A/B tests:', error);
        throw error;
      }

      return data || [];
    } catch (error: any) {
      logger.error('Failed to get active A/B tests:', error);
      return [];
    }
  }

  /**
   * Assign variant to a query/user
   * Uses consistent hashing to ensure same user/query gets same variant
   */
  static async assignVariant(
    testId: string,
    userId: string,
    queryId: string
  ): Promise<'A' | 'B'> {
    try {
      // Check if already assigned
      const existing = await this.getAssignment(testId, userId, queryId);
      if (existing) {
        return existing.variant;
      }

      // Get test configuration
      const test = await this.getTest(testId);
      if (!test) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      if (test.status !== 'active') {
        // Default to variant A if test is not active
        return 'A';
      }

      // Use consistent hashing based on userId + queryId
      const hash = this.hashString(`${userId}:${queryId}:${testId}`);
      const weightA = test.variantA.weight ?? 0.5;
      const variant = hash < weightA ? 'A' : 'B';

      // Store assignment
      await this.saveAssignment({
        testId,
        userId,
        queryId,
        variant,
        assignedAt: new Date().toISOString(),
      });

      logger.debug(`Assigned variant ${variant} for test ${testId}`, {
        userId,
        queryId,
      });

      return variant;
    } catch (error: any) {
      logger.error('Failed to assign variant:', error);
      // Default to variant A on error
      return 'A';
    }
  }

  /**
   * Get assignment for a query
   */
  static async getAssignment(
    testId: string,
    userId: string,
    queryId: string
  ): Promise<ABTestAssignment | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('ab_test_assignments')
        .select('*')
        .eq('test_id', testId)
        .eq('user_id', userId)
        .eq('query_id', queryId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching assignment:', error);
        return null;
      }

      return {
        testId: data.test_id,
        userId: data.user_id,
        queryId: data.query_id,
        variant: data.variant,
        assignedAt: data.assigned_at,
      };
    } catch (error: any) {
      logger.error('Failed to get assignment:', error);
      return null;
    }
  }

  /**
   * Save assignment
   */
  private static async saveAssignment(assignment: ABTestAssignment): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('ab_test_assignments')
        .insert({
          test_id: assignment.testId,
          user_id: assignment.userId,
          query_id: assignment.queryId,
          variant: assignment.variant,
          assigned_at: assignment.assignedAt,
        });

      if (error) {
        logger.error('Error saving assignment:', error);
        // Don't throw - assignment is not critical
      }
    } catch (error: any) {
      logger.error('Failed to save assignment:', error);
    }
  }

  /**
   * Record test result
   */
  static async recordResult(result: ABTestResult): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('ab_test_results')
        .insert({
          test_id: result.testId,
          query_id: result.queryId,
          user_id: result.userId,
          variant: result.variant,
          metrics: result.metrics,
          timestamp: result.timestamp,
        });

      if (error) {
        logger.error('Error recording A/B test result:', error);
        throw error;
      }

      logger.debug(`A/B test result recorded for test ${result.testId}`, {
        variant: result.variant,
        queryId: result.queryId,
      });
    } catch (error: any) {
      logger.error('Failed to record A/B test result:', error);
      throw error;
    }
  }

  /**
   * Get test results
   */
  static async getTestResults(
    testId: string,
    variant?: 'A' | 'B'
  ): Promise<ABTestResult[]> {
    try {
      let query = supabaseAdmin
        .from('ab_test_results')
        .select('*')
        .eq('test_id', testId);

      if (variant) {
        query = query.eq('variant', variant);
      }

      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) {
        logger.error('Error fetching test results:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        testId: row.test_id,
        queryId: row.query_id,
        userId: row.user_id,
        variant: row.variant,
        metrics: row.metrics,
        timestamp: row.timestamp,
      }));
    } catch (error: any) {
      logger.error('Failed to get test results:', error);
      return [];
    }
  }

  /**
   * Analyze A/B test results
   */
  static async analyzeTest(testId: string): Promise<ABTestAnalysis | null> {
    try {
      const test = await this.getTest(testId);
      if (!test) {
        throw new Error(`A/B test not found: ${testId}`);
      }

      const resultsA = await this.getTestResults(testId, 'A');
      const resultsB = await this.getTestResults(testId, 'B');

      if (resultsA.length === 0 && resultsB.length === 0) {
        logger.warn(`No results found for test ${testId}`);
        return null;
      }

      // Calculate metrics for variant A
      const metricsA = this.calculateVariantMetrics(resultsA);
      const metricsB = this.calculateVariantMetrics(resultsB);

      // Compare variants
      const comparison = this.compareVariants(resultsA, resultsB, test.significanceLevel ?? 0.05);

      // Determine winner
      const winner = this.determineWinner(comparison);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        test,
        metricsA,
        metricsB,
        comparison,
        winner
      );

      const analysis: ABTestAnalysis = {
        testId,
        variantA: {
          sampleSize: resultsA.length,
          metrics: metricsA,
        },
        variantB: {
          sampleSize: resultsB.length,
          metrics: metricsB,
        },
        comparison: {
          ...comparison,
          winner,
          confidence: this.calculateConfidence(comparison),
        },
        recommendations,
        generatedAt: new Date().toISOString(),
      };

      return analysis;
    } catch (error: any) {
      logger.error('Failed to analyze A/B test:', error);
      return null;
    }
  }

  /**
   * Calculate metrics for a variant
   */
  private static calculateVariantMetrics(results: ABTestResult[]): ABTestAnalysis['variantA']['metrics'] {
    if (results.length === 0) {
      return {
        averagePrecision: 0,
        averageRecall: 0,
        averageF1Score: 0,
        averageMRR: 0,
        averageResponseTime: 0,
        averageAnswerQuality: 0,
        averageCitationAccuracy: 0,
        averageRelevanceScore: 0,
        averageUserRating: 0,
      };
    }

    const sums = results.reduce(
      (acc, result) => {
        const m = result.metrics;
        return {
          precision: acc.precision + (m.precision || 0),
          recall: acc.recall + (m.recall || 0),
          f1Score: acc.f1Score + (m.f1Score || 0),
          mrr: acc.mrr + (m.mrr || 0),
          responseTime: acc.responseTime + (m.responseTime || 0),
          answerQuality: acc.answerQuality + (m.answerQuality || 0),
          citationAccuracy: acc.citationAccuracy + (m.citationAccuracy || 0),
          relevanceScore: acc.relevanceScore + (m.relevanceScore || 0),
          userRating: acc.userRating + (m.userRating || 0),
        };
      },
      {
        precision: 0,
        recall: 0,
        f1Score: 0,
        mrr: 0,
        responseTime: 0,
        answerQuality: 0,
        citationAccuracy: 0,
        relevanceScore: 0,
        userRating: 0,
      }
    );

    const count = results.length;
    return {
      averagePrecision: sums.precision / count,
      averageRecall: sums.recall / count,
      averageF1Score: sums.f1Score / count,
      averageMRR: sums.mrr / count,
      averageResponseTime: sums.responseTime / count,
      averageAnswerQuality: sums.answerQuality / count,
      averageCitationAccuracy: sums.citationAccuracy / count,
      averageRelevanceScore: sums.relevanceScore / count,
      averageUserRating: sums.userRating / count,
    };
  }

  /**
   * Compare two variants statistically
   */
  private static compareVariants(
    resultsA: ABTestResult[],
    resultsB: ABTestResult[],
    significanceLevel: number
  ): ABTestAnalysis['comparison'] {
    const improvements: ABTestAnalysis['comparison']['improvement'] = {
      precision: 0,
      recall: 0,
      f1Score: 0,
      mrr: 0,
      responseTime: 0,
      answerQuality: 0,
      citationAccuracy: 0,
      relevanceScore: 0,
      userRating: 0,
    };

    const pValues: ABTestAnalysis['comparison']['pValues'] = {};
    const statisticalSignificance: ABTestAnalysis['comparison']['statisticalSignificance'] = {
      precision: false,
      recall: false,
      f1Score: false,
      responseTime: false,
      answerQuality: false,
      citationAccuracy: false,
      relevanceScore: false,
      userRating: false,
    };

    if (resultsA.length === 0 || resultsB.length === 0) {
      return {
        improvement: improvements,
        statisticalSignificance,
        pValues,
      };
    }

    const metricsA = this.calculateVariantMetrics(resultsA);
    const metricsB = this.calculateVariantMetrics(resultsB);

    // Calculate improvements (B vs A)
    improvements.precision = this.calculateImprovement(metricsA.averagePrecision, metricsB.averagePrecision);
    improvements.recall = this.calculateImprovement(metricsA.averageRecall, metricsB.averageRecall);
    improvements.f1Score = this.calculateImprovement(metricsA.averageF1Score, metricsB.averageF1Score);
    improvements.mrr = this.calculateImprovement(metricsA.averageMRR, metricsB.averageMRR);
    improvements.responseTime = this.calculateImprovement(metricsA.averageResponseTime, metricsB.averageResponseTime, true); // Lower is better
    improvements.answerQuality = this.calculateImprovement(metricsA.averageAnswerQuality, metricsB.averageAnswerQuality);
    improvements.citationAccuracy = this.calculateImprovement(metricsA.averageCitationAccuracy, metricsB.averageCitationAccuracy);
    improvements.relevanceScore = this.calculateImprovement(metricsA.averageRelevanceScore, metricsB.averageRelevanceScore);
    improvements.userRating = this.calculateImprovement(metricsA.averageUserRating, metricsB.averageUserRating);

    // Calculate statistical significance (t-test)
    const metricKeys: Array<keyof typeof improvements> = [
      'precision',
      'recall',
      'f1Score',
      'mrr',
      'responseTime',
      'answerQuality',
      'citationAccuracy',
      'relevanceScore',
      'userRating',
    ];

    for (const key of metricKeys) {
      const valuesA = resultsA.map(r => {
        const m = r.metrics;
        switch (key) {
          case 'precision': return m.precision || 0;
          case 'recall': return m.recall || 0;
          case 'f1Score': return m.f1Score || 0;
          case 'mrr': return m.mrr || 0;
          case 'responseTime': return m.responseTime || 0;
          case 'answerQuality': return m.answerQuality || 0;
          case 'citationAccuracy': return m.citationAccuracy || 0;
          case 'relevanceScore': return m.relevanceScore || 0;
          case 'userRating': return m.userRating || 0;
          default: return 0;
        }
      });

      const valuesB = resultsB.map(r => {
        const m = r.metrics;
        switch (key) {
          case 'precision': return m.precision || 0;
          case 'recall': return m.recall || 0;
          case 'f1Score': return m.f1Score || 0;
          case 'mrr': return m.mrr || 0;
          case 'responseTime': return m.responseTime || 0;
          case 'answerQuality': return m.answerQuality || 0;
          case 'citationAccuracy': return m.citationAccuracy || 0;
          case 'relevanceScore': return m.relevanceScore || 0;
          case 'userRating': return m.userRating || 0;
          default: return 0;
        }
      });

      const pValue = this.calculateTTest(valuesA, valuesB);
      pValues[key] = pValue;
      statisticalSignificance[key] = pValue !== undefined && pValue < significanceLevel;
    }

    return {
      improvement: improvements,
      statisticalSignificance,
      pValues,
    };
  }

  /**
   * Calculate improvement percentage
   */
  private static calculateImprovement(
    oldValue: number,
    newValue: number,
    lowerIsBetter: boolean = false
  ): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }

    if (lowerIsBetter) {
      // For metrics where lower is better (e.g., response time)
      const improvement = ((oldValue - newValue) / oldValue) * 100;
      return improvement;
    } else {
      // For metrics where higher is better
      const improvement = ((newValue - oldValue) / oldValue) * 100;
      return improvement;
    }
  }

  /**
   * Calculate t-test p-value
   * Simplified two-sample t-test
   */
  private static calculateTTest(valuesA: number[], valuesB: number[]): number | undefined {
    if (valuesA.length < 2 || valuesB.length < 2) {
      return undefined;
    }

    const meanA = valuesA.reduce((a, b) => a + b, 0) / valuesA.length;
    const meanB = valuesB.reduce((a, b) => a + b, 0) / valuesB.length;

    const varianceA = valuesA.reduce((sum, val) => sum + Math.pow(val - meanA, 2), 0) / (valuesA.length - 1);
    const varianceB = valuesB.reduce((sum, val) => sum + Math.pow(val - meanB, 2), 0) / (valuesB.length - 1);

    const pooledStd = Math.sqrt((varianceA / valuesA.length) + (varianceB / valuesB.length));
    if (pooledStd === 0) {
      return undefined;
    }

    const tStat = (meanB - meanA) / pooledStd;
    const df = valuesA.length + valuesB.length - 2;

    // Simplified p-value calculation (for large samples, use normal approximation)
    // For production, use a proper statistical library
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));

    return pValue;
  }

  /**
   * Normal CDF approximation
   */
  private static normalCDF(x: number): number {
    // Approximation using error function
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private static erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Determine winner based on comparison
   */
  private static determineWinner(
    comparison: ABTestAnalysis['comparison']
  ): 'A' | 'B' | 'tie' {
    const significantMetrics = Object.entries(comparison.statisticalSignificance)
      .filter(([_, significant]) => significant)
      .map(([metric, _]) => metric);

    if (significantMetrics.length === 0) {
      return 'tie';
    }

    let aWins = 0;
    let bWins = 0;

    for (const metric of significantMetrics) {
      const improvement = comparison.improvement[metric as keyof typeof comparison.improvement];
      if (improvement > 0) {
        bWins++;
      } else if (improvement < 0) {
        aWins++;
      }
    }

    if (bWins > aWins) {
      return 'B';
    } else if (aWins > bWins) {
      return 'A';
    } else {
      return 'tie';
    }
  }

  /**
   * Calculate overall confidence
   */
  private static calculateConfidence(comparison: ABTestAnalysis['comparison']): number {
    const significantCount = Object.values(comparison.statisticalSignificance)
      .filter(s => s).length;
    const totalCount = Object.keys(comparison.statisticalSignificance).length;

    // Base confidence on percentage of significant metrics
    const baseConfidence = significantCount / totalCount;

    // Adjust based on p-values (lower p-values = higher confidence)
    const avgPValue = Object.values(comparison.pValues)
      .filter(p => p !== undefined)
      .reduce((sum, p) => sum + (p || 0), 0) / significantCount;

    const pValueAdjustment = avgPValue < 0.01 ? 0.2 : avgPValue < 0.05 ? 0.1 : 0;

    return Math.min(1, baseConfidence + pValueAdjustment);
  }

  /**
   * Generate recommendations based on analysis
   */
  private static generateRecommendations(
    test: ABTest,
    metricsA: ABTestAnalysis['variantA']['metrics'],
    metricsB: ABTestAnalysis['variantB']['metrics'],
    comparison: ABTestAnalysis['comparison'],
    winner: 'A' | 'B' | 'tie'
  ): string[] {
    const recommendations: string[] = [];

    if (winner === 'B') {
      recommendations.push(`Variant B (${test.variantB.name}) shows significant improvements. Consider rolling out to all users.`);
    } else if (winner === 'A') {
      recommendations.push(`Variant A (${test.variantA.name}) performs better. Consider keeping current implementation.`);
    } else {
      recommendations.push('No clear winner. Consider running test longer or adjusting variants.');
    }

    // Check sample sizes
    const totalSamples = comparison.improvement.precision !== undefined ? 2 : 0;
    if (totalSamples < 100) {
      recommendations.push('Sample size is small. Consider collecting more data for reliable results.');
    }

    // Check specific metrics
    if (comparison.improvement.answerQuality > 10 && comparison.statisticalSignificance.answerQuality) {
      recommendations.push('Significant improvement in answer quality detected.');
    }

    if (comparison.improvement.responseTime < -10 && comparison.statisticalSignificance.responseTime) {
      recommendations.push('Response time has improved significantly.');
    }

    if (comparison.improvement.userRating > 5 && comparison.statisticalSignificance.userRating) {
      recommendations.push('User ratings show improvement.');
    }

    return recommendations;
  }

  /**
   * Generate analysis report
   */
  static generateAnalysisReport(analysis: ABTestAnalysis, test: ABTest): string {
    let report = `# A/B Test Analysis Report\n\n`;
    report += `**Test**: ${test.name}\n`;
    report += `**Feature**: ${test.feature}\n`;
    report += `**Generated**: ${analysis.generatedAt}\n\n`;

    report += `## Summary\n\n`;
    report += `- **Variant A (${test.variantA.name})**: ${analysis.variantA.sampleSize} samples\n`;
    report += `- **Variant B (${test.variantB.name})**: ${analysis.variantB.sampleSize} samples\n`;
    report += `- **Winner**: ${analysis.comparison.winner === 'B' ? `✅ ${test.variantB.name}` : analysis.comparison.winner === 'A' ? `✅ ${test.variantA.name}` : 'Tie'}\n`;
    report += `- **Confidence**: ${(analysis.comparison.confidence * 100).toFixed(1)}%\n\n`;

    report += `## Metrics Comparison\n\n`;
    report += `| Metric | Variant A | Variant B | Improvement | Significant |\n`;
    report += `|--------|-----------|-----------|-------------|-------------|\n`;

    const metrics = [
      { key: 'precision', label: 'Precision' },
      { key: 'recall', label: 'Recall' },
      { key: 'f1Score', label: 'F1 Score' },
      { key: 'mrr', label: 'MRR' },
      { key: 'responseTime', label: 'Response Time (ms)' },
      { key: 'answerQuality', label: 'Answer Quality' },
      { key: 'citationAccuracy', label: 'Citation Accuracy' },
      { key: 'relevanceScore', label: 'Relevance Score' },
      { key: 'userRating', label: 'User Rating' },
    ];

    for (const metric of metrics) {
      const key = metric.key as keyof typeof analysis.comparison.improvement;
      const valueA = analysis.variantA.metrics[key as keyof typeof analysis.variantA.metrics];
      const valueB = analysis.variantB.metrics[key as keyof typeof analysis.variantB.metrics];
      const improvement = analysis.comparison.improvement[key];
      const significant = analysis.comparison.statisticalSignificance[key];
      const pValue = analysis.comparison.pValues[key];

      report += `| ${metric.label} | ${valueA.toFixed(3)} | ${valueB.toFixed(3)} | ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% | ${significant ? '✅' : '❌'} ${pValue !== undefined ? `(p=${pValue.toFixed(3)})` : ''} |\n`;
    }

    report += `\n## Recommendations\n\n`;
    for (const rec of analysis.recommendations) {
      report += `- ${rec}\n`;
    }

    return report;
  }

  /**
   * Hash string for consistent assignment
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Normalize to 0-1 range
    return Math.abs(hash) / 2147483647;
  }

  /**
   * Update test status
   */
  static async updateTestStatus(
    testId: string,
    status: ABTest['status']
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('ab_tests')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testId);

      if (error) {
        logger.error('Error updating test status:', error);
        throw error;
      }

      logger.info(`A/B test ${testId} status updated to ${status}`);
    } catch (error: any) {
      logger.error('Failed to update test status:', error);
      throw error;
    }
  }
}
