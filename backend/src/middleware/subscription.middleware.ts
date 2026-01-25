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

      res.status(403).json({
        success: false,
        error: {
          message: `Query limit exceeded. You have used ${limitCheck.used} of ${limitCheck.limit} queries this month.`,
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
 * Middleware to enforce document upload limits
 */
export const enforceDocumentUploadLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const limitCheck = await SubscriptionService.checkDocumentUploadLimit(userId);

    if (!limitCheck.allowed) {
      logger.warn('Document upload limit exceeded', {
        userId,
        used: limitCheck.used,
        limit: limitCheck.limit,
      });

      res.status(403).json({
        success: false,
        error: {
          message: `Document upload limit exceeded. You have uploaded ${limitCheck.used} of ${limitCheck.limit} documents this month.`,
          code: 'DOCUMENT_UPLOAD_LIMIT_EXCEEDED',
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
      });
      return;
    }

    // Attach limit info to request
    req.documentUploadLimitInfo = limitCheck;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce topic limits
 */
export const enforceTopicLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const limitCheck = await SubscriptionService.checkTopicLimit(userId);

    if (!limitCheck.allowed) {
      logger.warn('Topic limit exceeded', {
        userId,
        used: limitCheck.used,
        limit: limitCheck.limit,
      });

      res.status(403).json({
        success: false,
        error: {
          message: `Topic limit exceeded. You have created ${limitCheck.used} of ${limitCheck.limit} topics.`,
          code: 'TOPIC_LIMIT_EXCEEDED',
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
      });
      return;
    }

    // Attach limit info to request
    req.topicLimitInfo = limitCheck;

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

        res.status(403).json({
          success: false,
          error: {
            message: `This feature requires a ${getRequiredTierForFeature(feature)} subscription. Your current tier is ${currentTier}.`,
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
): 'premium' | 'pro' {
  // Document upload and embedding are premium features
  if (feature === 'documentUpload' || feature === 'embedding') {
    return 'premium';
  }
  
  // Analytics is premium
  if (feature === 'analytics') {
    return 'premium';
  }
  
  // API access and white label are pro features
  if (feature === 'apiAccess' || feature === 'whiteLabel') {
    return 'pro';
  }
  
  return 'premium'; // Default to premium
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
      documentUploadLimitInfo?: {
        allowed: boolean;
        used: number;
        limit: number | null;
        remaining: number | null;
      };
      topicLimitInfo?: {
        allowed: boolean;
        used: number;
        limit: number | null;
        remaining: number | null;
      };
      apiKey?: {
        id: string;
        user_id: string;
        topic_id?: string;
      };
    }
  }
}
