import { Router, Request, Response } from 'express';
import { SearchService, SearchRequest } from '../services/search.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/search
 * Perform web search using Tavily
 * Requires authentication
 */
router.post(
  '/',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { query, topic, maxResults, includeDomains, excludeDomains } = req.body;

    if (!query) {
      throw new ValidationError('Search query is required');
    }

    const searchRequest: SearchRequest = {
      query: query.trim(),
      topic: topic?.trim(),
      maxResults: maxResults || 5,
      includeDomains: includeDomains,
      excludeDomains: excludeDomains,
    };

    logger.info('Search request', {
      userId: req.user?.id,
      query: searchRequest.query,
      topic: searchRequest.topic,
    });

    const result = await SearchService.search(searchRequest);

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: result,
    });
  })
);

/**
 * GET /api/search/cache/stats
 * Get search cache statistics
 * Requires authentication
 */
router.get(
  '/cache/stats',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = SearchService.getCacheStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  })
);

/**
 * DELETE /api/search/cache
 * Clear search cache
 * Requires authentication
 */
router.delete(
  '/cache',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    SearchService.clearCache();

    res.status(200).json({
      success: true,
      message: 'Search cache cleared',
    });
  })
);

export default router;
