import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { CostAnalyticsService, type CostInterval } from '../services/cost-analytics.service';
import * as AlertService from '../services/alert.service';
import { MonitoringService, type UsageBucket } from '../services/monitoring.service';
import { CitationClickService } from '../services/citation-click.service';
import { CitedSourceService } from '../services/cited-source.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import { apiLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import { validateUUIDParams } from '../validation/uuid';
import { DatabaseService } from '../services/database.service';
import { supabaseAdmin } from '../config/database';
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
  validateUUIDParams('id'),
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

/**
 * GET /api/analytics/regeneration-quality
 * Tracks how regenerations affect answer quality compared to originals.
 * Super Admin only.  Query: ?days=30
 */
router.get(
  '/regeneration-quality',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(req.query.days as string, 10) || 30, 365);

    const { data, error } = await supabaseAdmin
      .rpc('get_regeneration_quality_stats', { p_days: days });

    if (error) {
      logger.error('Failed to fetch regeneration quality stats', { error: error.message });
      throw new ValidationError(`Failed to fetch stats: ${error.message}`);
    }

    // The RPC returns a single row
    const stats = Array.isArray(data) ? data[0] : data;

    res.status(200).json({
      success: true,
      data: {
        period: `${days} days`,
        totalRegenerations: Number(stats?.total_regenerations ?? 0),
        avgVersionCount: Number(stats?.avg_version_count ?? 0),
        qualityImproved: Number(stats?.quality_improved ?? 0),
        qualityUnchanged: Number(stats?.quality_unchanged ?? 0),
        qualityDeclined: Number(stats?.quality_declined ?? 0),
        avgQualityDelta: Number(stats?.avg_quality_delta ?? 0),
      },
    });
  })
);

// ═══════════════════════════════════════════════════════════════════════
// Citation click-through analytics
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/analytics/citation-click
 * Record a citation click event. Authenticated users only.
 */
router.post(
  '/citation-click',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { messageId, sourceIndex, sourceUrl, sourceType, conversationId } = req.body;

    if (sourceIndex === undefined || sourceIndex === null || typeof sourceIndex !== 'number') {
      throw new ValidationError('sourceIndex is required and must be a number');
    }
    if (!sourceType || !['document', 'web'].includes(sourceType)) {
      throw new ValidationError('sourceType must be "document" or "web"');
    }

    const clickId = await CitationClickService.recordClick({
      userId: req.user!.id,
      conversationId: conversationId || undefined,
      messageId: messageId || undefined,
      sourceIndex,
      sourceUrl: sourceUrl || undefined,
      sourceType,
    });

    res.status(201).json({ success: true, data: { id: clickId } });
  })
);

/**
 * GET /api/analytics/citation-clicks
 * Admin: citation click stats overview.  Query: ?days=30
 */
router.get(
  '/citation-clicks',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(req.query.days as string, 10) || 30, 365);
    const stats = await CitationClickService.getClickStats(days);

    res.status(200).json({ success: true, data: { period: `${days} days`, ...stats } });
  })
);

/**
 * GET /api/analytics/citation-clicks/domains
 * Admin: click-through rates per source domain.  Query: ?days=30
 */
router.get(
  '/citation-clicks/domains',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(req.query.days as string, 10) || 30, 365);
    const rates = await CitationClickService.getDomainClickRates(days);

    res.status(200).json({ success: true, data: { period: `${days} days`, domains: rates } });
  })
);

// ═══════════════════════════════════════════════════════════════════════
// Cross-conversation cited sources (user-facing, not admin-only)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/analytics/cited-sources
 * Returns the authenticated user's most-cited sources.
 * Query: ?topicId, ?startDate, ?endDate, ?limit, ?offset
 */
router.get(
  '/cited-sources',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const topicId = req.query.topicId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const sources = await CitedSourceService.getUserCitedSources(userId, {
      topicId,
      startDate,
      endDate,
      limit,
      offset,
    });

    res.json({ success: true, data: { sources } });
  })
);

/**
 * GET /api/analytics/cited-sources/:id/conversations
 * Source explorer: returns all conversations where a cited source was used.
 * Query: ?limit, ?offset
 */
router.get(
  '/cited-sources/:id/conversations',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const citedSourceId = req.params.id as string;
    if (!citedSourceId) throw new ValidationError('Cited source ID is required');

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const conversations = await CitedSourceService.getSourceConversations(userId, citedSourceId, {
      limit,
      offset,
    });

    res.json({ success: true, data: { conversations } });
  })
);

/**
 * GET /api/analytics/cited-sources/topic/:topicId
 * Sources most relied on within a specific topic.
 * Query: ?limit
 */
router.get(
  '/cited-sources/topic/:topicId',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const topicId = req.params.topicId as string;
    if (!topicId) throw new ValidationError('Topic ID is required');

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const sources = await CitedSourceService.getTopicCitedSources(userId, topicId, limit);

    res.json({ success: true, data: { sources } });
  })
);

export default router;
