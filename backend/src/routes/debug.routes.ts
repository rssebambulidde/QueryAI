import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { getPineconeIndex, isPineconeConfigured, getIndexName } from '../config/pinecone';
import { PineconeService } from '../services/pinecone.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/debug/pinecone-status
 * Check Pinecone configuration and connection
 */
router.get(
  '/pinecone-status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const isConfigured = isPineconeConfigured();
    const indexName = getIndexName();

    if (!isConfigured) {
      return res.status(200).json({
        success: false,
        message: 'Pinecone is not configured',
        data: {
          configured: false,
          indexName,
          envVar: process.env.PINECONE_API_KEY ? 'Set' : 'Not set',
        },
      });
    }

    try {
      const index = await getPineconeIndex();
      const stats = await PineconeService.getIndexStats();

      return res.status(200).json({
        success: true,
        message: 'Pinecone is configured and connected',
        data: {
          configured: true,
          indexName,
          stats,
          apiKey: process.env.PINECONE_API_KEY ? 'Set' : 'Not set',
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Pinecone connection failed',
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        data: {
          configured: isConfigured,
          indexName,
        },
      });
    }
  })
);

/**
 * POST /api/debug/test-pinecone-upsert
 * Test Pinecone upsert with a single vector
 */
router.post(
  '/test-pinecone-upsert',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isPineconeConfigured()) {
      throw new ValidationError('Pinecone is not configured');
    }

    try {
      const index = await getPineconeIndex();
      
      // Create a test vector
      const testVector = {
        id: `test-${Date.now()}`,
        values: new Array(1536).fill(0).map(() => Math.random()),
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      };

      logger.info('Testing Pinecone upsert', {
        vectorId: testVector.id,
        dimensions: testVector.values.length,
      });

      // Try upsert
      await index.upsert([testVector]);

      logger.info('Pinecone upsert test successful', {
        vectorId: testVector.id,
      });

      // Try to fetch it back
      const fetchResult = await index.fetch([testVector.id]);

      return res.status(200).json({
        success: true,
        message: 'Pinecone upsert test successful',
        data: {
          vectorId: testVector.id,
          fetchResult: fetchResult.records || {},
        },
      });
    } catch (error: any) {
      logger.error('Pinecone upsert test failed', {
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: 'Pinecone upsert test failed',
        error: {
          message: error.message,
          code: error.code,
          status: error.status,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      });
    }
  })
);

export default router;
