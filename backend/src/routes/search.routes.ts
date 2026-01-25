import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { PineconeService } from '../services/pinecone.service';
import { EmbeddingService } from '../services/embedding.service';
import { apiLimiter } from '../middleware/rateLimiter';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/search/semantic
 * Perform semantic search over document embeddings
 */
router.post(
  '/semantic',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { query, topK, topicId, documentIds, minScore } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ValidationError('Query is required and must be a non-empty string');
    }

    // Generate embedding for the query
    logger.info('Generating query embedding', {
      userId,
      queryLength: query.length,
    });

    const queryEmbedding = await EmbeddingService.generateEmbedding(query);

    // Perform semantic search
    const results = await PineconeService.search(queryEmbedding, {
      userId,
      topK: topK || 10,
      topicId: topicId || undefined,
      documentIds: documentIds || undefined,
      minScore: minScore || 0.7,
    });

    res.status(200).json({
      success: true,
      message: 'Semantic search completed',
      data: {
        query,
        results,
        count: results.length,
      },
    });
  })
);

/**
 * GET /api/search/index-stats
 * Get Pinecone index statistics
 */
router.get(
  '/index-stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await PineconeService.getIndexStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  })
);

export default router;
