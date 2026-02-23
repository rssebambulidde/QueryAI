import { DatabaseService } from './database.service';
import * as PayPalService from './paypal.service';
import { Database } from '../types/database';
import logger from '../config/logger';
import { TierConfigService } from './tier-config.service';
import type { SingleTierLimits, TierName } from './tier-config.service';

/**
 * Re-export the TierLimits type from TierConfigService for backward
 * compatibility — existing consumers import it from here.
 */
export type TierLimits = SingleTierLimits;

/**
 * Backward-compatible TIER_LIMITS constant.
 *
 * Returns a snapshot from the TierConfigService cache (DB-driven).
 * Callers that need always-fresh values should use
 * `TierConfigService.getCachedTier(tier)` directly.
 */
export function getTierLimits(): Record<TierName, TierLimits> {
  return TierConfigService.getCached();
}

/** @deprecated Use TierConfigService.getCachedTier(tier) or getTierLimits() */
export const TIER_LIMITS: Record<TierName, TierLimits> = new Proxy(
  {} as Record<TierName, TierLimits>,
  { get: (_target, prop: string) => TierConfigService.getCachedTier(prop as TierName) },
);

/**
 * Subscription Service
 * Handles subscription-related operations and limit checking
 */
export class SubscriptionService {
  /**
   * Get user subscription with tier limits
   */
  static async getUserSubscriptionWithLimits(
    userId: string
  ): Promise<{
    subscription: Database.Subscription;
    limits: TierLimits;
  } | null> {
    try {
      const subscription = await DatabaseService.getUserSubscription(userId);
      
      if (!subscription) {
        return null;
      }

      // Check if subscription is expired
      if (subscription.status === 'expired') {
        // Auto-downgrade to free tier
        await this.updateSubscriptionTier(userId, 'free');
        return {
          subscription: {
            ...subscription,
            tier: 'free',
            status: 'active',
          },
          limits: TIER_LIMITS.free,
        };
      }

      // Check if trial period has ended
      if (subscription.trial_end && new Date(subscription.trial_end) < new Date()) {
        // Trial ended - check if payment was made, otherwise downgrade to free
        const { supabaseAdmin } = await import('../config/database');
        const recentPayment = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .eq('tier', subscription.tier)
          .eq('status', 'completed')
          .gte('completed_at', subscription.trial_end)
          .limit(1)
          .single();

        if (!recentPayment.data) {
          // No payment after trial, downgrade to free
          logger.info('Trial period ended without payment, downgrading to free', {
            userId,
            tier: subscription.tier,
            trialEnd: subscription.trial_end,
          });
          const downgraded = await DatabaseService.updateSubscription(userId, {
            tier: 'free',
            status: 'active',
            trial_end: undefined,
          });
          return {
            subscription: downgraded || {
              ...subscription,
              tier: 'free',
              status: 'active',
            },
            limits: TIER_LIMITS.free,
          };
        }
      }

      // Check if subscription period has ended
      if (
        subscription.status === 'active' &&
        subscription.current_period_end
      ) {
        const periodEnd = new Date(subscription.current_period_end);
        const now = new Date();
        
        if (now > periodEnd) {
          // Subscription period ended
          if (subscription.cancel_at_period_end) {
            // User cancelled, downgrade to free
            await this.updateSubscriptionTier(userId, 'free');
            return {
              subscription: {
                ...subscription,
                tier: 'free',
                status: 'active',
              },
              limits: TIER_LIMITS.free,
            };
          } else {
            // Auto-renew (extend period by 30 days)
            const newPeriodEnd = new Date(now);
            newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);
            await DatabaseService.updateSubscription(userId, {
              current_period_start: now.toISOString(),
              current_period_end: newPeriodEnd.toISOString(),
            });
          }
        }
      }

      const limits = TIER_LIMITS[subscription.tier];
      return {
        subscription,
        limits,
      };
    } catch (error) {
      logger.error('Failed to get user subscription with limits:', error);
      return null;
    }
  }

  /**
   * Check if user has reached query limit
   */
  static async checkQueryLimit(userId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
  }> {
    try {
      const subscriptionData = await this.getUserSubscriptionWithLimits(userId);
      
      if (!subscriptionData) {
        return {
          allowed: false,
          used: 0,
          limit: 0,
          remaining: 0,
        };
      }

      const { subscription, limits } = subscriptionData;
      
      // Pro tier has unlimited queries
      if (limits.queriesPerMonth === null) {
        return {
          allowed: true,
          used: 0,
          limit: null,
          remaining: null,
        };
      }

      // Calculate current period (monthly)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);

      // Get usage count for current month
      const used = await DatabaseService.getUserUsageCount(
        userId,
        'query',
        periodStart,
        periodEnd
      );

      const remaining = limits.queriesPerMonth - used;
      const allowed = used < limits.queriesPerMonth;

      return {
        allowed,
        used,
        limit: limits.queriesPerMonth,
        remaining: Math.max(0, remaining),
      };
    } catch (error) {
      logger.error('Failed to check query limit:', error);
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
      };
    }
  }

  /**
   * Check if user has reached the collections limit
   */
  static async checkCollectionLimit(userId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
  }> {
    try {
      const subscriptionData = await this.getUserSubscriptionWithLimits(userId);

      if (!subscriptionData) {
        return { allowed: false, used: 0, limit: 0, remaining: 0 };
      }

      const { limits } = subscriptionData;

      // Unlimited collections
      if (limits.maxCollections === null) {
        return { allowed: true, used: 0, limit: null, remaining: null };
      }

      const { supabaseAdmin } = await import('../config/database');
      const { count, error } = await supabaseAdmin
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        logger.error('Error counting user collections:', error);
        return { allowed: false, used: 0, limit: limits.maxCollections, remaining: 0 };
      }

      const used = count ?? 0;
      const remaining = Math.max(0, limits.maxCollections - used);

      return {
        allowed: used < limits.maxCollections,
        used,
        limit: limits.maxCollections,
        remaining,
      };
    } catch (error) {
      logger.error('Failed to check collection limit:', error);
      return { allowed: false, used: 0, limit: 0, remaining: 0 };
    }
  }

  /**
   * Check if user has reached Tavily search limit
   */
  static async checkTavilySearchLimit(userId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
  }> {
    try {
      const subscriptionData = await this.getUserSubscriptionWithLimits(userId);
      
      if (!subscriptionData) {
        return {
          allowed: false,
          used: 0,
          limit: 0,
          remaining: 0,
        };
      }

      const { limits } = subscriptionData;
      
      // Check if tier has unlimited Tavily searches
      if (limits.tavilySearchesPerMonth === null) {
        return {
          allowed: true,
          used: 0,
          limit: null,
          remaining: null,
        };
      }

      // Calculate current period (monthly)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);

      // Get Tavily usage count for current month
      const used = await this.getTavilyUsageCount(userId, periodStart, periodEnd);

      const remaining = limits.tavilySearchesPerMonth - used;
      const allowed = used < limits.tavilySearchesPerMonth;

      return {
        allowed,
        used,
        limit: limits.tavilySearchesPerMonth,
        remaining: Math.max(0, remaining),
      };
    } catch (error) {
      logger.error('Failed to check Tavily search limit:', error);
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
      };
    }
  }

  /**
   * Get current Tavily usage count for a user in a given period
   */
  static async getTavilyUsageCount(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      // Calculate period if not provided
      let periodStart: Date;
      let periodEnd: Date;

      if (startDate && endDate) {
        periodStart = startDate;
        periodEnd = endDate;
      } else {
        const now = new Date();
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
      }

      // Get usage count from usage_logs where metadata indicates Tavily search
      // We need to fetch all records and filter in memory since Supabase JSONB queries can be tricky
      const { supabaseAdmin } = await import('../config/database');
      const { data, error } = await supabaseAdmin
        .from('usage_logs')
        .select('metadata')
        .eq('user_id', userId)
        .eq('type', 'query')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

      if (error) {
        logger.error('Error getting Tavily usage count:', error);
        return 0;
      }

      // Filter records where metadata.usedTavily is true
      const tavilyCount = (data || []).filter(
        (log) => log.metadata && log.metadata.usedTavily === true
      ).length;

      return tavilyCount;
    } catch (error) {
      logger.error('Failed to get Tavily usage count:', error);
      return 0;
    }
  }

  /**
   * Increment Tavily usage for a user
   * This should be called after a successful Tavily search
   */
  static async incrementTavilyUsage(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await DatabaseService.logUsage(userId, 'query', {
        ...metadata,
        usedTavily: true,
      });
      logger.info('Tavily usage incremented', { userId });
    } catch (error) {
      logger.error('Failed to increment Tavily usage:', error);
      // Don't throw - usage tracking failure shouldn't break the request
    }
  }

  /**
   * Update subscription tier with optional prorating
   * @param billingPeriod - Optional billing period from payment (for one-time payments where subscription may lack it)
   * @param priceLock - Optional locked prices + promo data from payment callback_data (9.6.2 / 9.6.3)
   */
  static async updateSubscriptionTier(
    userId: string,
    tier: Database.SubscriptionTier,
    shouldProrate: boolean = false,
    billingPeriod?: 'monthly' | 'annual',
    priceLock?: {
      locked_price_monthly?: number;
      locked_price_annual?: number;
      promo_code_id?: string;
      promo_discount_percent?: number;
    },
  ): Promise<Database.Subscription | null> {
    try {
      const subscription = await DatabaseService.getUserSubscription(userId);
      if (!subscription) {
        return null;
      }

      const oldTier = subscription.tier;
      const now = new Date();
      
      let periodStart: Date;
      let periodEnd: Date;

      if (shouldProrate && subscription.current_period_start && subscription.current_period_end) {
        // Prorate: keep existing period but adjust end date if needed
        periodStart = new Date(subscription.current_period_start);
        periodEnd = new Date(subscription.current_period_end);
        // Keep same period end for prorated changes
      } else {
        // Full period reset
        // Use billingPeriod from payment if provided, otherwise from subscription, default to monthly
        const bp = billingPeriod ?? 
          ((subscription as Database.Subscription & { billing_period?: string }).billing_period as 'monthly' | 'annual' | undefined) ?? 
          'monthly';
        const days = bp === 'annual' ? 365 : 30;
        periodStart = now;
        periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + days);
      }

      const updateData: Record<string, unknown> = {
        tier,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        pending_tier: undefined, // Clear any pending tier
      };

      // Write locked prices if provided (9.6.2)
      if (priceLock?.locked_price_monthly !== undefined) {
        updateData.locked_price_monthly = priceLock.locked_price_monthly;
      }
      if (priceLock?.locked_price_annual !== undefined) {
        updateData.locked_price_annual = priceLock.locked_price_annual;
      }

      // Write promo code info if provided (9.6.3)
      if (priceLock?.promo_code_id) {
        updateData.promo_code_id = priceLock.promo_code_id;
        updateData.promo_discount_percent = priceLock.promo_discount_percent ?? null;
      }

      const updated = await DatabaseService.updateSubscription(userId, updateData);

      // Log subscription history
      if (updated && oldTier !== tier) {
        await DatabaseService.logSubscriptionHistory(
          subscription.id,
          userId,
          'tier_change',
          { tier: oldTier },
          { tier },
          `Upgraded from ${oldTier} to ${tier}`
        );
      }

      return updated;
    } catch (error) {
      logger.error('Failed to update subscription tier:', error);
      return null;
    }
  }

  /**
   * Cancel subscription (immediate or at period end).
   * If subscription has paypal_subscription_id, cancels at PayPal first.
   */
  static async cancelSubscription(
    userId: string,
    immediate: boolean = false
  ): Promise<Database.Subscription | null> {
    try {
      const subscription = await DatabaseService.getUserSubscription(userId);
      if (!subscription) {
        return null;
      }

      if (subscription.paypal_subscription_id) {
        try {
          await PayPalService.cancelSubscription(
            subscription.paypal_subscription_id,
            immediate ? 'User requested immediate cancellation' : 'User requested cancel at period end'
          );
          logger.info('PayPal subscription cancelled', {
            userId,
            paypalSubscriptionId: subscription.paypal_subscription_id,
            immediate,
          });
        } catch (paypalError) {
          logger.error('Failed to cancel PayPal subscription, updating DB only', {
            userId,
            paypalSubscriptionId: subscription.paypal_subscription_id,
            error: paypalError,
          });
          // Continue to update DB so local state is consistent
        }
      }

      if (immediate) {
        return await DatabaseService.updateSubscription(userId, {
          tier: 'free',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: new Date().toISOString(),
          paypal_subscription_id: null as unknown as undefined,
        });
      } else {
        return await DatabaseService.updateSubscription(userId, {
          cancel_at_period_end: true,
        });
      }
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      return null;
    }
  }

  /**
   * Create a PayPal subscription (plan-based recurring).
   * User must complete approval via approvalUrl; then sync in payment callback.
   */
  static async createPayPalSubscription(
    tier: 'pro',
    returnUrl: string,
    cancelUrl: string,
    customId?: string,
    billingPeriod: 'monthly' | 'annual' = 'monthly'
  ): Promise<PayPalService.CreateSubscriptionResult> {
    return PayPalService.createSubscription({
      tier,
      returnUrl,
      cancelUrl,
      customId,
      billing_period: billingPeriod,
    });
  }

  /**
   * Update PayPal subscription (e.g. custom_id or plan_id).
   */
  static async updatePayPalSubscription(
    paypalSubscriptionId: string,
    updates: { plan_id?: string; custom_id?: string }
  ): Promise<PayPalService.SubscriptionDetails | null> {
    try {
      return await PayPalService.updateSubscription(paypalSubscriptionId, updates);
    } catch (error) {
      logger.error('Failed to update PayPal subscription', { paypalSubscriptionId, error });
      return null;
    }
  }

  /**
   * Get PayPal subscription status (for subscriptions with paypal_subscription_id).
   */
  static async getPayPalSubscriptionStatus(
    paypalSubscriptionId: string
  ): Promise<PayPalService.SubscriptionDetails | null> {
    try {
      return await PayPalService.getSubscription(paypalSubscriptionId);
    } catch (error) {
      logger.error('Failed to get PayPal subscription status:', { paypalSubscriptionId, error });
      return null;
    }
  }

  /**
   * Handle PayPal subscription renewal (called from webhook PAYMENT.SALE.COMPLETED).
   * Extends period, creates payment record, sends renewal email.
   */
  static async handlePayPalSubscriptionRenewal(
    paypalSubscriptionId: string,
    saleResource: Record<string, unknown>
  ): Promise<void> {
    try {
      const subscription = await DatabaseService.getSubscriptionByPayPalSubscriptionId(
        paypalSubscriptionId
      );
      if (!subscription) {
        logger.warn('Subscription not found for PayPal renewal', { paypalSubscriptionId });
        return;
      }

      const now = new Date();
      const periodEnd = new Date(now);
      const billingPeriod = (subscription as Database.Subscription & { billing_period?: string }).billing_period ?? 'monthly';
      const days = billingPeriod === 'annual' ? 365 : 30;
      periodEnd.setDate(periodEnd.getDate() + days);

      await DatabaseService.updateSubscription(subscription.user_id, {
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });

      const amount = (saleResource.amount as { value?: string })?.value;
      const currency = (saleResource.amount as { currency_code?: string })?.currency_code || 'USD';
      const saleId = saleResource.id as string | undefined;

      await DatabaseService.createPayment({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        payment_provider: 'paypal' as const,
        paypal_subscription_id: paypalSubscriptionId,
        paypal_payment_id: saleId,
        tier: subscription.tier,
        amount: amount ? parseFloat(amount) : 0,
        currency: 'USD',
        status: 'completed',
        payment_description: `QueryAI ${subscription.tier} subscription renewal (${billingPeriod})`,
        callback_data: saleResource,
        completed_at: now.toISOString(),
      });

      await DatabaseService.logSubscriptionHistory(
        subscription.id,
        subscription.user_id,
        'renewal',
        { current_period_end: subscription.current_period_end },
        { current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString() },
        'PayPal subscription renewed'
      );

      try {
        const { EmailService } = await import('./email.service');
        const { getPricing } = await import('../constants/pricing');
        type Tier = import('../constants/pricing').Tier;
        const user = await DatabaseService.getUserProfile(subscription.user_id);
        if (user) {
          // Use locked price if available (9.6.2), fall back to catalog price
          const lockedPrice = billingPeriod === 'annual'
            ? (subscription as Database.Subscription).locked_price_annual
            : (subscription as Database.Subscription).locked_price_monthly;
          const amt = amount ? parseFloat(amount) : (
            lockedPrice ?? getPricing(
              subscription.tier as Tier,
              billingPeriod as 'monthly' | 'annual'
            )
          );
          await EmailService.sendRenewalConfirmationEmail(
            user.email,
            user.full_name || user.email,
            { ...subscription, current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString() } as Database.Subscription,
            now,
            periodEnd,
            amt,
            'USD'
          );
        }
      } catch (emailError) {
        logger.error('Failed to send renewal confirmation email', { subscriptionId: subscription.id, error: emailError });
      }

      logger.info('PayPal subscription renewal processed', {
        userId: subscription.user_id,
        paypalSubscriptionId,
        tier: subscription.tier,
      });
    } catch (error) {
      logger.error('Failed to handle PayPal subscription renewal', { paypalSubscriptionId, error });
    }
  }

  /**
   * Handle PayPal subscription cancelled/suspended (called from webhook).
   * Sets cancel_at_period_end or downgrades when appropriate.
   */
  static async handlePayPalSubscriptionCancelled(
    paypalSubscriptionId: string,
    reason?: string
  ): Promise<void> {
    try {
      const subscription = await DatabaseService.getSubscriptionByPayPalSubscriptionId(
        paypalSubscriptionId
      );
      if (!subscription) {
        logger.warn('Subscription not found for PayPal cancel event', { paypalSubscriptionId });
        return;
      }

      const now = new Date();
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : now;

      if (now >= periodEnd) {
        await DatabaseService.updateSubscription(subscription.user_id, {
          tier: 'free',
          status: 'active',
          cancel_at_period_end: false,
          paypal_subscription_id: undefined,
          current_period_end: now.toISOString(),
        });
        await DatabaseService.logSubscriptionHistory(
          subscription.id,
          subscription.user_id,
          'cancellation',
          { tier: subscription.tier, paypal_subscription_id: paypalSubscriptionId },
          { tier: 'free' },
          reason || 'PayPal subscription ended'
        );
        logger.info('PayPal subscription ended, downgraded to free', {
          userId: subscription.user_id,
          paypalSubscriptionId,
        });
      } else {
        await DatabaseService.updateSubscription(subscription.user_id, {
          cancel_at_period_end: true,
        });
        logger.info('PayPal subscription cancelled, will downgrade at period end', {
          userId: subscription.user_id,
          paypalSubscriptionId,
          current_period_end: subscription.current_period_end,
        });
      }
    } catch (error) {
      logger.error('Failed to handle PayPal subscription cancelled', { paypalSubscriptionId, error });
    }
  }

  /**
   * Handle PayPal subscription expired (called from webhook).
   * Marks subscription as expired and downgrades to free tier.
   */
  static async handlePayPalSubscriptionExpired(
    paypalSubscriptionId: string,
    reason?: string
  ): Promise<void> {
    try {
      const subscription = await DatabaseService.getSubscriptionByPayPalSubscriptionId(
        paypalSubscriptionId
      );
      if (!subscription) {
        logger.warn('Subscription not found for PayPal expired event', { paypalSubscriptionId });
        return;
      }

      const now = new Date();

      // Mark subscription as expired and downgrade to free
      await DatabaseService.updateSubscription(subscription.user_id, {
        tier: 'free',
        status: 'expired',
        cancel_at_period_end: false,
        paypal_subscription_id: undefined,
        current_period_end: now.toISOString(),
        auto_renew: false,
      });

      // Log subscription history
      await DatabaseService.logSubscriptionHistory(
        subscription.id,
        subscription.user_id,
        'status_change',
        { tier: subscription.tier, status: subscription.status, paypal_subscription_id: paypalSubscriptionId },
        { tier: 'free', status: 'expired' },
        reason || 'PayPal subscription expired'
      );

      logger.info('PayPal subscription expired, downgraded to free', {
        userId: subscription.user_id,
        paypalSubscriptionId,
        previousTier: subscription.tier,
      });
    } catch (error) {
      logger.error('Failed to handle PayPal subscription expired', { paypalSubscriptionId, error });
    }
  }

  /**
   * Downgrade subscription tier
   */
  static async downgradeSubscription(
    userId: string,
    targetTier: 'free' | 'pro',
    immediate: boolean = false
  ): Promise<Database.Subscription | null> {
    try {
      const subscription = await DatabaseService.getUserSubscription(userId);
      if (!subscription) {
        return null;
      }

      if (immediate) {
        // Immediate downgrade
        return await DatabaseService.updateSubscription(userId, {
          tier: targetTier,
          status: 'active',
          cancel_at_period_end: false,
          // Reset period for new tier
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } else {
        // Schedule downgrade at period end - store pending tier
        const updated = await DatabaseService.updateSubscription(userId, {
          cancel_at_period_end: true,
          pending_tier: targetTier,
        });

        // Log subscription history
        if (updated) {
          await DatabaseService.logSubscriptionHistory(
            subscription.id,
            userId,
            'tier_change',
            { tier: subscription.tier },
            { tier: targetTier, scheduled: true },
            `Scheduled downgrade from ${subscription.tier} to ${targetTier} at period end`
          );
        }

        return updated;
      }
    } catch (error) {
      logger.error('Failed to downgrade subscription:', error);
      return null;
    }
  }

  /**
   * Send 7-day payment reminders for upcoming renewals.
   * Should be called daily by the renewal job.
   */
  static async processRenewalReminders(): Promise<void> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      const { getPricing } = await import('../constants/pricing');
      const { EmailService } = await import('./email.service');

      const now = new Date();
      const minEnd = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);
      const maxEnd = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);

      const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .neq('tier', 'free')
        .eq('cancel_at_period_end', false)
        .gte('current_period_end', minEnd.toISOString())
        .lte('current_period_end', maxEnd.toISOString());

      if (error) {
        logger.error('Failed to fetch subscriptions for renewal reminders:', error);
        return;
      }
      if (!subscriptions || subscriptions.length === 0) {
        return;
      }

      for (const sub of subscriptions as Database.Subscription[]) {
        try {
          const user = await DatabaseService.getUserProfile(sub.user_id);
          if (!user) continue;

          const currency = 'USD' as const;
          const bp = (sub as Database.Subscription & { billing_period?: string }).billing_period ?? 'monthly';
          type Tier = import('../constants/pricing').Tier;
          const amount = getPricing(sub.tier as Tier, bp as 'monthly' | 'annual');
          const payments = await DatabaseService.getUserPayments(sub.user_id, 5);
          const lastForTier = payments.find(
            (p) => p.tier === sub.tier && p.status === 'completed'
          );
          const paymentMethod = lastForTier?.payment_method?.trim() || undefined;
          await EmailService.sendRenewalReminderEmail(
            user.email,
            user.full_name || user.email,
            sub,
            7,
            { amount, currency, paymentMethod }
          );
          logger.info('Renewal reminder sent', { userId: sub.user_id, tier: sub.tier });
        } catch (e) {
          logger.error('Failed to send renewal reminder', { subscriptionId: sub.id, error: e });
        }
      }
    } catch (err) {
      logger.error('processRenewalReminders failed:', err);
    }
  }

  /**
   * Process subscription renewal
   * Should be called by a scheduled job/cron
   */
  static async processRenewals(): Promise<void> {
    try {
      // Import supabaseAdmin directly
      const { supabaseAdmin } = await import('../config/database');
      
      // Get all active subscriptions that need renewal
      const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .lte('current_period_end', new Date().toISOString());

      if (error) {
        logger.error('Failed to fetch subscriptions for renewal:', error);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        logger.info('No subscriptions need renewal');
        return;
      }

      for (const subscription of subscriptions) {
        try {
          if (subscription.cancel_at_period_end) {
        // Subscription was cancelled - check if there's a pending tier
        const targetTier = subscription.pending_tier || 'free';
        const oldTier = subscription.tier;
        
        await DatabaseService.updateSubscription(subscription.user_id, {
          tier: targetTier,
          status: 'active',
          cancel_at_period_end: false,
          pending_tier: undefined,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // Log subscription history
        await DatabaseService.logSubscriptionHistory(
          subscription.id,
          subscription.user_id,
          oldTier !== targetTier ? 'tier_change' : 'cancellation',
          { tier: oldTier, cancel_at_period_end: true },
          { tier: targetTier, cancel_at_period_end: false },
          `Cancelled and ${oldTier !== targetTier ? `downgraded to ${targetTier}` : 'cancelled'} at period end`
        );

        logger.info('Subscription cancelled and downgraded', {
          userId: subscription.user_id,
          fromTier: oldTier,
          toTier: targetTier,
        });
          } else if (
            subscription.tier !== 'free' &&
            subscription.auto_renew !== false &&
            !(subscription as Database.Subscription).paypal_subscription_id
          ) {
            // Auto-renew paid subscriptions (if auto_renew is enabled).
            // Skip PayPal subscriptions: renewal is handled by PayPal webhook (PAYMENT.SALE.COMPLETED).
            const now = new Date();
            const periodEnd = new Date(now);
            const bp = (subscription as Database.Subscription & { billing_period?: string }).billing_period ?? 'monthly';
            const days = bp === 'annual' ? 365 : 30;
            periodEnd.setDate(periodEnd.getDate() + days);

            const oldPeriodEnd = subscription.current_period_end;
            await DatabaseService.updateSubscription(subscription.user_id, {
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            });

            // Log subscription history
            await DatabaseService.logSubscriptionHistory(
              subscription.id,
              subscription.user_id,
              'renewal',
              { current_period_end: oldPeriodEnd },
              { current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString() },
              'Subscription auto-renewed'
            );

            logger.info('Subscription renewed', {
              userId: subscription.user_id,
              tier: subscription.tier,
            });

            // Send renewal confirmation email
            try {
              const { getPricing } = await import('../constants/pricing');
              const { EmailService } = await import('./email.service');
              const user = await DatabaseService.getUserProfile(subscription.user_id);
              if (user) {
                const currency = 'USD';
                type Tier = import('../constants/pricing').Tier;
                // Use locked price if available (9.6.2), fall back to catalog price
                const lockedPrice = bp === 'annual'
                  ? (subscription as Database.Subscription).locked_price_annual
                  : (subscription as Database.Subscription).locked_price_monthly;
                const amount = lockedPrice ?? getPricing(
                  subscription.tier as Tier,
                  bp as 'monthly' | 'annual'
                );
                await EmailService.sendRenewalConfirmationEmail(
                  user.email,
                  user.full_name || user.email,
                  { ...subscription, current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString() } as Database.Subscription,
                  now,
                  periodEnd,
                  amount,
                  currency
                );
                logger.info('Renewal confirmation email sent', { userId: subscription.user_id, tier: subscription.tier });
              }
            } catch (e) {
              logger.error('Failed to send renewal confirmation email', { subscriptionId: subscription.id, error: e });
            }
          }
        } catch (error) {
          logger.error('Failed to process renewal for subscription:', {
            subscriptionId: subscription.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to process renewals:', error);
    }
  }

  /**
   * Send 3-day expiration warnings for cancel_at_period_end subscriptions.
   * Should be called daily by the renewal job.
   */
  static async processExpirationWarnings(): Promise<void> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      const { EmailService } = await import('./email.service');

      const now = new Date();
      const minEnd = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
      const maxEnd = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);

      const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .eq('cancel_at_period_end', true)
        .neq('tier', 'free')
        .gte('current_period_end', minEnd.toISOString())
        .lte('current_period_end', maxEnd.toISOString());

      if (error) {
        logger.error('Failed to fetch subscriptions for expiration warnings:', error);
        return;
      }
      if (!subscriptions || subscriptions.length === 0) return;

      for (const sub of subscriptions as Database.Subscription[]) {
        try {
          const user = await DatabaseService.getUserProfile(sub.user_id);
          if (!user) continue;
          await EmailService.sendExpirationWarningEmail(
            user.email,
            user.full_name || user.email,
            sub,
            3
          );
          logger.info('Expiration warning sent', { userId: sub.user_id, tier: sub.tier });
        } catch (e) {
          logger.error('Failed to send expiration warning', { subscriptionId: sub.id, error: e });
        }
      }
    } catch (err) {
      logger.error('processExpirationWarnings failed:', err);
    }
  }

  /**
   * Send grace period warnings for subscriptions in grace period.
   * Run daily; sends when days remaining is 3 or 1 to avoid spam.
   */
  static async processGracePeriodWarnings(): Promise<void> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      const { EmailService } = await import('./email.service');

      const now = new Date();
      const { data: rows, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .neq('tier', 'free')
        .not('grace_period_end', 'is', null);

      if (error || !rows?.length) return;

      for (const sub of rows as Database.Subscription[]) {
        const end = sub.grace_period_end ? new Date(sub.grace_period_end) : null;
        if (!end || end <= now) continue;
        const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (daysRemaining !== 3 && daysRemaining !== 1) continue;

        try {
          const user = await DatabaseService.getUserProfile(sub.user_id);
          if (!user) continue;
          await EmailService.sendGracePeriodWarningEmail(
            user.email,
            user.full_name || user.email,
            sub,
            daysRemaining
          );
          logger.info('Grace period warning sent', { userId: sub.user_id, daysRemaining });
        } catch (e) {
          logger.error('Failed to send grace period warning', { subscriptionId: sub.id, error: e });
        }
      }
    } catch (err) {
      logger.error('processGracePeriodWarnings failed:', err);
    }
  }

  /**
   * Reactivate subscription
   */
  static async reactivateSubscription(userId: string): Promise<Database.Subscription | null> {
    try {
      return await DatabaseService.updateSubscription(userId, {
        cancel_at_period_end: false,
        status: 'active',
      });
    } catch (error) {
      logger.error('Failed to reactivate subscription:', error);
      return null;
    }
  }
}
