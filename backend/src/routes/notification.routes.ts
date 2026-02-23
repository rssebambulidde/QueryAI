/**
 * Notification Routes (authenticated)
 *
 * In-app notifications for usage alerts and system messages.
 * Mounted at /api/notifications in server.ts.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/notifications
 * Get current user's notifications (newest first).
 * Query: ?unreadOnly=true&limit=50
 */
router.get(
  '/',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { UsageAlertsService } = await import('../services/usage-alerts.service');
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);

    const [notifications, unreadCount] = await Promise.all([
      UsageAlertsService.getUserNotifications(req.user!.id, { limit, unreadOnly }),
      UsageAlertsService.getUnreadCount(req.user!.id),
    ]);

    res.json({
      success: true,
      data: { notifications, unreadCount },
    });
  })
);

/**
 * GET /api/notifications/unread-count
 * Lightweight endpoint for badge counts.
 */
router.get(
  '/unread-count',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { UsageAlertsService } = await import('../services/usage-alerts.service');
    const count = await UsageAlertsService.getUnreadCount(req.user!.id);

    res.json({ success: true, data: { unreadCount: count } });
  })
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch(
  '/:id/read',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { UsageAlertsService } = await import('../services/usage-alerts.service');
    const ok = await UsageAlertsService.markRead(
      req.params.id as string,
      req.user!.id,
    );

    res.json({ success: true, data: { updated: ok } });
  })
);

/**
 * POST /api/notifications/read-all
 * Mark all of the user's notifications as read.
 */
router.post(
  '/read-all',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { UsageAlertsService } = await import('../services/usage-alerts.service');
    const count = await UsageAlertsService.markAllRead(req.user!.id);

    res.json({ success: true, data: { updated: count } });
  })
);

export default router;
