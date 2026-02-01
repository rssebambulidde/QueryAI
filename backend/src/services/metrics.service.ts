/**
 * Retrieval Quality Metrics Service
 * Tracks and calculates retrieval quality metrics (precision, recall, MRR)
 */

import logger from '../config/logger';
import { supabaseAdmin } from '../config/database';
import { DocumentContext } from './rag.service';

export interface RetrievalMetrics {
  query: string;
  userId: string;
  queryId?: string;
  timestamp: number;
  // Retrieval metrics
  totalRetrieved: number;
  totalRelevant: number;
  relevantRetrieved: number;
  precision: number;
  recall: number;
  f1Score: number;
  // Ranking metrics
  meanReciprocalRank: number;
  averagePrecision: number;
  ndcg?: number; // Normalized Discounted Cumulative Gain
  // Context metrics
  documentChunksRetrieved: number;
  webResultsRetrieved: number;
  totalSources: number;
  // Quality indicators
  minScore?: number;
  maxScore?: number;
  averageScore?: number;
  // Metadata
  searchTypes?: {
    semantic?: boolean;
    keyword?: boolean;
    hybrid?: boolean;
    web?: boolean;
  };
  topicId?: string;
  documentIds?: string[];
}

export interface MetricsQuery {
  userId?: string;
  startDate?: string;
  endDate?: string;
  topicId?: string;
  limit?: number;
  offset?: number;
}

export interface AggregatedMetrics {
  totalQueries: number;
  averagePrecision: number;
  averageRecall: number;
  averageF1Score: number;
  averageMRR: number;
  averageAP: number;
  averageNDCG?: number;
  queries: RetrievalMetrics[];
}

/**
 * Retrieval Quality Metrics Service
 * Collects and calculates retrieval quality metrics
 */
export class MetricsService {
  /**
   * Calculate precision
   * Precision = relevant retrieved / total retrieved
   */
  static calculatePrecision(relevantRetrieved: number, totalRetrieved: number): number {
    if (totalRetrieved === 0) return 0;
    return relevantRetrieved / totalRetrieved;
  }

  /**
   * Calculate recall
   * Recall = relevant retrieved / total relevant
   */
  static calculateRecall(relevantRetrieved: number, totalRelevant: number): number {
    if (totalRelevant === 0) return 0;
    return relevantRetrieved / totalRelevant;
  }

  /**
   * Calculate F1 score
   * F1 = 2 * (precision * recall) / (precision + recall)
   */
  static calculateF1Score(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  /**
   * Calculate Mean Reciprocal Rank (MRR)
   * MRR = average of 1/rank of first relevant document
   */
  static calculateMRR(ranks: number[]): number {
    if (ranks.length === 0) return 0;
    const reciprocalRanks = ranks.map(rank => rank > 0 ? 1 / rank : 0);
    return reciprocalRanks.reduce((sum, rr) => sum + rr, 0) / reciprocalRanks.length;
  }

  /**
   * Calculate Average Precision (AP)
   * AP = average of precision at each relevant document position
   */
  static calculateAveragePrecision(
    retrieved: Array<{ relevant: boolean; rank: number }>
  ): number {
    const relevantRetrieved = retrieved.filter(r => r.relevant);
    if (relevantRetrieved.length === 0) return 0;

    let precisionSum = 0;
    let relevantCount = 0;

    for (let i = 0; i < retrieved.length; i++) {
      if (retrieved[i].relevant) {
        relevantCount++;
        const precisionAtI = relevantCount / (i + 1);
        precisionSum += precisionAtI;
      }
    }

    return precisionSum / relevantRetrieved.length;
  }

  /**
   * Calculate Normalized Discounted Cumulative Gain (NDCG)
   * NDCG = DCG / IDCG
   */
  static calculateNDCG(
    retrieved: Array<{ relevant: boolean; score: number; rank: number }>,
    idealRelevance: number[]
  ): number {
    if (retrieved.length === 0) return 0;

    // Calculate DCG (Discounted Cumulative Gain)
    let dcg = 0;
    for (let i = 0; i < retrieved.length; i++) {
      const relevance = retrieved[i].relevant ? (retrieved[i].score || 1) : 0;
      const position = i + 1;
      dcg += relevance / Math.log2(position + 1);
    }

    // Calculate IDCG (Ideal DCG)
    const sortedRelevance = [...idealRelevance].sort((a, b) => b - a);
    let idcg = 0;
    for (let i = 0; i < Math.min(sortedRelevance.length, retrieved.length); i++) {
      idcg += sortedRelevance[i] / Math.log2(i + 2);
    }

    if (idcg === 0) return 0;
    return dcg / idcg;
  }

  /**
   * Collect retrieval metrics
   * Note: This requires relevance information (user feedback or ground truth)
   */
  static async collectMetrics(
    query: string,
    userId: string,
    retrievedDocuments: DocumentContext[],
    relevantDocumentIds?: string[], // Ground truth or user feedback
    options?: {
      queryId?: string;
      topicId?: string;
      documentIds?: string[];
      searchTypes?: {
        semantic?: boolean;
        keyword?: boolean;
        hybrid?: boolean;
        web?: boolean;
      };
      webResultsCount?: number;
    }
  ): Promise<RetrievalMetrics> {
    const timestamp = Date.now();
    const totalRetrieved = retrievedDocuments.length;
    
    // If relevance information is not provided, we can't calculate precision/recall
    // In that case, we'll use score-based heuristics or default to 0
    let totalRelevant = relevantDocumentIds?.length || 0;
    let relevantRetrieved = 0;
    const ranks: number[] = [];
    const retrievedWithRelevance: Array<{ relevant: boolean; rank: number; score: number }> = [];

    if (relevantDocumentIds && relevantDocumentIds.length > 0) {
      // Calculate relevant retrieved
      for (let i = 0; i < retrievedDocuments.length; i++) {
        const doc = retrievedDocuments[i];
        const isRelevant = relevantDocumentIds.includes(doc.documentId);
        if (isRelevant) {
          relevantRetrieved++;
          ranks.push(i + 1); // Rank is 1-indexed
        }
        retrievedWithRelevance.push({
          relevant: isRelevant,
          rank: i + 1,
          score: doc.score || 0,
        });
      }
    } else {
      // No relevance information - use score-based heuristic
      // Consider documents with score > 0.7 as potentially relevant
      const scoreThreshold = 0.7;
      for (let i = 0; i < retrievedDocuments.length; i++) {
        const doc = retrievedDocuments[i];
        const isRelevant = (doc.score || 0) >= scoreThreshold;
        if (isRelevant) {
          relevantRetrieved++;
          ranks.push(i + 1);
        }
        retrievedWithRelevance.push({
          relevant: isRelevant,
          rank: i + 1,
          score: doc.score || 0,
        });
      }
      totalRelevant = relevantRetrieved; // Estimate
    }

    // Calculate metrics
    const precision = this.calculatePrecision(relevantRetrieved, totalRetrieved);
    const recall = this.calculateRecall(relevantRetrieved, totalRelevant);
    const f1Score = this.calculateF1Score(precision, recall);
    const mrr = this.calculateMRR(ranks);
    const averagePrecision = this.calculateAveragePrecision(retrievedWithRelevance);

    // Calculate score statistics
    const scores = retrievedDocuments.map(d => d.score || 0).filter(s => s > 0);
    const minScore = scores.length > 0 ? Math.min(...scores) : undefined;
    const maxScore = scores.length > 0 ? Math.max(...scores) : undefined;
    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : undefined;

    // Calculate NDCG if we have ideal relevance scores
    let ndcg: number | undefined;
    if (relevantDocumentIds && relevantDocumentIds.length > 0) {
      // Use score as relevance for ideal ranking
      const idealScores = retrievedDocuments
        .filter(d => relevantDocumentIds.includes(d.documentId))
        .map(d => d.score || 1)
        .sort((a, b) => b - a);
      ndcg = this.calculateNDCG(retrievedWithRelevance, idealScores);
    }

    const metrics: RetrievalMetrics = {
      query,
      userId,
      queryId: options?.queryId,
      timestamp,
      totalRetrieved,
      totalRelevant,
      relevantRetrieved,
      precision,
      recall,
      f1Score,
      meanReciprocalRank: mrr,
      averagePrecision,
      ndcg,
      documentChunksRetrieved: totalRetrieved,
      webResultsRetrieved: options?.webResultsCount || 0,
      totalSources: totalRetrieved + (options?.webResultsCount || 0),
      minScore,
      maxScore,
      averageScore,
      searchTypes: options?.searchTypes,
      topicId: options?.topicId,
      documentIds: options?.documentIds,
    };

    // Store metrics in database
    await this.storeMetrics(metrics);

    logger.info('Retrieval metrics collected', {
      userId,
      query: query.substring(0, 100),
      precision,
      recall,
      f1Score,
      mrr,
      totalRetrieved,
    });

    return metrics;
  }

  /**
   * Store metrics in database
   */
  private static async storeMetrics(metrics: RetrievalMetrics): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('retrieval_metrics')
        .insert({
          query: metrics.query,
          user_id: metrics.userId,
          query_id: metrics.queryId,
          timestamp: new Date(metrics.timestamp).toISOString(),
          total_retrieved: metrics.totalRetrieved,
          total_relevant: metrics.totalRelevant,
          relevant_retrieved: metrics.relevantRetrieved,
          precision: metrics.precision,
          recall: metrics.recall,
          f1_score: metrics.f1Score,
          mean_reciprocal_rank: metrics.meanReciprocalRank,
          average_precision: metrics.averagePrecision,
          ndcg: metrics.ndcg,
          document_chunks_retrieved: metrics.documentChunksRetrieved,
          web_results_retrieved: metrics.webResultsRetrieved,
          total_sources: metrics.totalSources,
          min_score: metrics.minScore,
          max_score: metrics.maxScore,
          average_score: metrics.averageScore,
          search_types: metrics.searchTypes,
          topic_id: metrics.topicId,
          document_ids: metrics.documentIds,
        });

      if (error) {
        logger.error('Failed to store retrieval metrics', {
          error: error.message,
          userId: metrics.userId,
        });
      }
    } catch (error: any) {
      logger.error('Error storing retrieval metrics', {
        error: error.message,
        userId: metrics.userId,
      });
    }
  }

  /**
   * Get metrics for queries
   */
  static async getMetrics(query: MetricsQuery): Promise<AggregatedMetrics> {
    try {
      let dbQuery = supabaseAdmin
        .from('retrieval_metrics')
        .select('*')
        .order('timestamp', { ascending: false });

      if (query.userId) {
        dbQuery = dbQuery.eq('user_id', query.userId);
      }

      if (query.startDate) {
        dbQuery = dbQuery.gte('timestamp', query.startDate);
      }

      if (query.endDate) {
        dbQuery = dbQuery.lte('timestamp', query.endDate);
      }

      if (query.topicId) {
        dbQuery = dbQuery.eq('topic_id', query.topicId);
      }

      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      if (query.offset) {
        dbQuery = dbQuery.range(query.offset, query.offset + (query.limit || 100) - 1);
      }

      const { data, error } = await dbQuery;

      if (error) {
        logger.error('Failed to get retrieval metrics', {
          error: error.message,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          totalQueries: 0,
          averagePrecision: 0,
          averageRecall: 0,
          averageF1Score: 0,
          averageMRR: 0,
          averageAP: 0,
          queries: [],
        };
      }

      // Convert database records to RetrievalMetrics
      const queries: RetrievalMetrics[] = data.map((row: any) => ({
        query: row.query,
        userId: row.user_id,
        queryId: row.query_id,
        timestamp: new Date(row.timestamp).getTime(),
        totalRetrieved: row.total_retrieved,
        totalRelevant: row.total_relevant,
        relevantRetrieved: row.relevant_retrieved,
        precision: row.precision,
        recall: row.recall,
        f1Score: row.f1_score,
        meanReciprocalRank: row.mean_reciprocal_rank,
        averagePrecision: row.average_precision,
        ndcg: row.ndcg,
        documentChunksRetrieved: row.document_chunks_retrieved,
        webResultsRetrieved: row.web_results_retrieved,
        totalSources: row.total_sources,
        minScore: row.min_score,
        maxScore: row.max_score,
        averageScore: row.average_score,
        searchTypes: row.search_types,
        topicId: row.topic_id,
        documentIds: row.document_ids,
      }));

      // Calculate aggregated metrics
      const totalQueries = queries.length;
      const averagePrecision = queries.reduce((sum, q) => sum + q.precision, 0) / totalQueries;
      const averageRecall = queries.reduce((sum, q) => sum + q.recall, 0) / totalQueries;
      const averageF1Score = queries.reduce((sum, q) => sum + q.f1Score, 0) / totalQueries;
      const averageMRR = queries.reduce((sum, q) => sum + q.meanReciprocalRank, 0) / totalQueries;
      const averageAP = queries.reduce((sum, q) => sum + q.averagePrecision, 0) / totalQueries;
      const ndcgValues = queries.filter(q => q.ndcg !== undefined).map(q => q.ndcg!);
      const averageNDCG = ndcgValues.length > 0
        ? ndcgValues.reduce((sum, n) => sum + n, 0) / ndcgValues.length
        : undefined;

      return {
        totalQueries,
        averagePrecision,
        averageRecall,
        averageF1Score,
        averageMRR,
        averageAP,
        averageNDCG,
        queries,
      };
    } catch (error: any) {
      logger.error('Error getting retrieval metrics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get metrics summary
   */
  static async getMetricsSummary(userId?: string): Promise<{
    totalQueries: number;
    averagePrecision: number;
    averageRecall: number;
    averageF1Score: number;
    averageMRR: number;
    averageAP: number;
    averageNDCG?: number;
    dateRange: {
      start: string;
      end: string;
    };
  }> {
    const metrics = await this.getMetrics({ userId, limit: 1000 });
    
    return {
      totalQueries: metrics.totalQueries,
      averagePrecision: metrics.averagePrecision,
      averageRecall: metrics.averageRecall,
      averageF1Score: metrics.averageF1Score,
      averageMRR: metrics.averageMRR,
      averageAP: metrics.averageAP,
      averageNDCG: metrics.averageNDCG,
      dateRange: {
        start: metrics.queries.length > 0
          ? new Date(Math.min(...metrics.queries.map(q => q.timestamp))).toISOString()
          : new Date().toISOString(),
        end: metrics.queries.length > 0
          ? new Date(Math.max(...metrics.queries.map(q => q.timestamp))).toISOString()
          : new Date().toISOString(),
      },
    };
  }
}

export default MetricsService;
