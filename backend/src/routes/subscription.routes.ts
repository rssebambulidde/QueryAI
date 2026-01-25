import { Router, Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { authenticate } from '../middleware/auth.middleware';
import { checkSubscription } from '../middleware/subscription.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import logger from '../config/logger';
import { DatabaseService } from '../services/database.service';

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
      message: `Subscription updated to ${tier}`,
      data: {
        subscription: updated,
      },
    });
  })
);

/**
 * PUT /api/subscription/downgrade
 * Downgrade subscription tier (immediate or at period end)
 */
router.put(
  '/downgrade',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { tier, immediate = false } = req.body;
    
    if (!tier || !['free', 'premium', 'pro'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be: free, premium, or pro');
    }

    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      throw new ValidationError('Subscription not found');
    }

    // Validate downgrade (can't downgrade to same or higher tier)
    const tierOrder = { free: 0, premium: 1, pro: 2 };
    if (tierOrder[tier] >= tierOrder[subscription.tier as keyof typeof tierOrder]) {
      throw new ValidationError('Cannot downgrade to same or higher tier');
    }

    const updated = await SubscriptionService.downgradeSubscription(userId, tier, immediate);

    if (!updated) {
      throw new ValidationError('Failed to downgrade subscription');
    }

    logger.info('Subscription downgraded', {
      userId,
      fromTier: subscription.tier,
      toTier: tier,
      immediate,
    });

    res.status(200).json({
      success: true,
      message: immediate 
        ? `Subscription downgraded to ${tier} immediately`
        : `Subscription will be downgraded to ${tier} at the end of the current period`,
      data: {
        subscription: updated,
      },
    });
  })
);

/**
 * POST /api/subscription/cancel
 * Cancel subscription (immediate or at period end)
 */
router.post(
  '/cancel',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { immediate = false } = req.body;

    const cancelled = await SubscriptionService.cancelSubscription(userId, immediate);

    if (!cancelled) {
      throw new ValidationError('Failed to cancel subscription');
    }

    logger.info('Subscription cancelled', {
      userId,
      immediate,
    });

    res.status(200).json({
      success: true,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at the end of the current period',
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
 * GET /api/subscription/billing-history
 * Get user's billing history (payments)
 */
router.get(
  '/billing-history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const payments = await DatabaseService.getUserPayments(userId);

    // Sort by created_at descending (most recent first)
    const sortedPayments = payments.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.status(200).json({
      success: true,
      data: {
        payments: sortedPayments,
        total: sortedPayments.length,
      },
    });
  })
);

/**
 * GET /api/subscription/invoice/:paymentId
 * Generate invoice PDF for a payment
 */
router.get(
  '/invoice/:paymentId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { paymentId } = req.params;

    const payment = await DatabaseService.getPaymentById(paymentId);
    if (!payment) {
      throw new ValidationError('Payment not found');
    }

    // Verify payment belongs to user
    if (payment.user_id !== userId) {
      throw new ValidationError('Unauthorized');
    }

    // Only generate invoice for completed payments
    if (payment.status !== 'completed') {
      throw new ValidationError('Invoice can only be generated for completed payments');
    }

    // Generate invoice
    const { InvoiceService } = await import('../services/invoice.service');
    const invoicePdf = await InvoiceService.generateInvoice(payment);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${paymentId}.pdf"`);
    res.send(invoicePdf);
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
