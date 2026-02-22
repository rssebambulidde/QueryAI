import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { ForbiddenError, ValidationError } from '../types/error';
import logger from '../config/logger';

/**
 * Middleware to check subscription status and attach to request
 */
export const checkSubscription = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
    
    if (!subscriptionData) {
      throw new ForbiddenError('Subscription not found');
    }

    // Attach subscription data to request
    req.subscription = subscriptionData.subscription;
    req.subscriptionLimits = subscriptionData.limits;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce query limits
 */
export const enforceQueryLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const limitCheck = await SubscriptionService.checkQueryLimit(userId);

    if (!limitCheck.allowed) {
      logger.warn('Query limit exceeded', {
        userId,
        used: limitCheck.used,
        limit: limitCheck.limit,
      });

      const isZeroLimit = limitCheck.limit === 0;
      const message = isZeroLimit
        ? 'Sorry, your query limit on this tier is zero. Upgrade to ask questions.'
        : `Query limit reached. You have used ${limitCheck.used} of ${limitCheck.limit} queries this month. Upgrade for more.`;

      res.status(403).json({
        success: false,
        error: {
          message,
          code: 'QUERY_LIMIT_EXCEEDED',
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
      });
      return;
    }

    // Attach limit info to request for logging
    req.queryLimitInfo = limitCheck;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce research-mode access.
 * If the request specifies mode='research' but the user's tier disallows it,
 * return 403 with RESEARCH_MODE_NOT_AVAILABLE.
 */
export const enforceResearchMode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requestedMode: string | undefined = req.body?.mode;
    // Only gate research mode; chat / undefined always allowed
    if (!requestedMode || requestedMode !== 'research') {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
    if (!subscriptionData) {
      throw new ForbiddenError('Subscription not found');
    }

    if (!subscriptionData.limits.allowResearchMode) {
      logger.warn('Research mode access denied', {
        userId,
        tier: subscriptionData.subscription.tier,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'Deep Research mode is not available on the Free plan. Upgrade to Pro to unlock both modes.',
          code: 'RESEARCH_MODE_NOT_AVAILABLE',
          currentTier: subscriptionData.subscription.tier,
          requiredTier: 'pro',
        },
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to gate features by subscription tier
 */
export const requireFeature = (
  feature: keyof import('../services/subscription.service').TierLimits['features']
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      const hasAccess = await SubscriptionService.hasFeatureAccess(userId, feature);

      if (!hasAccess) {
        logger.warn('Feature access denied', {
          userId,
          feature,
        });

        const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
        const currentTier = subscriptionData?.subscription.tier || 'free';
        const featureMessages: Record<string, string> = {
          embedding: 'Document embedding is not available on your plan. Upgrade to use this feature.',
          analytics: 'Analytics is not available on your plan. Upgrade to view analytics.',
          apiAccess: 'API access is not available on your plan. Upgrade for API access.',
          whiteLabel: 'White-label is not available on your plan. Upgrade for white-label options.',
        };
        const message = featureMessages[feature] || `This feature requires a ${getRequiredTierForFeature(feature)} subscription. Your current tier is ${currentTier}. Upgrade to use it.`;

        res.status(403).json({
          success: false,
          error: {
            message,
            code: 'FEATURE_NOT_AVAILABLE',
            feature,
            currentTier,
            requiredTier: getRequiredTierForFeature(feature),
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Helper function to determine required tier for a feature
 */
function getRequiredTierForFeature(
  feature: keyof import('../services/subscription.service').TierLimits['features']
): 'pro' | 'enterprise' {
  if (feature === 'teamCollaboration') {
    return 'enterprise';
  }
  // All gated features require pro now (embedding, analytics, apiAccess, whiteLabel)
  return 'pro';
}

// Extend Express Request type to include subscription data
declare global {
  namespace Express {
    interface Request {
      subscription?: import('../types/database').Database.Subscription;
      subscriptionLimits?: import('../services/subscription.service').TierLimits;
      queryLimitInfo?: {
        allowed: boolean;
        used: number;
        limit: number | null;
        remaining: number | null;
      };
      apiKey?: {
        id: string;
        user_id: string;
      };
    }
  }
}
