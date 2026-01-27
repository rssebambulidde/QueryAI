/**
 * Cache Management Routes
 * API endpoints for cache invalidation and management
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { CacheInvalidationService, InvalidationOptions } from '../services/cache-invalidation.service';
import { RedisCacheService } from '../services/redis-cache.service';
import { RAGService } from '../services/rag.service';
import { EmbeddingService } from '../services/embedding.service';
import { AsyncMonitorService } from '../services/async-monitor.service';
import { RetryService } from '../services/retry.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { DegradationService } from '../services/degradation.service';
import { ErrorRecoveryService } from '../services/error-recovery.service';
import { ValidationError } from '../types/error';
import logger from '../config/logger';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get(
  '/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const health = await RedisCacheService.healthCheck();
    
    res.json({
      success: true,
      data: {
        healthy: health.healthy,
        configured: health.configured,
        stats: health.stats,
        embeddingStats: health.embeddingStats,
        ragStats: health.ragStats,
      },
    });
  })
);

/**
 * GET /api/cache/version
 * Get current cache version
 */
router.get(
  '/version',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const version = await CacheInvalidationService.getCacheVersion();
    
    res.json({
      success: true,
      data: {
        version: version?.version || 'v0',
        createdAt: version?.createdAt,
        updatedAt: version?.updatedAt,
      },
    });
  })
);

/**
 * POST /api/cache/invalidate/document
 * Invalidate cache for specific documents
 */
router.post(
  '/invalidate/document',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { documentIds, options } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('documentIds array is required');
    }

    const invalidationOptions: InvalidationOptions = {
      invalidateRAG: options?.invalidateRAG !== false,
      invalidateEmbeddings: options?.invalidateEmbeddings || false,
      invalidateSearch: options?.invalidateSearch || false,
      reason: options?.reason || 'Document cache invalidation',
    };

    const result = await CacheInvalidationService.invalidateDocumentCache(
      userId,
      documentIds,
      invalidationOptions
    );

    res.json({
      success: result.success,
      message: result.success
        ? 'Document cache invalidated successfully'
        : 'Document cache invalidation completed with errors',
      data: result,
    });
  })
);

/**
 * POST /api/cache/invalidate/topic
 * Invalidate cache for a topic
 */
router.post(
  '/invalidate/topic',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { topicId, options } = req.body;

    if (!topicId) {
      throw new ValidationError('topicId is required');
    }

    const invalidationOptions: InvalidationOptions = {
      invalidateRAG: options?.invalidateRAG !== false,
      reason: options?.reason || 'Topic cache invalidation',
    };

    const result = await CacheInvalidationService.invalidateTopicCache(
      userId,
      topicId,
      invalidationOptions
    );

    res.json({
      success: result.success,
      message: result.success
        ? 'Topic cache invalidated successfully'
        : 'Topic cache invalidation completed with errors',
      data: result,
    });
  })
);

/**
 * POST /api/cache/invalidate/user
 * Invalidate all cache for the current user
 */
router.post(
  '/invalidate/user',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { options } = req.body;

    const invalidationOptions: InvalidationOptions = {
      invalidateRAG: options?.invalidateRAG !== false,
      invalidateAll: options?.invalidateAll || false,
      reason: options?.reason || 'User cache invalidation',
    };

    const result = await CacheInvalidationService.invalidateUserCache(
      userId,
      invalidationOptions
    );

    res.json({
      success: result.success,
      message: result.success
        ? 'User cache invalidated successfully'
        : 'User cache invalidation completed with errors',
      data: result,
    });
  })
);

/**
 * POST /api/cache/invalidate/time
 * Time-based cache invalidation (admin/system only)
 */
router.post(
  '/invalidate/time',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // This could be restricted to admin users only
    const { maxAgeSeconds, options } = req.body;

    if (!maxAgeSeconds || typeof maxAgeSeconds !== 'number' || maxAgeSeconds <= 0) {
      throw new ValidationError('maxAgeSeconds must be a positive number');
    }

    const invalidationOptions: InvalidationOptions = {
      invalidateRAG: options?.invalidateRAG !== false,
      invalidateEmbeddings: options?.invalidateEmbeddings || false,
      invalidateSearch: options?.invalidateSearch || false,
      reason: options?.reason || `Time-based invalidation (${maxAgeSeconds}s)`,
    };

    const result = await CacheInvalidationService.invalidateByTime(
      maxAgeSeconds,
      invalidationOptions
    );

    res.json({
      success: result.success,
      message: result.success
        ? 'Time-based cache invalidation completed'
        : 'Time-based cache invalidation completed with errors',
      data: result,
    });
  })
);

/**
 * POST /api/cache/invalidate/manual
 * Manual cache invalidation with custom options
 */
router.post(
  '/invalidate/manual',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { cacheType, pattern, options } = req.body;

    const invalidationOptions: InvalidationOptions & {
      cacheType?: 'rag' | 'embedding' | 'search' | 'all';
      pattern?: string;
    } = {
      invalidateRAG: options?.invalidateRAG !== false,
      invalidateEmbeddings: options?.invalidateEmbeddings || false,
      invalidateSearch: options?.invalidateSearch || false,
      cacheType: cacheType || 'all',
      pattern: pattern || '*',
      reason: options?.reason || 'Manual cache invalidation',
    };

    const result = await CacheInvalidationService.invalidateManually(
      userId,
      invalidationOptions
    );

    res.json({
      success: result.success,
      message: result.success
        ? 'Manual cache invalidation completed'
        : 'Manual cache invalidation completed with errors',
      data: result,
    });
  })
);

/**
 * POST /api/cache/clear
 * Clear all caches (admin/system only - use with caution)
 */
router.post(
  '/clear',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // This should be restricted to admin users only
    // For now, we'll allow authenticated users but log it
    const userId = req.user?.id;
    
    logger.warn('Clear all caches requested', {
      userId,
      timestamp: new Date().toISOString(),
    });

    const result = await CacheInvalidationService.clearAllCaches();

    res.json({
      success: result.success,
      message: result.success
        ? 'All caches cleared successfully'
        : 'Cache clearing completed with errors',
      data: result,
    });
  })
);

/**
 * GET /api/cache/history
 * Get cache invalidation history
 */
router.get(
  '/history',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (limit > 100) {
      throw new ValidationError('Limit cannot exceed 100');
    }

    const history = await CacheInvalidationService.getInvalidationHistory(limit);

    res.json({
      success: true,
      data: {
        history,
        count: history.length,
      },
    });
  })
);

/**
 * GET /api/cache/rag/stats
 * Get RAG cache statistics
 */
router.get(
  '/rag/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = RAGService.getRAGCacheStats();
    
    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/cache/embedding/batch-stats
 * Get batch processing statistics for embeddings
 */
router.get(
  '/embedding/batch-stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = EmbeddingService.getBatchProcessingStats();
    const cacheStats = EmbeddingService.getEmbeddingCacheStats();
    
    res.json({
      success: true,
      data: {
        batchProcessing: stats,
        cache: cacheStats,
      },
    });
  })
);

/**
 * POST /api/cache/rag/invalidate
 * Invalidate RAG cache with specific options
 */
router.post(
  '/rag/invalidate',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { type, topicId, documentIds } = req.body;

    let invalidated = 0;

    try {
      if (type === 'user') {
        invalidated = await RAGService.invalidateUserCache(userId);
      } else if (type === 'topic' && topicId) {
        invalidated = await RAGService.invalidateTopicCache(userId, topicId);
      } else if (type === 'document' && documentIds && Array.isArray(documentIds)) {
        invalidated = await RAGService.invalidateDocumentCache(userId, documentIds);
      } else {
        throw new ValidationError('Invalid invalidation type or missing parameters');
      }

      res.json({
        success: true,
        message: 'RAG cache invalidated successfully',
        data: {
          invalidated,
          type,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'RAG cache invalidation failed',
        error: error.message,
      });
    }
  })
);

/**
 * GET /api/cache/async/stats
 * Get async operation statistics and monitoring data
 */
router.get(
  '/async/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { operation } = req.query;
    
    let stats;
    if (operation && typeof operation === 'string') {
      stats = AsyncMonitorService.getOperationStats(operation);
      if (!stats) {
        return res.status(404).json({
          success: false,
          message: 'Operation not found',
        });
      }
    } else {
      stats = AsyncMonitorService.getAllStats();
    }

    const opportunities = AsyncMonitorService.getParallelizationOpportunities();
    const slowOperations = AsyncMonitorService.getSlowOperations(1000);

    res.json({
      success: true,
      data: {
        stats,
        opportunities,
        slowOperations: slowOperations.slice(0, 20), // Last 20 slow operations
        summary: {
          totalOperations: Object.keys(stats).length,
          totalOpportunities: opportunities.length,
          slowOperationsCount: slowOperations.length,
        },
      },
    });
  })
);

/**
 * GET /api/cache/retry/stats
 * Get retry service statistics
 */
router.get(
  '/retry/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = RetryService.getStats();

    res.json({
      success: true,
      data: {
        stats,
        summary: {
          totalAttempts: stats.totalAttempts,
          successfulRetries: stats.successfulRetries,
          failedRetries: stats.failedRetries,
          successRate: stats.totalAttempts > 0
            ? ((stats.totalAttempts - stats.failedRetries) / stats.totalAttempts) * 100
            : 0,
          averageRetries: stats.averageRetries,
        },
      },
    });
  })
);

/**
 * POST /api/cache/retry/reset-stats
 * Reset retry service statistics
 */
router.post(
  '/retry/reset-stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    RetryService.resetStats();

    res.json({
      success: true,
      message: 'Retry statistics reset',
    });
  })
);

/**
 * GET /api/cache/circuit-breaker/stats
 * Get circuit breaker statistics
 */
router.get(
  '/circuit-breaker/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { circuit } = req.query;
    
    let stats;
    if (circuit && typeof circuit === 'string') {
      stats = CircuitBreakerService.getStats(circuit);
    } else {
      stats = CircuitBreakerService.getStats();
    }

    const health = CircuitBreakerService.healthCheck();

    res.json({
      success: true,
      data: {
        stats,
        health,
        circuits: CircuitBreakerService.getBreakerNames(),
      },
    });
  })
);

/**
 * GET /api/cache/circuit-breaker/health
 * Get circuit breaker health status
 */
router.get(
  '/circuit-breaker/health',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const health = CircuitBreakerService.healthCheck();

    res.json({
      success: health.healthy,
      data: health,
    });
  })
);

/**
 * POST /api/cache/circuit-breaker/:circuit/reset
 * Manually reset a circuit breaker
 */
router.post(
  '/circuit-breaker/:circuit/reset',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { circuit } = req.params;

    try {
      CircuitBreakerService.reset(circuit);

      res.json({
        success: true,
        message: `Circuit breaker ${circuit} reset`,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  })
);

/**
 * POST /api/cache/circuit-breaker/:circuit/open
 * Manually open a circuit breaker
 */
router.post(
  '/circuit-breaker/:circuit/open',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { circuit } = req.params;

    try {
      CircuitBreakerService.open(circuit);

      res.json({
        success: true,
        message: `Circuit breaker ${circuit} opened`,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  })
);

/**
 * POST /api/cache/circuit-breaker/:circuit/close
 * Manually close a circuit breaker
 */
router.post(
  '/circuit-breaker/:circuit/close',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { circuit } = req.params;

    try {
      CircuitBreakerService.close(circuit);

      res.json({
        success: true,
        message: `Circuit breaker ${circuit} closed`,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  })
);

/**
 * GET /api/cache/degradation/stats
 * Get degradation service statistics
 */
router.get(
  '/degradation/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = DegradationService.getStatistics();
    const overallStatus = DegradationService.getOverallStatus();

    res.json({
      success: true,
      data: {
        statistics: stats,
        overallStatus,
      },
    });
  })
);

/**
 * POST /api/cache/degradation/reset
 * Reset degradation status for a service or all services
 */
router.post(
  '/degradation/reset',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { service } = req.body;

    if (service) {
      DegradationService.resetServiceStatus(service);
      res.json({
        success: true,
        message: `Degradation status reset for ${service}`,
      });
    } else {
      DegradationService.resetAllStatuses();
      res.json({
        success: true,
        message: 'All degradation statuses reset',
      });
    }
  })
);

/**
 * GET /api/cache/recovery/stats
 * Get error recovery statistics
 */
router.get(
  '/recovery/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = ErrorRecoveryService.getStats();

    res.json({
      success: true,
      data: {
        stats,
        summary: {
          totalAttempts: stats.totalAttempts,
          successfulRecoveries: stats.successfulRecoveries,
          failedRecoveries: stats.failedRecoveries,
          successRate: stats.successRate,
          averageRecoveryTime: stats.averageRecoveryTime,
        },
      },
    });
  })
);

/**
 * GET /api/cache/recovery/history
 * Get error recovery history
 */
router.get(
  '/recovery/history',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, service, category, strategy } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;

    let history = ErrorRecoveryService.getHistory(limitNum);

    // Filter by service if provided
    if (service && typeof service === 'string') {
      history = ErrorRecoveryService.getAttemptsByService(service as any);
    }

    // Filter by category if provided
    if (category && typeof category === 'string') {
      history = history.filter(
        attempt => attempt.errorCategory === category
      );
    }

    // Filter by strategy if provided
    if (strategy && typeof strategy === 'string') {
      history = history.filter(
        attempt => attempt.strategy === strategy
      );
    }

    res.json({
      success: true,
      data: {
        history: history.slice(-100), // Return last 100 entries
        total: history.length,
      },
    });
  })
);

/**
 * POST /api/cache/recovery/reset-stats
 * Reset error recovery statistics
 */
router.post(
  '/recovery/reset-stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    ErrorRecoveryService.resetStats();

    res.json({
      success: true,
      message: 'Recovery statistics reset',
    });
  })
);

export default router;
