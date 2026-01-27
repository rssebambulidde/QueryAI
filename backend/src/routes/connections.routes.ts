/**
 * Connection Pool Monitoring Routes
 * Provides endpoints for monitoring database and API connection pools
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { apiLimiter } from '../middleware/rateLimiter';
import { DatabasePool } from '../config/database.config';
import { OpenAIPool } from '../config/openai.config';
import { ValidationError } from '../types/error';

const router = Router();

/**
 * GET /api/connections/stats
 * Get connection pool statistics for all pools
 */
router.get(
  '/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const databaseStats = DatabasePool.getStats();
    const databaseConfig = DatabasePool.getPoolConfig();
    const openaiStats = OpenAIPool.getStats();
    const openaiConfig = OpenAIPool.getPoolConfig();
    const openaiQueue = OpenAIPool.getQueueStatus();

    res.json({
      success: true,
      data: {
        database: {
          stats: databaseStats,
          config: databaseConfig,
        },
        openai: {
          stats: openaiStats,
          config: openaiConfig,
          queue: openaiQueue,
        },
      },
    });
  })
);

/**
 * GET /api/connections/database/stats
 * Get database connection pool statistics
 */
router.get(
  '/database/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = DatabasePool.getStats();
    const config = DatabasePool.getPoolConfig();

    res.json({
      success: true,
      data: {
        stats,
        config,
      },
    });
  })
);

/**
 * GET /api/connections/database/health
 * Get database connection health
 */
router.get(
  '/database/health',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const health = await DatabasePool.healthCheck();

    res.json({
      success: health.healthy,
      data: {
        healthy: health.healthy,
        message: health.message,
        stats: health.stats,
      },
    });
  })
);

/**
 * POST /api/connections/database/reset-stats
 * Reset database connection statistics
 */
router.post(
  '/database/reset-stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    DatabasePool.resetStats();

    res.json({
      success: true,
      message: 'Database connection statistics reset',
    });
  })
);

/**
 * GET /api/connections/openai/stats
 * Get OpenAI connection pool statistics
 */
router.get(
  '/openai/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = OpenAIPool.getStats();
    const config = OpenAIPool.getPoolConfig();
    const queue = OpenAIPool.getQueueStatus();

    res.json({
      success: true,
      data: {
        stats,
        config,
        queue,
      },
    });
  })
);

/**
 * GET /api/connections/openai/health
 * Get OpenAI connection health
 */
router.get(
  '/openai/health',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const health = await OpenAIPool.healthCheck();

    res.json({
      success: health.healthy,
      data: {
        healthy: health.healthy,
        message: health.message,
        stats: health.stats,
      },
    });
  })
);

/**
 * GET /api/connections/openai/queue
 * Get OpenAI request queue status
 */
router.get(
  '/openai/queue',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const queue = OpenAIPool.getQueueStatus();

    res.json({
      success: true,
      data: queue,
    });
  })
);

/**
 * POST /api/connections/openai/reset-stats
 * Reset OpenAI connection statistics
 */
router.post(
  '/openai/reset-stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    OpenAIPool.resetStats();

    res.json({
      success: true,
      message: 'OpenAI connection statistics reset',
    });
  })
);

export default router;
