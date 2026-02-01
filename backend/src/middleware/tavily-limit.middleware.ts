import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { ForbiddenError, ValidationError } from '../types/error';
import logger from '../config/logger';

/**
 * Middleware to enforce Tavily search limits
 * This should be used on routes that perform Tavily searches
 */
export const checkTavilyLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const limitCheck = await SubscriptionService.checkTavilySearchLimit(userId);

    if (!limitCheck.allowed) {
      logger.warn('Tavily search limit exceeded', {
        userId,
        used: limitCheck.used,
        limit: limitCheck.limit,
      });

      res.status(403).json({
        success: false,
        error: {
          message: `Tavily search limit exceeded. You have used ${limitCheck.used} of ${limitCheck.limit} Tavily searches this month.`,
          code: 'TAVILY_SEARCH_LIMIT_EXCEEDED',
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
      });
      return;
    }

    // Attach limit info to request for logging
    req.tavilyLimitInfo = limitCheck;

    next();
  } catch (error) {
    next(error);
  }
};

// Extend Express Request type to include Tavily limit info
declare global {
  namespace Express {
    interface Request {
      tavilyLimitInfo?: {
        allowed: boolean;
        used: number;
        limit: number | null;
        remaining: number | null;
      };
    }
  }
}
