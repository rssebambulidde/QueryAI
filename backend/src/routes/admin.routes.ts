import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/authorization.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError, AuthorizationError } from '../types/error';
import { supabaseAdmin } from '../config/database';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';
import { apiLimiter } from '../middleware/rateLimiter';
import { sanitizePostgrestValue, validateSearchInput } from '../validation/sanitize';
import { validateUUIDParams } from '../validation/uuid';

const router = Router();

/**
 * GET /api/admin/users
 * List all users (admin/super_admin only)
 */
router.get(
  '/users',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit: rawLimit = '50', offset: rawOffset = '0', search } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(rawLimit as string, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(rawOffset as string, 10) || 0, 0);

    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    const validatedSearch = validateSearchInput(search);
    if (validatedSearch) {
      const sanitized = sanitizePostgrestValue(validatedSearch);
      query = query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      logger.error('Error fetching users:', error);
      throw new ValidationError('Failed to fetch users');
    }

    res.json({
      success: true,
      data: {
        users: users || [],
        total: users?.length || 0,
      },
    });
  })
);

/**
 * GET /api/admin/users/:id
 * Get user details by ID (admin/super_admin only)
 */
router.get(
  '/users/:id',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;

    const [profile, subscription] = await Promise.all([
      DatabaseService.getUserProfile(userId),
      DatabaseService.getUserSubscription(userId),
    ]);

    if (!profile) {
      throw new ValidationError('User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role || 'user',
          subscriptionTier: subscription?.tier || 'free',
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      },
    });
  })
);

/**
 * PUT /api/admin/users/:id/role
 * Update user role (super_admin only)
 */
router.put(
  '/users/:id/role',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be: user, admin, or super_admin');
    }

    // Prevent changing own role (security measure)
    if (req.user?.id === userId && role !== 'super_admin') {
      throw new AuthorizationError('Cannot change your own role');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      throw new ValidationError('Failed to update user role');
    }

    logger.info(`User role updated by ${req.user?.id}: ${userId} -> ${role}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
    });
  })
);

/**
 * PUT /api/admin/users/by-email/:email/role
 * Update user role by email (super_admin only)
 */
router.put(
  '/users/by-email/:email/role',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const userEmail = Array.isArray(email) ? email[0] : email;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be: user, admin, or super_admin');
    }

    // Find user by email
    const { data: profile, error: findError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (findError || !profile) {
      throw new ValidationError('User not found');
    }

    // Prevent changing own role
    if (req.user?.id === profile.id && role !== 'super_admin') {
      throw new AuthorizationError('Cannot change your own role');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      throw new ValidationError('Failed to update user role');
    }

    logger.info(`User role updated by ${req.user?.id}: ${userEmail} (${profile.id}) -> ${role}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════
// LLM-as-Judge Evaluation Aggregates
// ═════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/quality/evaluations
 * Returns aggregate faithfulness / relevance / citation-accuracy scores
 * grouped by day (default), week, or month.
 *
 * Query params:
 *   days    – lookback window (default 30)
 *   groupBy – "day" | "week" | "month"
 *   detail  – if "true", also returns the most recent individual evaluations
 */
router.get(
  '/quality/evaluations',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { AnswerEvaluatorService } = await import('../services/answer-evaluator.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const groupBy = (['day', 'week', 'month'].includes(req.query.groupBy as string)
      ? req.query.groupBy as 'day' | 'week' | 'month'
      : 'day');
    const includeDetail = req.query.detail === 'true';

    const aggregates = await AnswerEvaluatorService.getAggregates(days, groupBy);

    const responseData: Record<string, any> = { aggregates };

    if (includeDetail) {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
      responseData.recent = await AnswerEvaluatorService.getRecentEvaluations(limit, offset);
    }

    res.json({ success: true, data: responseData });
  })
);

// ═══════════════════════════════════════════════════════════════════════
// Feedback analytics (admin)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/feedback/analytics
 * Aggregate user feedback grouped by day/week/month.
 */
router.get(
  '/feedback/analytics',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const groupBy = (['day', 'week', 'month'].includes(req.query.groupBy as string)
      ? req.query.groupBy as 'day' | 'week' | 'month'
      : 'day');

    const analytics = await FeedbackService.getAnalytics(days, groupBy);

    res.json({ success: true, data: { analytics } });
  })
);

/**
 * GET /api/admin/feedback/by-model
 * Feedback breakdown per AI model.
 */
router.get(
  '/feedback/by-model',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);

    const byModel = await FeedbackService.getByModel(days);

    res.json({ success: true, data: { byModel } });
  })
);

/**
 * GET /api/admin/feedback/by-topic
 * Feedback breakdown per topic.
 */
router.get(
  '/feedback/by-topic',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

    const byTopic = await FeedbackService.getByTopic(days, limit);

    res.json({ success: true, data: { byTopic } });
  })
);

/**
 * GET /api/admin/feedback/flagged
 * Recent feedback with flagged citations.
 */
router.get(
  '/feedback/flagged',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const flagged = await FeedbackService.getRecentFlagged(limit, offset);

    res.json({ success: true, data: { flagged } });
  })
);

/**
 * GET /api/admin/feedback/recent
 * Recent feedback entries (all).
 */
router.get(
  '/feedback/recent',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const recent = await FeedbackService.getRecent(limit, offset);

    res.json({ success: true, data: { recent } });
  })
);

export default router;
