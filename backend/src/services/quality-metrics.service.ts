/**
 * Quality Metrics Service
 * Tracks answer quality and citation accuracy
 */

import logger from '../config/logger';
import { supabaseAdmin } from '../config/database';

export enum QualityMetricType {
  ANSWER_QUALITY = 'answer_quality',
  CITATION_ACCURACY = 'citation_accuracy',
  RELEVANCE = 'relevance',
  COMPLETENESS = 'completeness',
  COHERENCE = 'coherence',
}

export interface QualityMetric {
  userId: string;
  queryId?: string;
  question: string;
  answer: string;
  metricType: QualityMetricType;
  score: number; // 0-100
  timestamp: number;
  sources?: string[]; // Source IDs or URLs
  citations?: Array<{
    text: string;
    source: string;
    accurate: boolean;
  }>;
  metadata?: Record<string, any>;
}

export interface QualityStats {
  metricType: QualityMetricType;
  averageScore: number;
  minScore: number;
  maxScore: number;
  count: number;
  scoreDistribution: {
    excellent: number; // 90-100
    good: number; // 70-89
    fair: number; // 50-69
    poor: number; // 0-49
  };
}

export interface QualityQuery {
  userId?: string;
  metricType?: QualityMetricType;
  startDate?: string;
  endDate?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
}

/**
 * Quality Metrics Service
 * Tracks and analyzes quality metrics
 */
export class QualityMetricsService {
  /**
   * Calculate answer quality score
   * Based on multiple factors: relevance, completeness, coherence, citation accuracy
   */
  static calculateAnswerQuality(
    answer: string,
    question: string,
    sources: Array<{ title?: string; url?: string; content?: string }>,
    citations?: Array<{ text: string; source: string; accurate: boolean }>
  ): number {
    let score = 0;
    let factors = 0;

    // Relevance (0-25 points)
    // Check if answer addresses the question
    const questionKeywords = question.toLowerCase().split(/\s+/);
    const answerLower = answer.toLowerCase();
    const relevantKeywords = questionKeywords.filter(kw => answerLower.includes(kw));
    const relevanceScore = (relevantKeywords.length / questionKeywords.length) * 25;
    score += relevanceScore;
    factors++;

    // Completeness (0-25 points)
    // Check if answer provides sufficient information
    const answerLength = answer.length;
    const completenessScore = Math.min(25, (answerLength / 500) * 25); // 500 chars = full score
    score += completenessScore;
    factors++;

    // Coherence (0-25 points)
    // Check if answer is well-structured and coherent
    const sentenceCount = answer.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const wordCount = answer.split(/\s+/).length;
    const avgWordsPerSentence = wordCount / Math.max(1, sentenceCount);
    const coherenceScore = Math.min(25, (avgWordsPerSentence / 20) * 25); // 20 words/sentence = full score
    score += coherenceScore;
    factors++;

    // Citation accuracy (0-25 points)
    if (citations && citations.length > 0) {
      const accurateCitations = citations.filter(c => c.accurate).length;
      const citationAccuracy = (accurateCitations / citations.length) * 25;
      score += citationAccuracy;
    } else if (sources && sources.length > 0) {
      // If no explicit citations, check if sources are mentioned
      const sourceMentions = sources.filter(s => {
        const sourceText = (s.title || s.url || '').toLowerCase();
        return answerLower.includes(sourceText.substring(0, 20));
      }).length;
      const citationScore = (sourceMentions / sources.length) * 25;
      score += citationScore;
    } else {
      // No sources or citations - penalize
      score += 0;
    }
    factors++;

    // Normalize to 0-100
    return Math.round((score / factors) * 4);
  }

  /**
   * Calculate citation accuracy
   * Checks if citations match their sources
   */
  static calculateCitationAccuracy(
    citations: Array<{ text: string; source: string; accurate: boolean }>
  ): number {
    if (!citations || citations.length === 0) {
      return 0;
    }

    const accurateCount = citations.filter(c => c.accurate).length;
    return Math.round((accurateCount / citations.length) * 100);
  }

  /**
   * Collect quality metrics
   */
  static async collectQualityMetrics(
    userId: string,
    question: string,
    answer: string,
    options?: {
      queryId?: string;
      sources?: Array<{ title?: string; url?: string; content?: string }>;
      citations?: Array<{ text: string; source: string; accurate: boolean }>;
      metadata?: Record<string, any>;
    }
  ): Promise<QualityMetric> {
    const timestamp = Date.now();

    // Calculate answer quality
    const answerQualityScore = this.calculateAnswerQuality(
      answer,
      question,
      options?.sources || [],
      options?.citations
    );

    // Calculate citation accuracy
    const citationAccuracyScore = options?.citations
      ? this.calculateCitationAccuracy(options.citations)
      : 0;

    // Store answer quality metric
    const answerQualityMetric: QualityMetric = {
      userId,
      queryId: options?.queryId,
      question: question.substring(0, 500),
      answer: answer.substring(0, 2000),
      metricType: QualityMetricType.ANSWER_QUALITY,
      score: answerQualityScore,
      timestamp,
      sources: options?.sources?.map(s => s.url || s.title || ''),
      citations: options?.citations,
      metadata: options?.metadata,
    };

    await this.storeQualityMetric(answerQualityMetric);

    // Store citation accuracy metric if citations exist
    if (options?.citations && options.citations.length > 0) {
      const citationMetric: QualityMetric = {
        userId,
        queryId: options?.queryId,
        question: question.substring(0, 500),
        answer: answer.substring(0, 2000),
        metricType: QualityMetricType.CITATION_ACCURACY,
        score: citationAccuracyScore,
        timestamp,
        citations: options.citations,
        metadata: options?.metadata,
      };

      await this.storeQualityMetric(citationMetric);
    }

    logger.info('Quality metrics collected', {
      userId,
      answerQuality: answerQualityScore,
      citationAccuracy: citationAccuracyScore,
      queryId: options?.queryId,
    });

    return answerQualityMetric;
  }

  /**
   * Store quality metric in database
   */
  private static async storeQualityMetric(metric: QualityMetric): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('quality_metrics')
        .insert({
          user_id: metric.userId,
          query_id: metric.queryId,
          question: metric.question,
          answer: metric.answer,
          metric_type: metric.metricType,
          score: metric.score,
          timestamp: new Date(metric.timestamp).toISOString(),
          sources: metric.sources,
          citations: metric.citations,
          metadata: metric.metadata,
        });

      if (error) {
        logger.error('Failed to store quality metric', {
          error: error.message,
          metricType: metric.metricType,
        });
      }
    } catch (error: any) {
      logger.error('Error storing quality metric', {
        error: error.message,
        metricType: metric.metricType,
      });
    }
  }

  /**
   * Get quality statistics
   */
  static async getQualityStats(query: QualityQuery): Promise<QualityStats[]> {
    try {
      let dbQuery = supabaseAdmin
        .from('quality_metrics')
        .select('*')
        .order('timestamp', { ascending: false });

      if (query.userId) {
        dbQuery = dbQuery.eq('user_id', query.userId);
      }

      if (query.metricType) {
        dbQuery = dbQuery.eq('metric_type', query.metricType);
      }

      if (query.startDate) {
        dbQuery = dbQuery.gte('timestamp', query.startDate);
      }

      if (query.endDate) {
        dbQuery = dbQuery.lte('timestamp', query.endDate);
      }

      if (query.minScore !== undefined) {
        dbQuery = dbQuery.gte('score', query.minScore);
      }

      if (query.maxScore !== undefined) {
        dbQuery = dbQuery.lte('score', query.maxScore);
      }

      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 1000) - 1);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to get quality metrics', {
          error: error.message,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by metric type
      const grouped = new Map<QualityMetricType, number[]>();

      for (const row of data) {
        const metricType = row.metric_type as QualityMetricType;
        if (!grouped.has(metricType)) {
          grouped.set(metricType, []);
        }
        grouped.get(metricType)!.push(row.score);
      }

      // Calculate statistics for each metric type
      const stats: QualityStats[] = [];

      for (const [metricType, scores] of grouped.entries()) {
        const count = scores.length;
        const sum = scores.reduce((s, score) => s + score, 0);
        const averageScore = sum / count;
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);

        // Calculate score distribution
        const excellent = scores.filter(s => s >= 90).length;
        const good = scores.filter(s => s >= 70 && s < 90).length;
        const fair = scores.filter(s => s >= 50 && s < 70).length;
        const poor = scores.filter(s => s < 50).length;

        stats.push({
          metricType,
          averageScore: Math.round(averageScore * 100) / 100,
          minScore,
          maxScore,
          count,
          scoreDistribution: {
            excellent,
            good,
            fair,
            poor,
          },
        });
      }

      return stats.sort((a, b) => b.averageScore - a.averageScore);
    } catch (error: any) {
      logger.error('Error getting quality statistics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get quality trends over time
   */
  static async getQualityTrends(
    metricType: QualityMetricType,
    startDate: string,
    endDate: string,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{
    period: string;
    averageScore: number;
    count: number;
    excellentRate: number;
    goodRate: number;
  }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('quality_metrics')
        .select('score, timestamp')
        .eq('metric_type', metricType)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by time interval
      const grouped = new Map<string, number[]>();

      for (const row of data) {
        const date = new Date(row.timestamp);
        let period: string;

        if (interval === 'hour') {
          period = date.toISOString().slice(0, 13) + ':00:00Z';
        } else if (interval === 'day') {
          period = date.toISOString().slice(0, 10);
        } else {
          // week
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().slice(0, 10);
        }

        if (!grouped.has(period)) {
          grouped.set(period, []);
        }
        grouped.get(period)!.push(row.score);
      }

      // Calculate statistics for each period
      const trends: Array<{
        period: string;
        averageScore: number;
        count: number;
        excellentRate: number;
        goodRate: number;
      }> = [];

      for (const [period, scores] of grouped.entries()) {
        const count = scores.length;
        const sum = scores.reduce((s, score) => s + score, 0);
        const averageScore = sum / count;
        const excellent = scores.filter(s => s >= 90).length;
        const good = scores.filter(s => s >= 70 && s < 90).length;
        const excellentRate = (excellent / count) * 100;
        const goodRate = (good / count) * 100;

        trends.push({
          period,
          averageScore: Math.round(averageScore * 100) / 100,
          count,
          excellentRate: Math.round(excellentRate * 100) / 100,
          goodRate: Math.round(goodRate * 100) / 100,
        });
      }

      return trends.sort((a, b) => a.period.localeCompare(b.period));
    } catch (error: any) {
      logger.error('Error getting quality trends', {
        error: error.message,
      });
      throw error;
    }
  }
}

export default QualityMetricsService;
