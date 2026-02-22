/**
 * Config Routes (public, no auth)
 *
 * Provides runtime configuration that the frontend needs before
 * the user is authenticated (e.g. pricing).
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/config/pricing
 * Returns the current pricing configuration (tiers + overage).
 * Public — no authentication required.
 */
router.get(
  '/pricing',
  apiLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    const { PricingConfigService } = await import('../services/pricing-config.service');
    const config = await PricingConfigService.getAll();

    res.json({
      success: true,
      data: config,
    });
  })
);

export default router;
