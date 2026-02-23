import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { RateLimitError } from '../types/error';
import logger from '../config/logger';

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
