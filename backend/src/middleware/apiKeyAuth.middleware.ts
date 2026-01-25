import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/api-key.service';
import { AppError } from '../types/error';
import logger from '../config/logger';

/**
 * Middleware to authenticate requests using API keys
 * Expects API key in Authorization header as: "Bearer <api_key>"
 * or in X-API-Key header
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract API key from headers
    let apiKey: string | undefined;

    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    // Check X-API-Key header (alternative)
    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'] as string;
    }

    if (!apiKey) {
      throw new AppError(
        'API key is required. Provide it in Authorization header (Bearer <key>) or X-API-Key header.',
        401,
        'API_KEY_MISSING'
      );
    }

    // Validate API key
    const apiKeyRecord = await ApiKeyService.validateApiKey(apiKey);
    if (!apiKeyRecord) {
      throw new AppError('Invalid or expired API key', 401, 'API_KEY_INVALID');
    }

    // Check rate limits
    const rateLimit = await ApiKeyService.checkRateLimit(apiKeyRecord.id);
    if (!rateLimit.allowed) {
      throw new AppError(
        `Rate limit exceeded. Remaining: ${rateLimit.remainingPerHour || 0}/hr, ${rateLimit.remainingPerDay || 0}/day`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    // Attach API key info to request
    (req as any).apiKey = apiKeyRecord;
    (req as any).userId = apiKeyRecord.user_id;
    (req as any).topicId = apiKeyRecord.topic_id; // Topic scope for this API key

    logger.info('API key authenticated', {
      apiKeyId: apiKeyRecord.id,
      userId: apiKeyRecord.user_id,
      topicId: apiKeyRecord.topic_id,
      endpoint: req.path,
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Unexpected error in API key authentication:', error);
      next(new AppError('Authentication failed', 401, 'AUTH_ERROR'));
    }
  }
};

/**
 * Middleware to log API key usage after request
 */
export const logApiKeyUsage = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log usage when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    // Log usage asynchronously (don't block response)
    if ((req as any).apiKey) {
      ApiKeyService.logUsage(
        (req as any).apiKey.id,
        req.path,
        req.method,
        res.statusCode,
        responseTime
      ).catch((error) => {
        logger.error('Failed to log API key usage:', error);
      });
    }
  });

  next();
};
