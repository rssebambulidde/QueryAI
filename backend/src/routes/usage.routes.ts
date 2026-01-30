import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { UsageService } from '../services/usage.service';
import { CostTrackingService } from '../services/cost-tracking.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/usage/current
 * Get current usage statistics for authenticated user
 */
router.get(
  '/current',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    logger.info('Fetching current usage', { userId });

    const usage = await UsageService.getCurrentUsage(userId);

    if (!usage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Usage data not found',
          code: 'USAGE_NOT_FOUND',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        usage,
      },
    });
  })
);

/**
 * GET /api/usage/history
 * Get usage history for authenticated user
 * Query params: days (default: 30)
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    logger.info('Fetching usage history', { userId, days });

    const history = await UsageService.getUsageHistory(userId, days);

    res.json({
      success: true,
      data: {
        history,
        days,
      },
    });
  })
);

/**
 * GET /api/usage/warnings
 * Check if user is approaching limits
 */
router.get(
  '/warnings',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    logger.info('Checking usage warnings', { userId });

    const warnings = await UsageService.isApproachingLimits(userId);

    res.json({
      success: true,
      data: warnings,
    });
  })
);

/**
 * GET /api/usage/cost-stats
 * Get cost statistics for authenticated user
 * Query params: startDate, endDate (ISO date strings)
 */
router.get(
  '/cost-stats',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    logger.info('Fetching cost statistics', { userId, startDate, endDate });

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const stats = await CostTrackingService.getUserCostStats(userId, start, end);

    res.json({
      success: true,
      data: stats,
    });
  })
);

export default router;
