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

/**
 * GET /api/config/tier-limits
 * Returns per-tier quotas & feature flags for display
 * (e.g. pricing-page feature matrix).
 * Public — no authentication required.
 */
router.get(
  '/tier-limits',
  apiLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    const { TierConfigService } = await import('../services/tier-config.service');
    const limits = await TierConfigService.getAllLimits();

    res.json({
      success: true,
      data: limits,
    });
  })
);

/**
 * GET /api/config/tier-comparison
 * Returns a structured "Compare Plans" matrix auto-generated from
 * tier limits + pricing config.  Each feature row has a label, a
 * tooltip, and per-tier values (string/boolean/number).
 * Public — no authentication required.
 */
router.get(
  '/tier-comparison',
  apiLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    const { TierConfigService, TIER_NAMES } = await import('../services/tier-config.service');
    const { PricingConfigService } = await import('../services/pricing-config.service');

    const [limits, pricing] = await Promise.all([
      TierConfigService.getAllLimits(),
      PricingConfigService.getAll(),
    ]);

    // ── helper: format a nullable number as a display string ──
    const fmt = (v: number | null): string => (v === null ? 'Unlimited' : v.toLocaleString('en-US'));

    // ── build feature rows ──
    type TierValue = string | boolean | number | null;
    interface FeatureRow {
      key: string;
      label: string;
      tooltip?: string;
      category: 'pricing' | 'quota' | 'feature';
      values: Record<string, TierValue>;
    }

    const tiers = [...TIER_NAMES]; // ['free', 'pro', 'enterprise']

    const rows: FeatureRow[] = [
      // ── Pricing rows ──
      {
        key: 'price_monthly',
        label: 'Monthly price',
        tooltip: 'Billed monthly in USD',
        category: 'pricing',
        values: Object.fromEntries(
          tiers.map((t) => [t, pricing.tiers[t].monthly]),
        ),
      },
      {
        key: 'price_annual',
        label: 'Annual price',
        tooltip: 'Billed once per year in USD',
        category: 'pricing',
        values: Object.fromEntries(
          tiers.map((t) => [t, pricing.tiers[t].annual]),
        ),
      },
      // ── Quota rows ──
      {
        key: 'queries_per_month',
        label: 'Queries per month',
        tooltip: 'Number of AI queries allowed each month',
        category: 'quota',
        values: Object.fromEntries(
          tiers.map((t) => [t, fmt(limits[t].queriesPerMonth)]),
        ),
      },
      {
        key: 'tavily_searches',
        label: 'Web searches per month',
        tooltip: 'Real-time web searches (Tavily) included each month',
        category: 'quota',
        values: Object.fromEntries(
          tiers.map((t) => [t, fmt(limits[t].tavilySearchesPerMonth)]),
        ),
      },
      {
        key: 'max_collections',
        label: 'Document collections',
        tooltip: 'Maximum number of document collections you can create',
        category: 'quota',
        values: Object.fromEntries(
          tiers.map((t) => [t, fmt(limits[t].maxCollections)]),
        ),
      },
      // ── Feature flag rows ──
      {
        key: 'research_mode',
        label: 'Research mode',
        tooltip: 'Deep multi-step research with source synthesis',
        category: 'feature',
        values: Object.fromEntries(
          tiers.map((t) => [t, limits[t].allowResearchMode]),
        ),
      },
    ];

    res.json({
      success: true,
      data: {
        tiers,
        features: rows,
      },
    });
  })
);

export default router;
