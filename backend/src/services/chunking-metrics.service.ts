/**
 * Chunking Metrics Service
 * Provides comparison metrics between different chunking strategies
 */

import logger from '../config/logger';
import { ChunkingService, TextChunk } from './chunking.service';
import { SemanticChunkingService } from './semantic-chunking.service';
import { ChunkingOptions } from './chunking.service';

export interface ChunkingMetrics {
  chunkCount: number;
  avgChunkSize: number;
  totalTokens: number;
  minChunkSize: number;
  maxChunkSize: number;
  chunkSizeVariance: number;
  semanticCoherence?: number; // For semantic chunks - average similarity within chunks
}

export interface ChunkingComparison {
  semantic: ChunkingMetrics;
  sentence: ChunkingMetrics;
  improvement: {
    chunkCountDiff: number;
    chunkCountDiffPercent: number;
    avgChunkSizeDiff: number;
    avgChunkSizeDiffPercent: number;
    coherenceImprovement?: number;
  };
  recommendation: 'semantic' | 'sentence' | 'hybrid';
}

/**
 * Chunking Metrics Service
 * Analyzes and compares chunking strategies
 */
export class ChunkingMetricsService {
  /**
   * Calculate metrics for a set of chunks
   */
  static calculateMetrics(chunks: TextChunk[]): ChunkingMetrics {
    if (chunks.length === 0) {
      return {
        chunkCount: 0,
        avgChunkSize: 0,
        totalTokens: 0,
        minChunkSize: 0,
        maxChunkSize: 0,
        chunkSizeVariance: 0,
      };
    }

    const chunkSizes = chunks.map((c) => c.tokenCount);
    const totalTokens = chunkSizes.reduce((sum, size) => sum + size, 0);
    const avgChunkSize = totalTokens / chunks.length;
    const minChunkSize = Math.min(...chunkSizes);
    const maxChunkSize = Math.max(...chunkSizes);

    // Calculate variance
    const variance =
      chunkSizes.reduce((sum, size) => sum + Math.pow(size - avgChunkSize, 2), 0) /
      chunks.length;

    return {
      chunkCount: chunks.length,
      avgChunkSize,
      totalTokens,
      minChunkSize,
      maxChunkSize,
      chunkSizeVariance: variance,
    };
  }

  /**
   * Compare semantic vs sentence-based chunking
   */
  static async compareStrategies(
    text: string,
    options: ChunkingOptions = {}
  ): Promise<ChunkingComparison> {
    logger.info('Comparing chunking strategies', {
      textLength: text.length,
      options,
    });

    // Get semantic chunks
    let semanticChunks: TextChunk[] = [];
    try {
      const semanticResult = await ChunkingService.chunkTextAsync(text, {
        ...options,
        strategy: 'semantic',
      });
      semanticChunks = semanticResult;
    } catch (error: any) {
      logger.warn('Semantic chunking failed in comparison', {
        error: error.message,
      });
      // If semantic fails, use sentence-based as fallback
      semanticChunks = ChunkingService.chunkText(text, {
        ...options,
        strategy: 'sentence',
      });
    }

    // Get sentence-based chunks
    const sentenceChunks = ChunkingService.chunkText(text, {
      ...options,
      strategy: 'sentence',
    });

    // Calculate metrics
    const semanticMetrics = this.calculateMetrics(semanticChunks);
    const sentenceMetrics = this.calculateMetrics(sentenceChunks);

    // Calculate improvement
    const chunkCountDiff = semanticMetrics.chunkCount - sentenceMetrics.chunkCount;
    const chunkCountDiffPercent =
      sentenceMetrics.chunkCount > 0
        ? (chunkCountDiff / sentenceMetrics.chunkCount) * 100
        : 0;

    const avgChunkSizeDiff =
      semanticMetrics.avgChunkSize - sentenceMetrics.avgChunkSize;
    const avgChunkSizeDiffPercent =
      sentenceMetrics.avgChunkSize > 0
        ? (avgChunkSizeDiff / sentenceMetrics.avgChunkSize) * 100
        : 0;

    // Determine recommendation
    let recommendation: 'semantic' | 'sentence' | 'hybrid' = 'sentence';
    
    // Prefer semantic if:
    // - Similar chunk count (not too many more chunks)
    // - Better size distribution (lower variance)
    // - Similar total tokens (efficiency)
    if (
      chunkCountDiffPercent <= 20 && // Not more than 20% more chunks
      semanticMetrics.chunkSizeVariance < sentenceMetrics.chunkSizeVariance && // Better distribution
      Math.abs(semanticMetrics.totalTokens - sentenceMetrics.totalTokens) <
        sentenceMetrics.totalTokens * 0.1 // Similar total tokens
    ) {
      recommendation = 'semantic';
    } else if (
      chunkCountDiffPercent <= 10 &&
      semanticMetrics.chunkSizeVariance < sentenceMetrics.chunkSizeVariance
    ) {
      recommendation = 'hybrid';
    }

    const comparison: ChunkingComparison = {
      semantic: semanticMetrics,
      sentence: sentenceMetrics,
      improvement: {
        chunkCountDiff,
        chunkCountDiffPercent,
        avgChunkSizeDiff,
        avgChunkSizeDiffPercent,
      },
      recommendation,
    };

    logger.info('Chunking strategy comparison completed', {
      semanticChunks: semanticMetrics.chunkCount,
      sentenceChunks: sentenceMetrics.chunkCount,
      recommendation,
    });

    return comparison;
  }

  /**
   * Generate comparison report
   */
  static async generateComparisonReport(
    text: string,
    options: ChunkingOptions = {}
  ): Promise<string> {
    const comparison = await this.compareStrategies(text, options);

    const report = `
Chunking Strategy Comparison Report
====================================

Semantic Chunking:
  - Chunk Count: ${comparison.semantic.chunkCount}
  - Avg Chunk Size: ${comparison.semantic.avgChunkSize.toFixed(2)} tokens
  - Total Tokens: ${comparison.semantic.totalTokens}
  - Size Range: ${comparison.semantic.minChunkSize} - ${comparison.semantic.maxChunkSize} tokens
  - Variance: ${comparison.semantic.chunkSizeVariance.toFixed(2)}

Sentence-Based Chunking:
  - Chunk Count: ${comparison.sentence.chunkCount}
  - Avg Chunk Size: ${comparison.sentence.avgChunkSize.toFixed(2)} tokens
  - Total Tokens: ${comparison.sentence.totalTokens}
  - Size Range: ${comparison.sentence.minChunkSize} - ${comparison.sentence.maxChunkSize} tokens
  - Variance: ${comparison.sentence.chunkSizeVariance.toFixed(2)}

Improvement:
  - Chunk Count Difference: ${comparison.improvement.chunkCountDiff} (${comparison.improvement.chunkCountDiffPercent.toFixed(2)}%)
  - Avg Size Difference: ${comparison.improvement.avgChunkSizeDiff.toFixed(2)} tokens (${comparison.improvement.avgChunkSizeDiffPercent.toFixed(2)}%)

Recommendation: ${comparison.recommendation.toUpperCase()}
`;

    return report.trim();
  }
}
