import { DatabaseService } from './database.service';
import { Database } from '../types/database';
import logger from '../config/logger';

/**
 * Subscription tier limits configuration
 * Based on PROJECT_SPECIFICATION.md pricing tiers
 */
export interface TierLimits {
  queriesPerMonth: number | null; // null = unlimited
  documentUploads: number | null; // null = unlimited
  maxTopics: number | null; // null = unlimited
  features: {
    documentUpload: boolean;
    embedding: boolean;
    analytics: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

/**
 * Subscription tier limits map
 */
export const TIER_LIMITS: Record<'free' | 'premium' | 'pro', TierLimits> = {
  free: {
    queriesPerMonth: 50,
    documentUploads: 0, // No document upload
    maxTopics: 0, // No topics
    features: {
      documentUpload: false,
      embedding: false,
      analytics: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  premium: {
    queriesPerMonth: 500,
    documentUploads: 10,
    maxTopics: 3,
    features: {
      documentUpload: true,
      embedding: true,
      analytics: true,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  pro: {
    queriesPerMonth: null, // Unlimited
    documentUploads: null, // Unlimited
    maxTopics: null, // Unlimited
    features: {
      documentUpload: true,
      embedding: true,
      analytics: true,
      apiAccess: true,
      whiteLabel: true,
    },
  },
};

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
          const { supabaseAdmin } = await import('../config/database');
          const downgraded = await DatabaseService.updateSubscription(userId, {
            tier: 'free',
            status: 'active',
            trial_end: null,
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
   * Check if user has access to a feature
   */
  static async hasFeatureAccess(
    userId: string,
    feature: keyof TierLimits['features']
  ): Promise<boolean> {
    try {
      const subscriptionData = await this.getUserSubscriptionWithLimits(userId);
      
      if (!subscriptionData) {
        return false;
      }

      return subscriptionData.limits.features[feature];
    } catch (error) {
      logger.error('Failed to check feature access:', error);
      return false;
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
   * Check if user has reached document upload limit
   */
  static async checkDocumentUploadLimit(userId: string): Promise<{
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
      
      // Pro tier has unlimited document uploads
      if (limits.documentUploads === null) {
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
        'document_upload',
        periodStart,
        periodEnd
      );

      const remaining = limits.documentUploads - used;
      const allowed = used < limits.documentUploads;

      return {
        allowed,
        used,
        limit: limits.documentUploads,
        remaining: Math.max(0, remaining),
      };
    } catch (error) {
      logger.error('Failed to check document upload limit:', error);
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
      };
    }
  }

  /**
   * Check if user has reached topic limit
   */
  static async checkTopicLimit(userId: string): Promise<{
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
      
      // Pro tier has unlimited topics
      if (limits.maxTopics === null) {
        return {
          allowed: true,
          used: 0,
          limit: null,
          remaining: null,
        };
      }

      // Get current topic count
      const { TopicService } = await import('./topic.service');
      const topics = await TopicService.getUserTopics(userId);
      const used = topics.length;

      const remaining = limits.maxTopics - used;
      const allowed = used < limits.maxTopics;

      return {
        allowed,
        used,
        limit: limits.maxTopics,
        remaining: Math.max(0, remaining),
      };
    } catch (error) {
      logger.error('Failed to check topic limit:', error);
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
      };
    }
  }

  /**
   * Update subscription tier
   */
  static async updateSubscriptionTier(
    userId: string,
    tier: 'free' | 'premium' | 'pro'
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

      if (prorate && subscription.current_period_start && subscription.current_period_end) {
        // Prorate: keep existing period but adjust end date if needed
        periodStart = new Date(subscription.current_period_start);
        periodEnd = new Date(subscription.current_period_end);
        // Keep same period end for prorated changes
      } else {
        // Full period reset
        periodStart = now;
        periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30); // 30 days from now
      }

      const updated = await DatabaseService.updateSubscription(userId, {
        tier,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        pending_tier: null, // Clear any pending tier
      });

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
   * Cancel subscription (immediate or at period end)
   */
  static async cancelSubscription(
    userId: string,
    immediate: boolean = false
  ): Promise<Database.Subscription | null> {
    try {
      if (immediate) {
        // Immediate cancellation - downgrade to free
        return await DatabaseService.updateSubscription(userId, {
          tier: 'free',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: new Date().toISOString(),
        });
      } else {
        // Cancel at period end
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
   * Downgrade subscription tier
   */
  static async downgradeSubscription(
    userId: string,
    targetTier: 'free' | 'premium' | 'pro',
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
          pending_tier: null,
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
          } else if (subscription.tier !== 'free' && subscription.auto_renew !== false) {
            // Auto-renew paid subscriptions (if auto_renew is enabled)
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setDate(periodEnd.getDate() + 30); // 30 days from now

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
