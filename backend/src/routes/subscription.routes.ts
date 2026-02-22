import { Router, Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import { checkSubscription } from '../middleware/subscription.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { validateUUIDParams } from '../validation/uuid';
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
    const [queryLimit, tavilySearchLimit] = await Promise.all([
      SubscriptionService.checkQueryLimit(userId),
      SubscriptionService.checkTavilySearchLimit(userId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        subscription: subscriptionData.subscription,
        limits: subscriptionData.limits,
        usage: {
          queries: queryLimit,
          tavilySearches: tavilySearchLimit,
        },
      },
    });
  })
);

/**
 * PUT /api/subscription/upgrade
 * Upgrade subscription tier (Admin only - for testing/admin - actual upgrades will be via payment)
 */
router.put(
  '/upgrade',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { tier } = req.body;
    
    if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be: free, pro, or enterprise');
    }

    const subscriptionBefore = await DatabaseService.getUserSubscription(userId);
    const updated = await SubscriptionService.updateSubscriptionTier(userId, tier);

    if (!updated) {
      throw new ValidationError('Failed to update subscription');
    }

    logger.info('Subscription tier updated', {
      userId,
      tier,
    });

    try {
      const { EmailService } = await import('../services/email.service');
      const { getTierOrder } = await import('../constants/pricing');
      const userProfile = await DatabaseService.getUserProfile(userId);
      if (userProfile && subscriptionBefore && getTierOrder(tier as 'free' | 'pro') > getTierOrder(subscriptionBefore.tier as 'free' | 'pro')) {
        const periodStart = updated.current_period_start ? new Date(updated.current_period_start) : new Date();
        const periodEnd = updated.current_period_end ? new Date(updated.current_period_end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await EmailService.sendUpgradeConfirmationEmail(
          userProfile.email,
          userProfile.full_name || userProfile.email,
          tier,
          periodStart,
          periodEnd
        );
        logger.info('Upgrade confirmation email sent', { userId, tier });
      }
    } catch (e) {
      logger.error('Failed to send upgrade confirmation email', { userId, error: e });
    }

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
    
    if (!tier || !['free', 'pro'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be: free or pro');
    }

    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      throw new ValidationError('Subscription not found');
    }

    // Validate downgrade (can't downgrade to same or higher tier)
    const tierOrder: Record<'free' | 'pro', number> = { free: 0, pro: 1 };
    const currentTier = subscription.tier as 'free' | 'pro';
    const targetTier = tier as 'free' | 'pro';
    if (tierOrder[targetTier] >= tierOrder[currentTier]) {
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

    try {
      const { EmailService } = await import('../services/email.service');
      const userProfile = await DatabaseService.getUserProfile(userId);
      if (userProfile) {
        const effectiveDate = subscription.current_period_end
          ? new Date(subscription.current_period_end).toLocaleDateString()
          : 'end of current period';
        await EmailService.sendDowngradeConfirmationEmail(
          userProfile.email,
          userProfile.full_name || userProfile.email,
          subscription.tier,
          tier,
          effectiveDate,
          immediate
        );
        logger.info('Downgrade confirmation email sent', { userId, tier });
      }
    } catch (e) {
      logger.error('Failed to send downgrade confirmation email', { userId, error: e });
    }

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

    const subscriptionBefore = await DatabaseService.getUserSubscription(userId);
    const cancelled = await SubscriptionService.cancelSubscription(userId, immediate);

    if (!cancelled) {
      throw new ValidationError('Failed to cancel subscription');
    }

    logger.info('Subscription cancelled', {
      userId,
      immediate,
    });

    try {
      const { EmailService } = await import('../services/email.service');
      const userProfile = await DatabaseService.getUserProfile(userId);
      if (userProfile && subscriptionBefore) {
        await EmailService.sendCancellationEmail(
          userProfile.email,
          userProfile.full_name || userProfile.email,
          subscriptionBefore,
          immediate
        );
        logger.info('Cancellation email sent', { userId, immediate });
      }
    } catch (e) {
      logger.error('Failed to send cancellation email', { userId, error: e });
    }

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
 * GET /api/subscription/paypal-status
 * Get PayPal subscription status (for recurring subscriptions with paypal_subscription_id)
 */
router.get(
  '/paypal-status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      throw new ValidationError('Subscription not found');
    }
    if (!subscription.paypal_subscription_id) {
      return res.status(200).json({
        success: true,
        data: {
          hasPayPalSubscription: false,
          subscription,
          paypalStatus: null,
        },
      });
    }

    const paypalStatus = await SubscriptionService.getPayPalSubscriptionStatus(
      subscription.paypal_subscription_id
    );

    return res.status(200).json({
      success: true,
      data: {
        hasPayPalSubscription: true,
        subscription,
        paypalStatus,
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

    try {
      const { EmailService } = await import('../services/email.service');
      const userProfile = await DatabaseService.getUserProfile(userId);
      if (userProfile) {
        await EmailService.sendReactivationConfirmationEmail(
          userProfile.email,
          userProfile.full_name || userProfile.email,
          reactivated
        );
        logger.info('Reactivation confirmation email sent', { userId });
      }
    } catch (e) {
      logger.error('Failed to send reactivation confirmation email', { userId, error: e });
    }

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
 * GET /api/subscription/history
 * Get subscription change history
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const history = await DatabaseService.getSubscriptionHistory(userId);

    res.status(200).json({
      success: true,
      data: {
        history,
        total: history.length,
      },
    });
  })
);

/**
 * GET /api/subscription/prorated-pricing
 * Get prorated pricing for tier change
 */
router.get(
  '/prorated-pricing',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const toTierRaw = Array.isArray(req.query.toTier) ? req.query.toTier[0] : req.query.toTier;
    const toTier = typeof toTierRaw === 'string' ? toTierRaw : undefined;
    const currencyRaw = Array.isArray(req.query.currency) ? req.query.currency[0] : req.query.currency;
    const currency = 'USD';
    const toBillingPeriod = req.query.toBillingPeriod;

    const validTiers = ['free', 'pro', 'enterprise'];
    if (!toTier || !validTiers.includes(toTier)) {
      throw new ValidationError('Invalid target tier');
    }

    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      throw new ValidationError('Subscription not found');
    }

    const bp = (toBillingPeriod === 'annual' ? 'annual' : toBillingPeriod === 'monthly' ? 'monthly' : undefined) as 'monthly' | 'annual' | undefined;

    const { ProratingService } = await import('../services/prorating.service');
    const proratedPricing = ProratingService.getProratedPricing(
      subscription.tier,
      toTier as 'free' | 'pro' | 'enterprise',
      subscription,
      bp
    );

    return res.status(200).json({
      success: true,
      data: {
        proratedPricing,
      },
    });
  })
);

/**
 * POST /api/subscription/start-trial
 * Start a trial period for a tier
 */
router.post(
  '/start-trial',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { tier, trialDays = 7 } = req.body;

    if (!tier || !['pro'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be "pro"');
    }

    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      throw new ValidationError('Subscription not found');
    }

    // Check if user already had a trial
    if (subscription.trial_end && new Date(subscription.trial_end) > new Date()) {
      throw new ValidationError('Trial period already active');
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + (trialDays as number));

    const updated = await DatabaseService.updateSubscription(userId, {
      tier: tier as 'pro',
      status: 'active',
      trial_end: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
    });

    // Log subscription history
    if (updated) {
      await DatabaseService.logSubscriptionHistory(
        subscription.id,
        userId,
        'tier_change',
        { tier: subscription.tier },
        { tier, trial_end: trialEnd.toISOString() },
        `Started ${trialDays}-day trial for ${tier} tier`
      );
    }

    logger.info('Trial period started', {
      userId,
      tier,
      trialDays,
      trialEnd,
    });

    res.status(200).json({
      success: true,
      message: `Trial period started for ${tier} tier`,
      data: {
        subscription: updated,
        trial_end: trialEnd.toISOString(),
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
  validateUUIDParams('paymentId'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { paymentId } = req.params;
    const id = Array.isArray(paymentId) ? paymentId[0] : paymentId;
    
    if (!id) {
      throw new ValidationError('Payment ID is required');
    }

    const payment = await DatabaseService.getPaymentById(id);
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

    const [queryLimit, tavilySearchLimit] = await Promise.all([
      SubscriptionService.checkQueryLimit(userId),
      SubscriptionService.checkTavilySearchLimit(userId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        queries: queryLimit,
        tavilySearches: tavilySearchLimit,
      },
    });
  })
);

/**
 * GET /api/subscription/email-preferences
 * Get current user's email preferences
 */
router.get(
  '/email-preferences',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const prefs = await DatabaseService.getEmailPreferences(userId);
    res.status(200).json({
      success: true,
      data: {
        optOutNonCritical: prefs?.opt_out_non_critical ?? false,
        optOutReminders: prefs?.opt_out_reminders ?? false,
        optOutMarketing: prefs?.opt_out_marketing ?? false,
      },
    });
  })
);

/**
 * PUT /api/subscription/email-preferences
 * Update email preferences (opt-out for non-critical, reminders, marketing)
 */
router.put(
  '/email-preferences',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const { optOutNonCritical, optOutReminders, optOutMarketing } = req.body;
    const existing = await DatabaseService.getEmailPreferences(userId);
    const updates: { opt_out_non_critical?: boolean; opt_out_reminders?: boolean; opt_out_marketing?: boolean } = {
      opt_out_non_critical: existing?.opt_out_non_critical ?? false,
      opt_out_reminders: existing?.opt_out_reminders ?? false,
      opt_out_marketing: existing?.opt_out_marketing ?? false,
    };
    if (typeof optOutNonCritical === 'boolean') updates.opt_out_non_critical = optOutNonCritical;
    if (typeof optOutReminders === 'boolean') updates.opt_out_reminders = optOutReminders;
    if (typeof optOutMarketing === 'boolean') updates.opt_out_marketing = optOutMarketing;
    const updated = await DatabaseService.updateEmailPreferences(userId, updates);
    res.status(200).json({
      success: true,
      data: {
        optOutNonCritical: updated?.opt_out_non_critical ?? false,
        optOutReminders: updated?.opt_out_reminders ?? false,
        optOutMarketing: updated?.opt_out_marketing ?? false,
      },
    });
  })
);

export default router;
