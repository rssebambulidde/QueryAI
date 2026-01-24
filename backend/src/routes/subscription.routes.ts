import { Router, Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { authenticate } from '../middleware/auth.middleware';
import { checkSubscription } from '../middleware/subscription.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/subscription
 * Get current user's subscription details
 */
router.get(
  '/',
  authenticate,
  checkSubscription,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
    
    if (!subscriptionData) {
      throw new ValidationError('Subscription not found');
    }

    // Get usage statistics
    const queryLimit = await SubscriptionService.checkQueryLimit(userId);
    const documentUploadLimit = await SubscriptionService.checkDocumentUploadLimit(userId);
    const topicLimit = await SubscriptionService.checkTopicLimit(userId);

    res.status(200).json({
      success: true,
      data: {
        subscription: subscriptionData.subscription,
        limits: subscriptionData.limits,
        usage: {
          queries: queryLimit,
          documentUploads: documentUploadLimit,
          topics: topicLimit,
        },
      },
    });
  })
);

/**
 * PUT /api/subscription/upgrade
 * Upgrade subscription tier (for testing/admin - actual upgrades will be via payment)
 */
router.put(
  '/upgrade',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { tier } = req.body;
    
    if (!tier || !['free', 'premium', 'pro'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be: free, premium, or pro');
    }

    const updated = await SubscriptionService.updateSubscriptionTier(userId, tier);

    if (!updated) {
      throw new ValidationError('Failed to update subscription');
    }

    logger.info('Subscription tier updated', {
      userId,
      tier,
    });

    res.status(200).json({
      success: true,
      message: `Subscription upgraded to ${tier}`,
      data: {
        subscription: updated,
      },
    });
  })
);

/**
 * POST /api/subscription/cancel
 * Cancel subscription (set to cancel at period end)
 */
router.post(
  '/cancel',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const cancelled = await SubscriptionService.cancelSubscription(userId);

    if (!cancelled) {
      throw new ValidationError('Failed to cancel subscription');
    }

    logger.info('Subscription cancelled', {
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      data: {
        subscription: cancelled,
      },
    });
  })
);

/**
 * POST /api/subscription/reactivate
 * Reactivate a cancelled subscription
 */
router.post(
  '/reactivate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const reactivated = await SubscriptionService.reactivateSubscription(userId);

    if (!reactivated) {
      throw new ValidationError('Failed to reactivate subscription');
    }

    logger.info('Subscription reactivated', {
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Subscription reactivated',
      data: {
        subscription: reactivated,
      },
    });
  })
);

/**
 * GET /api/subscription/limits
 * Get current usage limits and remaining quotas
 */
router.get(
  '/limits',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const [queryLimit, documentUploadLimit, topicLimit] = await Promise.all([
      SubscriptionService.checkQueryLimit(userId),
      SubscriptionService.checkDocumentUploadLimit(userId),
      SubscriptionService.checkTopicLimit(userId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        queries: queryLimit,
        documentUploads: documentUploadLimit,
        topics: topicLimit,
      },
    });
  })
);

export default router;
