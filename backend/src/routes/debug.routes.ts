import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/debug/health
 * Basic debug health check
 */
router.get(
  '/health',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message: 'Debug endpoint healthy',
      data: {
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
      },
    });
  })
);

// v2: Pinecone debug endpoints removed — document search retired.

export default router;
