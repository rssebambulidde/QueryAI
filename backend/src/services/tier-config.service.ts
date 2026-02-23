/**
 * Tier Config Service
 *
 * Reads / writes per-tier quota limits from the
 * `system_settings` table (key = `tier_limits`).
 *
 * Uses an in-memory TTL cache (60 s) so hot-path callers like
 * `SubscriptionService.getUserSubscriptionWithLimits()` don't hit
 * the DB on every request.  The cache is pre-warmed at startup
 * via `initialize()`.
 *
 * Design mirrors PricingConfigService for consistency.
 */

import { z } from 'zod';
import logger from '../config/logger';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const SingleTierLimitsSchema = z.object({
  queriesPerMonth: z.number().int().min(0).nullable(),
  tavilySearchesPerMonth: z.number().int().min(0).nullable(),
  maxCollections: z.number().int().min(0).nullable(),
  allowResearchMode: z.boolean(),
});

export const TIER_NAMES = ['free', 'pro', 'enterprise'] as const;
export type TierName = (typeof TIER_NAMES)[number];

const AllTierLimitsSchema = z.object({
  free: SingleTierLimitsSchema,
  pro: SingleTierLimitsSchema,
  enterprise: SingleTierLimitsSchema,
});

export type AllTierLimits = z.infer<typeof AllTierLimitsSchema>;
export type SingleTierLimits = z.infer<typeof SingleTierLimitsSchema>;

// ── Hardcoded fallback (matches migration 051 seed) ─────────────────────────

const FALLBACK_LIMITS: AllTierLimits = {
  free: {
    queriesPerMonth: 300,
    tavilySearchesPerMonth: 10,
    maxCollections: 3,
    allowResearchMode: false,
  },
  pro: {
    queriesPerMonth: null,
    tavilySearchesPerMonth: 200,
    maxCollections: null,
    allowResearchMode: true,
  },
  enterprise: {
    queriesPerMonth: null,
    tavilySearchesPerMonth: null,
    maxCollections: null,
    allowResearchMode: true,
  },
};

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds
let cachedLimits: AllTierLimits | null = null;
let cacheExpiresAt = 0;

// ── Service ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'tier_limits';

export class TierConfigService {
  /**
   * Pre-warm the cache at server start.
   */
  static async initialize(): Promise<void> {
    try {
      await TierConfigService.getAllLimits();
      logger.info('TierConfigService initialized');
    } catch (err) {
      logger.warn('TierConfigService.initialize failed — using fallback', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Return the full tier-limits map (from cache → DB → fallback).
   */
  static async getAllLimits(): Promise<AllTierLimits> {
    if (cachedLimits && cacheExpiresAt > Date.now()) {
      return cachedLimits;
    }

    try {
      const { SystemSettingsService } = await import('./system-settings.service');
      const raw = await SystemSettingsService.get<unknown>(SETTINGS_KEY);

      if (raw) {
        const parsed = AllTierLimitsSchema.safeParse(raw);
        if (parsed.success) {
          cachedLimits = parsed.data;
          cacheExpiresAt = Date.now() + CACHE_TTL_MS;
          return cachedLimits;
        }
        logger.warn('tier_limits failed Zod validation — using fallback', {
          issues: parsed.error.issues,
        });
      }
    } catch (err) {
      logger.warn('TierConfigService.getAllLimits DB read failed — using fallback', {
        error: (err as Error).message,
      });
    }

    cachedLimits = FALLBACK_LIMITS;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedLimits;
  }

  /**
   * Return limits for a single tier (async, reads from cache/DB).
   */
  static async getLimits(tier: TierName): Promise<SingleTierLimits> {
    const all = await TierConfigService.getAllLimits();
    return all[tier];
  }

  /**
   * Synchronous accessor — uses cache, falls back to hardcoded.
   */
  static getCached(): AllTierLimits {
    return cachedLimits ?? FALLBACK_LIMITS;
  }

  /**
   * Synchronous accessor for a single tier.
   */
  static getCachedTier(tier: TierName): SingleTierLimits {
    return (cachedLimits ?? FALLBACK_LIMITS)[tier];
  }

  /**
   * Persist updated limits for a single tier. Zod-validates the
   * individual tier shape, merges into the full map, and writes back.
   */
  static async updateLimits(
    tier: TierName,
    limits: unknown,
    updatedBy: string,
  ): Promise<AllTierLimits> {
    const parsed = SingleTierLimitsSchema.parse(limits); // throws ZodError

    const current = await TierConfigService.getAllLimits();
    const merged: AllTierLimits = { ...current, [tier]: parsed };

    const { SystemSettingsService } = await import('./system-settings.service');
    await SystemSettingsService.set(SETTINGS_KEY, merged, updatedBy);

    cachedLimits = merged;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    // Audit trail (fire-and-forget)
    const { ConfigAuditService } = await import('./config-audit.service');
    ConfigAuditService.logChange(
      'tier_limits',
      current as unknown as Record<string, unknown>,
      merged as unknown as Record<string, unknown>,
      updatedBy,
    );

    logger.info('Tier limits updated', { tier, updatedBy });
    return merged;
  }

  /**
   * Clear the local cache.
   */
  static invalidateCache(): void {
    cachedLimits = null;
    cacheExpiresAt = 0;
  }

  /** Expose schemas for route validation. */
  static get singleTierSchema() {
    return SingleTierLimitsSchema;
  }
  static get allTiersSchema() {
    return AllTierLimitsSchema;
  }

  /** Expose the hardcoded fallback for tests / reference. */
  static get fallback(): AllTierLimits {
    return FALLBACK_LIMITS;
  }

  /** Expose valid tier names for route param validation. */
  static get tierNames(): readonly string[] {
    return TIER_NAMES;
  }
}
