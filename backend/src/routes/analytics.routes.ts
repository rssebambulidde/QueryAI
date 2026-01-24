import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/analytics/overview
 * Get complete analytics overview (Premium/Pro only)
 */
router.get(
  '/overview',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Check subscription tier (Premium/Pro only)
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription || (subscription.tier !== 'premium' && subscription.tier !== 'pro')) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Analytics dashboard is only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    if (days < 1 || days > 365) {
      throw new ValidationError('Days must be between 1 and 365');
    }

    logger.info('Fetching analytics overview', { userId, days });

    const overview = await AnalyticsService.getAnalyticsOverview(userId, days);

    res.status(200).json({
      success: true,
      data: overview,
    });
  })
);

/**
 * GET /api/analytics/query-statistics
 * Get query statistics (Premium/Pro only)
 */
router.get(
  '/query-statistics',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Check subscription tier
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription || (subscription.tier !== 'premium' && subscription.tier !== 'pro')) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Analytics dashboard is only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
      return;
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const statistics = await AnalyticsService.getQueryStatistics(userId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: statistics,
    });
  })
);

/**
 * GET /api/analytics/top-queries
 * Get top queries (Premium/Pro only)
 */
router.get(
  '/top-queries',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Check subscription tier
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription || (subscription.tier !== 'premium' && subscription.tier !== 'pro')) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Analytics dashboard is only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;
    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const topQueries = await AnalyticsService.getTopQueries(userId, limit, startDate, endDate);

    res.status(200).json({
      success: true,
      data: { queries: topQueries },
    });
  })
);

/**
 * GET /api/analytics/api-usage
 * Get API usage metrics (Premium/Pro only)
 */
router.get(
  '/api-usage',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Check subscription tier
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription || (subscription.tier !== 'premium' && subscription.tier !== 'pro')) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Analytics dashboard is only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
      return;
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const metrics = await AnalyticsService.getAPIUsageMetrics(userId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: metrics,
    });
  })
);

/**
 * GET /api/analytics/usage-by-date
 * Get usage by date for charts (Premium/Pro only)
 */
router.get(
  '/usage-by-date',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Check subscription tier
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription || (subscription.tier !== 'pro')) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Usage charts are only available for Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    if (days < 1 || days > 365) {
      throw new ValidationError('Days must be between 1 and 365');
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const usageByDate = await AnalyticsService.getUsageByDate(userId, days, startDate, endDate);

    res.status(200).json({
      success: true,
      data: { usage: usageByDate },
    });
  })
);

export default router;
