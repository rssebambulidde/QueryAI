/**
 * Metrics Routes
 * API endpoints for retrieval quality metrics
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { MetricsService, MetricsQuery } from '../services/metrics.service';
import { LatencyTrackerService, LatencyQuery, OperationType } from '../services/latency-tracker.service';
import { ErrorTrackerService, ErrorQuery, ServiceType, ErrorCategory } from '../services/error-tracker.service';
import { QualityMetricsService, QualityQuery, QualityMetricType } from '../services/quality-metrics.service';
import { apiLimiter } from '../middleware/rateLimiter';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/metrics/retrieval
 * Get retrieval quality metrics
 */
router.get(
  '/retrieval',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { startDate, endDate, topicId, limit, offset } = req.query;

    const query: MetricsQuery = {
      userId,
      startDate: startDate as string,
      endDate: endDate as string,
      topicId: topicId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const metrics = await MetricsService.getMetrics(query);

    res.json({
      success: true,
      data: metrics,
    });
  })
);

/**
 * GET /api/metrics/retrieval/summary
 * Get retrieval metrics summary
 */
router.get(
  '/retrieval/summary',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    const summary = await MetricsService.getMetricsSummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  })
);

/**
 * POST /api/metrics/retrieval/collect
 * Manually collect metrics for a query (for testing/feedback)
 */
router.post(
  '/retrieval/collect',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { query, retrievedDocuments, relevantDocumentIds, options } = req.body;

    if (!query || !retrievedDocuments) {
      return res.status(400).json({
        success: false,
        message: 'Query and retrievedDocuments are required',
      });
    }

    try {
      const metrics = await MetricsService.collectMetrics(
        query,
        userId,
        retrievedDocuments,
        relevantDocumentIds,
        {
          ...options,
          queryId: options?.queryId,
          topicId: options?.topicId,
          documentIds: options?.documentIds,
          searchTypes: options?.searchTypes,
          webResultsCount: options?.webResultsCount,
        }
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      logger.error('Failed to collect metrics', {
        error: error.message,
        userId,
      });
      res.status(500).json({
        success: false,
        message: 'Failed to collect metrics',
        error: error.message,
      });
    }
  })
);

/**
 * GET /api/metrics/latency/stats
 * Get latency statistics
 */
router.get(
  '/latency/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { operationType, startDate, endDate, minLatency, maxLatency, limit, offset } = req.query;

    const query: LatencyQuery = {
      userId,
      operationType: operationType as OperationType,
      startDate: startDate as string,
      endDate: endDate as string,
      minLatency: minLatency ? parseInt(minLatency as string, 10) : undefined,
      maxLatency: maxLatency ? parseInt(maxLatency as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const stats = await LatencyTrackerService.getLatencyStats(query);

    res.json({
      success: true,
      data: {
        stats,
        summary: {
          totalOperations: stats.reduce((sum, s) => sum + s.count, 0),
          averageLatency: stats.length > 0
            ? stats.reduce((sum, s) => sum + s.averageLatency, 0) / stats.length
            : 0,
          operationsTracked: stats.length,
        },
      },
    });
  })
);

/**
 * GET /api/metrics/latency/trends
 * Get latency trends over time
 */
router.get(
  '/latency/trends',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { operationType, startDate, endDate, interval } = req.query;

    if (!operationType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'operationType, startDate, and endDate are required',
      });
    }

    const trends = await LatencyTrackerService.getLatencyTrends(
      operationType as OperationType,
      startDate as string,
      endDate as string,
      (interval as 'hour' | 'day' | 'week') || 'day'
    );

    res.json({
      success: true,
      data: {
        trends,
        operationType,
        interval: interval || 'day',
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
    });
  })
);

/**
 * GET /api/metrics/latency/alerts
 * Get recent latency alerts
 */
router.get(
  '/latency/alerts',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    const alerts = await LatencyTrackerService.getRecentAlerts(limitNum);

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
      },
    });
  })
);

/**
 * GET /api/metrics/latency/alerts/stats
 * Get alert statistics
 */
router.get(
  '/latency/alerts/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const stats = await LatencyTrackerService.getAlertStats(
      startDate as string,
      endDate as string
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/metrics/errors/stats
 * Get error statistics
 */
router.get(
  '/errors/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { serviceType, errorCategory, startDate, endDate, limit, offset } = req.query;

    const query: ErrorQuery = {
      userId,
      serviceType: serviceType as ServiceType,
      errorCategory: errorCategory as ErrorCategory,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const stats = await ErrorTrackerService.getErrorStats(query);

    res.json({
      success: true,
      data: {
        stats,
        summary: {
          totalErrors: stats.reduce((sum, s) => sum + s.count, 0),
          servicesTracked: new Set(stats.map(s => s.serviceType)).size,
          categoriesTracked: new Set(stats.map(s => s.errorCategory)).size,
        },
      },
    });
  })
);

/**
 * GET /api/metrics/errors/trends
 * Get error trends over time
 */
router.get(
  '/errors/trends',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { serviceType, errorCategory, startDate, endDate, interval } = req.query;

    if (!serviceType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'serviceType, startDate, and endDate are required',
      });
    }

    const trends = await ErrorTrackerService.getErrorTrends(
      serviceType as ServiceType,
      errorCategory as ErrorCategory || null,
      startDate as string,
      endDate as string,
      (interval as 'hour' | 'day' | 'week') || 'day'
    );

    res.json({
      success: true,
      data: {
        trends,
        serviceType,
        errorCategory: errorCategory || null,
        interval: interval || 'day',
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
    });
  })
);

/**
 * GET /api/metrics/errors/alerts
 * Get recent error rate alerts
 */
router.get(
  '/errors/alerts',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    const alerts = await ErrorTrackerService.getRecentAlerts(limitNum);

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
      },
    });
  })
);

/**
 * GET /api/metrics/errors/alerts/stats
 * Get error alert statistics
 */
router.get(
  '/errors/alerts/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const stats = await ErrorTrackerService.getAlertStats(
      startDate as string,
      endDate as string
    );

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * GET /api/metrics/quality/stats
 * Get quality statistics
 */
router.get(
  '/quality/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { metricType, startDate, endDate, minScore, maxScore, limit, offset } = req.query;

    const query: QualityQuery = {
      userId,
      metricType: metricType as QualityMetricType,
      startDate: startDate as string,
      endDate: endDate as string,
      minScore: minScore ? parseInt(minScore as string, 10) : undefined,
      maxScore: maxScore ? parseInt(maxScore as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const stats = await QualityMetricsService.getQualityStats(query);

    res.json({
      success: true,
      data: {
        stats,
        summary: {
          totalMetrics: stats.reduce((sum, s) => sum + s.count, 0),
          averageScore: stats.length > 0
            ? stats.reduce((sum, s) => sum + s.averageScore, 0) / stats.length
            : 0,
          metricTypesTracked: stats.length,
        },
      },
    });
  })
);

/**
 * GET /api/metrics/quality/trends
 * Get quality trends over time
 */
router.get(
  '/quality/trends',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { metricType, startDate, endDate, interval } = req.query;

    if (!metricType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'metricType, startDate, and endDate are required',
      });
    }

    const trends = await QualityMetricsService.getQualityTrends(
      metricType as QualityMetricType,
      startDate as string,
      endDate as string,
      (interval as 'hour' | 'day' | 'week') || 'day'
    );

    res.json({
      success: true,
      data: {
        trends,
        metricType,
        interval: interval || 'day',
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
    });
  })
);

export default router;
