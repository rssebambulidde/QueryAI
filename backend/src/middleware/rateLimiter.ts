import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RateLimitError } from '../types/error';
import logger from '../config/logger';
import { isRedisConfigured, getRedisClient } from '../config/redis.config';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs (increased for document operations)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: {
    trustProxy: true, // Enable trust proxy for Railway/Cloudflare deployments
  },
  skip: (req: Request) => {
    // Skip rate limiting for document uploads (they're handled by multer)
    return req.path.includes('/documents/upload');
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, { path: req.path });
    const error = new RateLimitError('Too many requests. Please wait 15 minutes before trying again.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs (increased from 5 for better UX)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true, // Enable trust proxy for Railway/Cloudflare deployments
  },
  skipSuccessfulRequests: true, // Don't count successful logins against rate limit
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    const error = new RateLimitError('Too many authentication attempts. Please wait 15 minutes before trying again.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  },
});

// Strict limiter for public form endpoints (enterprise inquiry, contact)
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per IP per hour
  message: 'Too many submissions from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Public form rate limit exceeded for IP: ${req.ip}`, { path: req.path });
    const error = new RateLimitError('Too many submissions. Please wait before trying again.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  },
});

// Stricter limiter for unauthenticated "invite a friend" (signup page) to prevent abuse
export const inviteGuestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 invites per IP per 15 minutes
  message: 'Too many invitations sent. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Invite guest rate limit exceeded for IP: ${req.ip}`);
    const error = new RateLimitError('Too many invitations. Please wait 15 minutes before sending more.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  },
});

// Rate limiter for PayPal webhook endpoint — prevent replay/flood attacks
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per IP per minute
  message: 'Too many webhook requests.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Webhook rate limit exceeded for IP: ${req.ip}`, { path: req.path });
    const error = new RateLimitError('Too many webhook requests. Please slow down.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  },
});

// --- Progressive login rate limiting ---

interface FailureRecord {
  count: number;
  lastFailure: number;
}

const FAILURE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const failureMap = new Map<string, FailureRecord>();

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of failureMap) {
    if (now - record.lastFailure > FAILURE_WINDOW_MS) {
      failureMap.delete(key);
    }
  }
}, FAILURE_WINDOW_MS);

const PROGRESSIVE_TIERS = [
  { threshold: 5, cooldownSeconds: 60 },      // 5 failures → 1 min
  { threshold: 10, cooldownSeconds: 300 },     // 10 failures → 5 min
  { threshold: 20, cooldownSeconds: 1800 },    // 20 failures → 30 min
];

function getApplicableTier(count: number): { cooldownSeconds: number } | null {
  for (let i = PROGRESSIVE_TIERS.length - 1; i >= 0; i--) {
    if (count >= PROGRESSIVE_TIERS[i].threshold) {
      return PROGRESSIVE_TIERS[i];
    }
  }
  return null;
}

async function getFailureCount(key: string): Promise<number> {
  // Try Redis first
  if (isRedisConfigured()) {
    try {
      const client = await getRedisClient();
      const val = await client.get(`login_failures:${key}`);
      if (val !== null) return parseInt(val, 10);
    } catch {
      // Fall through to in-memory
    }
  }
  const record = failureMap.get(key);
  if (!record) return 0;
  if (Date.now() - record.lastFailure > FAILURE_WINDOW_MS) {
    failureMap.delete(key);
    return 0;
  }
  return record.count;
}

async function incrementFailure(key: string): Promise<number> {
  const now = Date.now();

  // In-memory
  const existing = failureMap.get(key);
  const newCount = (existing && now - existing.lastFailure < FAILURE_WINDOW_MS)
    ? existing.count + 1
    : 1;
  failureMap.set(key, { count: newCount, lastFailure: now });

  // Redis overlay
  if (isRedisConfigured()) {
    try {
      const client = await getRedisClient();
      const redisKey = `login_failures:${key}`;
      const newVal = await client.incr(redisKey);
      if (newVal === 1) {
        await client.expire(redisKey, Math.ceil(FAILURE_WINDOW_MS / 1000));
      }
      return newVal;
    } catch {
      // Fall through to in-memory count
    }
  }
  return newCount;
}

async function resetFailures(key: string): Promise<void> {
  failureMap.delete(key);
  if (isRedisConfigured()) {
    try {
      const client = await getRedisClient();
      await client.del(`login_failures:${key}`);
    } catch {
      // Ignore
    }
  }
}

export function buildProgressiveKey(req: Request, email?: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return email ? `${ip}:${email.toLowerCase()}` : ip;
}

export async function checkProgressiveLimit(key: string): Promise<{ blocked: boolean; retryAfter?: number }> {
  const count = await getFailureCount(key);
  const tier = getApplicableTier(count);
  if (!tier) return { blocked: false };

  // Check if cooldown has elapsed since last failure
  let lastFailureTime: number | null = null;
  const record = failureMap.get(key);
  if (record) lastFailureTime = record.lastFailure;

  if (lastFailureTime) {
    const elapsed = (Date.now() - lastFailureTime) / 1000;
    if (elapsed < tier.cooldownSeconds) {
      const retryAfter = Math.ceil(tier.cooldownSeconds - elapsed);
      return { blocked: true, retryAfter };
    }
  }
  return { blocked: false };
}

export { incrementFailure as recordLoginFailure, resetFailures as resetLoginFailures };

// Rate limiter for anonymous (unauthenticated) AI query endpoint
// Stricter IP-based limits to prevent abuse while allowing product trial
export const anonymousAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 queries per IP per hour
  message: 'Anonymous query limit reached. Sign up for free to continue.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Anonymous AI rate limit exceeded for IP: ${req.ip}`);
    const error = new RateLimitError('You\'ve reached the anonymous query limit. Sign up for free to keep asking questions.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: 'ANONYMOUS_LIMIT_REACHED',
      },
    });
  },
});
