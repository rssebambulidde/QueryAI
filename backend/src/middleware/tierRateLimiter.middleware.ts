import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscription.service';
import { RateLimitError } from '../types/error';
import logger from '../config/logger';

/**
 * Tier-Based Rate Limiting Middleware
 * Applies different rate limits based on subscription tier
 */

interface TierRateLimit {
  windowMs: number;
  max: number;
}

/**
 * Rate limits per tier (requests per window)
 */
const TIER_RATE_LIMITS: Record<'free' | 'premium' | 'pro', TierRateLimit> = {
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes (increased from 30)
  },
  premium: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes (increased from 200)
  },
  pro: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // 2000 requests per 15 minutes (increased from 1000)
  },
};

/**
 * In-memory store for rate limit tracking
 * In production, consider using Redis for distributed systems
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 60 * 1000); // Clean up every minute

/**
 * Get rate limit key for user
 */
function getRateLimitKey(userId: string, tier: string, path: string): string {
  return `${userId}:${tier}:${path}`;
}

/**
 * Tier-based rate limiter middleware
 * Applies different limits based on user's subscription tier
 */
export const tierRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Skip rate limiting for unauthenticated requests (handled by auth middleware)
      next();
      return;
    }

    // Get user subscription
    const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
    if (!subscriptionData) {
      // No subscription found, apply free tier limits
      logger.warn('No subscription found for user, applying free tier rate limits', { userId });
    }

    const tier: 'free' | 'premium' | 'pro' = (subscriptionData?.subscription.tier || 'free') as 'free' | 'premium' | 'pro';
    const limits = TIER_RATE_LIMITS[tier];
    const key = getRateLimitKey(userId, tier, req.path);

    // Get or create rate limit entry
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime: now + limits.windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Check if limit would be exceeded BEFORE incrementing
    if (entry.count >= limits.max) {
      logger.warn('Tier-based rate limit exceeded', {
        userId,
        tier,
        path: req.path,
        count: entry.count,
        limit: limits.max,
      });

      const rateLimitError = new RateLimitError(
        `Rate limit exceeded. ${tier === 'free' ? 'Upgrade to premium for higher limits.' : 'Please try again later.'}`
      );
      
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
      const limitValue: number = limits.max;
      const windowMsValue: number = limits.windowMs;
      
      // Set rate limit headers before error response
      res.setHeader('X-RateLimit-Limit', limits.max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
      
      // Send error response and return early (matching pattern from subscription.middleware.ts)
      res.status(rateLimitError.statusCode).json({
        success: false,
        error: {
          message: rateLimitError.message,
          code: rateLimitError.code || 'RATE_LIMIT_EXCEEDED',
          limit: limitValue,
          windowMs: windowMsValue,
          tier: tier,
          retryAfter,
        },
      });
      return;
    }

    // Increment count only if limit not exceeded
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limits.max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.max - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    next();
  } catch (err: any) {
    logger.error('Error in tier rate limiter:', err);
    // Don't block request if rate limiting fails
    next();
  }
};
