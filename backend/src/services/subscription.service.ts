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
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30); // 30 days from now

      return await DatabaseService.updateSubscription(userId, {
        tier,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      });
    } catch (error) {
      logger.error('Failed to update subscription tier:', error);
      return null;
    }
  }

  /**
   * Cancel subscription (set to cancel at period end)
   */
  static async cancelSubscription(userId: string): Promise<Database.Subscription | null> {
    try {
      return await DatabaseService.updateSubscription(userId, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      return null;
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
