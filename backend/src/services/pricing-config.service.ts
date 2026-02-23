/**
 * Pricing Config Service
 *
 * Reads / writes tier pricing and overage pricing from the
 * `system_settings` table (key = `pricing_config`).
 *
 * Uses an in-memory TTL cache (60 s) so hot-path callers like
 * `getPricing()` don't hit the DB on every request.  The cache
 * is pre-warmed at startup via `initialize()`.
 *
 * All writes go through `SystemSettingsService.set()` which
 * handles upsert + audit trail.
 */

import { z } from 'zod';
import logger from '../config/logger';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const TierPricingSchema = z.object({
  monthly: z.number().min(0),
  annual: z.number().min(0),
});

const PricingConfigSchema = z.object({
  tiers: z.object({
    free: TierPricingSchema,
    pro: TierPricingSchema,
    enterprise: TierPricingSchema,
  }),
  overage: z.object({
    queries: z.number().min(0),
    document_upload: z.number().min(0),
    tavily_searches: z.number().min(0),
  }),
});

export type PricingConfig = z.infer<typeof PricingConfigSchema>;
export type TierPricing = z.infer<typeof TierPricingSchema>;

// ── Hardcoded fallback (matches migration 050 seed) ─────────────────────────

const FALLBACK_CONFIG: PricingConfig = {
  tiers: {
    free: { monthly: 0, annual: 0 },
    pro: { monthly: 45, annual: 450 },
    enterprise: { monthly: 99, annual: 0 },
  },
  overage: {
    queries: 0.05,
    document_upload: 0.50,
    tavily_searches: 0.10,
  },
};

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds
let cachedConfig: PricingConfig | null = null;
let cacheExpiresAt = 0;

// ── Service ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'pricing_config';

export class PricingConfigService {
  /**
   * Pre-warm the cache at server start.
   * Safe to call multiple times; no-ops if cache is still warm.
   */
  static async initialize(): Promise<void> {
    try {
      await PricingConfigService.getAll();
      logger.info('PricingConfigService initialized');
    } catch (err) {
      logger.warn('PricingConfigService.initialize failed — using fallback', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Return the full pricing config (from cache → DB → fallback).
   */
  static async getAll(): Promise<PricingConfig> {
    // 1. Return from cache if still valid
    if (cachedConfig && cacheExpiresAt > Date.now()) {
      return cachedConfig;
    }

    // 2. Fetch from system_settings
    try {
      const { SystemSettingsService } = await import('./system-settings.service');
      const raw = await SystemSettingsService.get<unknown>(SETTINGS_KEY);

      if (raw) {
        const parsed = PricingConfigSchema.safeParse(raw);
        if (parsed.success) {
          cachedConfig = parsed.data;
          cacheExpiresAt = Date.now() + CACHE_TTL_MS;
          return cachedConfig;
        }
        logger.warn('pricing_config failed Zod validation — using fallback', {
          issues: parsed.error.issues,
        });
      }
    } catch (err) {
      logger.warn('PricingConfigService.getAll DB read failed — using fallback', {
        error: (err as Error).message,
      });
    }

    // 3. Fallback to hardcoded defaults
    cachedConfig = FALLBACK_CONFIG;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedConfig;
  }

  /**
   * Return the synchronous cached config.
   * Falls back to hardcoded defaults if cache is empty (before `initialize()`).
   */
  static getCached(): PricingConfig {
    return cachedConfig ?? FALLBACK_CONFIG;
  }

  /**
   * Update the full pricing config.
   * Validates with Zod before persisting.
   */
  static async update(config: unknown, updatedBy: string): Promise<PricingConfig> {
    const parsed = PricingConfigSchema.parse(config); // throws ZodError on bad input

    // Capture old value for audit trail
    const oldValue = await PricingConfigService.getAll();

    const { SystemSettingsService } = await import('./system-settings.service');
    await SystemSettingsService.set(SETTINGS_KEY, parsed, updatedBy);

    // Refresh local cache immediately
    cachedConfig = parsed;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    // Audit trail (fire-and-forget)
    const { ConfigAuditService } = await import('./config-audit.service');
    ConfigAuditService.logChange(
      'pricing_config',
      oldValue as unknown as Record<string, unknown>,
      parsed as unknown as Record<string, unknown>,
      updatedBy,
    );

    logger.info('Pricing config updated', { updatedBy });
    return parsed;
  }

  /**
   * Clear the local cache (forces next `getAll()` to re-read from DB).
   */
  static invalidateCache(): void {
    cachedConfig = null;
    cacheExpiresAt = 0;
  }

  /** Expose the Zod schema for request validation in routes. */
  static get schema() {
    return PricingConfigSchema;
  }

  /** Expose the hardcoded fallback for tests / reference. */
  static get fallback(): PricingConfig {
    return FALLBACK_CONFIG;
  }
}
