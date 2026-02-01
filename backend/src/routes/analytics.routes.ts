import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { CostAnalyticsService, type CostInterval } from '../services/cost-analytics.service';
import * as AlertService from '../services/alert.service';
import { MonitoringService, type UsageBucket } from '../services/monitoring.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import { apiLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/analytics/cost/summary
 * Cost summary for the authenticated user (startDate, endDate query params).
 */
router.get(
  '/cost/summary',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const start = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const end = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const summary = await CostAnalyticsService.getCostSummary(userId, start, end);
    res.json({ success: true, data: summary });
  })
);

/**
 * GET /api/analytics/cost/trends
 * Cost trends over time (Super Admin only). Query: startDate, endDate, interval (hour|day|week).
 */
router.get(
  '/cost/trends',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    const interval = (req.query.interval as CostInterval) || 'day';
    if (!['hour', 'day', 'week'].includes(interval)) {
      throw new ValidationError('interval must be hour, day, or week');
    }

    const trends = await CostAnalyticsService.getCostTrends(
      userId,
      startDate,
      endDate,
      interval
    );
    res.json({ success: true, data: { trends, interval, startDate, endDate } });
  })
);

/**
 * GET /api/analytics/alerts
 * Get active or recent alerts (Super Admin only). Query: activeOnly, limit.
 */
router.get(
  '/alerts',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const activeOnly = req.query.activeOnly === 'true';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const list = activeOnly
      ? AlertService.getActiveAlerts(userId)
      : AlertService.getRecentAlerts(limit, userId);
    res.json({ success: true, data: { alerts: list } });
  })
);

/**
 * POST /api/analytics/alerts/check
 * Run cost/profitability checks for the current user (Super Admin only). Body: costThresholdUsd, minMarginPercent, etc.
 * Define before /alerts/:id/acknowledge so "check" is not matched as :id.
 */
router.post(
  '/alerts/check',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const body = (req.body || {}) as {
      costThresholdUsd?: number;
      costPeriodDays?: number;
      minMarginPercent?: number;
      profitabilityPeriodDays?: number;
    };
    const raised = await AlertService.runAlertChecks(userId, {
      costThresholdUsd: body.costThresholdUsd,
      costPeriodDays: body.costPeriodDays,
      minMarginPercent: body.minMarginPercent,
      profitabilityPeriodDays: body.profitabilityPeriodDays,
    });
    res.json({ success: true, data: { raised } });
  })
);

/**
 * POST /api/analytics/alerts/:id/acknowledge
 * Acknowledge an alert (Super Admin only, must belong to current user).
 */
router.post(
  '/alerts/:id/acknowledge',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const recent = AlertService.getRecentAlerts(500, userId);
    const alert = recent.find((a) => a.id === id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    AlertService.acknowledgeAlert(id);
    return res.json({ success: true, data: { acknowledged: true } });
  })
);

/**
 * GET /api/analytics/monitoring/usage
 * Usage analytics over time (Super Admin only). Query: startDate, endDate, interval (hour|day|week).
 */
router.get(
  '/monitoring/usage',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const startDate = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDate = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      throw new ValidationError('startDate and endDate are required');
    }

    const interval = (req.query.interval as UsageBucket) || 'day';
    if (!['hour', 'day', 'week'].includes(interval)) {
      throw new ValidationError('interval must be hour, day, or week');
    }

    const result = await MonitoringService.getUsageAnalytics(
      startDate,
      endDate,
      interval,
      userId
    );
    return res.json({ success: true, data: result });
  })
);

/**
 * GET /api/analytics/monitoring/performance
 * Aggregated performance summary (Super Admin only). Query: startDate, endDate.
 */
router.get(
  '/monitoring/performance',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const startDate = Array.isArray(req.query.startDate) ? req.query.startDate[0] : req.query.startDate;
    const endDate = Array.isArray(req.query.endDate) ? req.query.endDate[0] : req.query.endDate;
    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
      throw new ValidationError('startDate and endDate are required');
    }

    const summary = await MonitoringService.getPerformanceSummary(
      startDate,
      endDate,
      userId
    );
    return res.json({ success: true, data: summary });
  })
);

/**
 * GET /api/analytics/overview
 * Get complete analytics overview (Super Admin only)
 */
router.get(
  '/overview',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
 * Get query statistics (Super Admin only)
 */
router.get(
  '/query-statistics',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
 * Get top queries (Super Admin only)
 */
router.get(
  '/top-queries',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
 * Get API usage metrics (Super Admin only)
 */
router.get(
  '/api-usage',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
 * Get usage by date for charts (Super Admin only)
 */
router.get(
  '/usage-by-date',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
