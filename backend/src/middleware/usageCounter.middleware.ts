import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';

/**
 * Usage Counter Middleware
 * Automatically logs usage when actions are performed
 */

/**
 * Middleware to log query usage
 * Should be used after enforceQueryLimit middleware
 */
export const logQueryUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Log usage after successful query
  const originalSend = res.send;
  res.send = function (body: any) {
    // Only log if request was successful (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const userId = req.user?.id;
      if (userId) {
        // Log usage asynchronously (don't block response)
        DatabaseService.logUsage(userId, 'query', {
          path: req.path,
          method: req.method,
          conversationId: req.body?.conversationId || req.params?.conversationId,
          topicId: req.body?.topicId || req.query?.topicId,
        }).catch((error) => {
          logger.error('Failed to log query usage:', error);
        });
      }
    }
    return originalSend.call(this, body);
  };
  next();
};

/**
 * Middleware to log document upload usage
 * Should be used after enforceDocumentUploadLimit middleware
 */
export const logDocumentUploadUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const originalSend = res.send;
  res.send = function (body: any) {
    // Only log if request was successful (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const userId = req.user?.id;
      if (userId) {
        // Log usage asynchronously (don't block response)
        DatabaseService.logUsage(userId, 'document_upload', {
          path: req.path,
          method: req.method,
          documentId: req.body?.documentId || req.params?.documentId,
          fileName: req.body?.fileName || req.file?.originalname,
          fileSize: req.body?.fileSize || req.file?.size,
        }).catch((error) => {
          logger.error('Failed to log document upload usage:', error);
        });
      }
    }
    return originalSend.call(this, body);
  };
  next();
};

/**
 * Middleware to log API call usage
 * For external API access (when API keys are used)
 */
export const logApiCallUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const originalSend = res.send;
  res.send = function (body: any) {
    // Only log if request was successful (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const userId = req.user?.id || (req as any).apiKey?.user_id;
      if (userId) {
        // Log usage asynchronously (don't block response)
        DatabaseService.logUsage(userId, 'api_call', {
          path: req.path,
          method: req.method,
          apiKeyId: (req as any).apiKey?.id,
          endpoint: req.path,
        }).catch((error) => {
          logger.error('Failed to log API call usage:', error);
        });
      }
    }
    return originalSend.call(this, body);
  };
  next();
};
