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
    const { 
      query, 
      topic, 
      maxResults, 
      includeDomains, 
      excludeDomains,
      searchDepth,
      includeRawContent,
      includeAnswer,
      includeImages,
      timeRange,
      startDate,
      endDate,
      country,
    } = req.body;

    if (!query) {
      throw new ValidationError('Search query is required');
    }

    // Validate time range if provided
    const validTimeRanges = ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'];
    if (timeRange && !validTimeRanges.includes(timeRange)) {
      throw new ValidationError(`Invalid timeRange. Must be one of: ${validTimeRanges.join(', ')}`);
    }

    const validSearchDepths = ['basic', 'advanced'];
    if (searchDepth && !validSearchDepths.includes(searchDepth)) {
      throw new ValidationError(`Invalid searchDepth. Must be one of: ${validSearchDepths.join(', ')}`);
    }

    // Validate date format if provided
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new ValidationError('startDate must be in YYYY-MM-DD format');
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new ValidationError('endDate must be in YYYY-MM-DD format');
    }

    if (maxResults && (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 10)) {
      throw new ValidationError('maxResults must be a number between 1 and 10');
    }

    if (includeDomains && !Array.isArray(includeDomains)) {
      throw new ValidationError('includeDomains must be an array of domain strings');
    }
    if (excludeDomains && !Array.isArray(excludeDomains)) {
      throw new ValidationError('excludeDomains must be an array of domain strings');
    }

    if (includeRawContent !== undefined && typeof includeRawContent !== 'boolean') {
      throw new ValidationError('includeRawContent must be a boolean');
    }
    if (includeAnswer !== undefined && typeof includeAnswer !== 'boolean') {
      throw new ValidationError('includeAnswer must be a boolean');
    }
    if (includeImages !== undefined && typeof includeImages !== 'boolean') {
      throw new ValidationError('includeImages must be a boolean');
    }

    const searchRequest: SearchRequest = {
      query: query.trim(),
      topic: topic?.trim(),
      maxResults: maxResults || 5,
      includeDomains: includeDomains,
      excludeDomains: excludeDomains,
      searchDepth,
      includeRawContent,
      includeAnswer,
      includeImages,
      timeRange: timeRange,
      startDate: startDate,
      endDate: endDate,
      country: country?.trim()?.toUpperCase(),
    };

    logger.info('Search request', {
      userId: req.user?.id,
      query: searchRequest.query,
      topic: searchRequest.topic,
      timeRange: searchRequest.timeRange,
      country: searchRequest.country,
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
