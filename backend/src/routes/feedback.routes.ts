import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { apiLimiter } from '../middleware/rateLimiter';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/feedback
 * Submit or update feedback for a message (thumbs up/down, comment, flagged citations).
 */
router.post(
  '/',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const {
      messageId,
      conversationId,
      topicId,
      rating,
      comment,
      flaggedCitations,
      model,
      question,
      answer,
      sources,
    } = req.body;

    if (!messageId || typeof messageId !== 'string') {
      throw new ValidationError('messageId is required');
    }
    if (rating !== 1 && rating !== -1) {
      throw new ValidationError('rating must be 1 (thumbs up) or -1 (thumbs down)');
    }

    const feedbackId = await FeedbackService.submitFeedback({
      userId: req.user!.id,
      messageId,
      conversationId,
      topicId,
      rating,
      comment: comment ? String(comment).substring(0, 2000) : undefined,
      flaggedCitations: Array.isArray(flaggedCitations) ? flaggedCitations : undefined,
      model,
      question,
      answer,
      sources,
    });

    res.json({ success: true, data: { feedbackId } });
  })
);

/**
 * GET /api/feedback/message/:messageId
 * Get the current user's feedback for a specific message.
 */
router.get(
  '/message/:messageId',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');
    const messageId = req.params.messageId as string;

    if (!messageId) {
      throw new ValidationError('messageId is required');
    }

    const feedback = await FeedbackService.getUserFeedback(req.user!.id, messageId);

    res.json({ success: true, data: { feedback } });
  })
);

/**
 * DELETE /api/feedback/message/:messageId
 * Remove the current user's feedback for a specific message.
 */
router.delete(
  '/message/:messageId',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');
    const messageId = req.params.messageId as string;

    if (!messageId) {
      throw new ValidationError('messageId is required');
    }

    await FeedbackService.deleteFeedback(req.user!.id, messageId);

    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;
