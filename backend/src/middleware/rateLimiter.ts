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
    trustProxy: false, // Disable trust proxy validation to avoid warnings
  },
  skip: (req: Request) => {
    // Skip rate limiting for document uploads (they're handled by multer)
    return req.path.includes('/documents/upload');
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, { path: req.path });
    const error = new RateLimitError('Too many requests, please try again later.');
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
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false, // Disable trust proxy validation to avoid warnings
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    const error = new RateLimitError('Too many authentication attempts, please try again later.');
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  },
});
