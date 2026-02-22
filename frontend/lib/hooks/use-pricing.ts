/**
 * usePricing Hook
 *
 * Fetches pricing config from the backend (`GET /api/config/pricing`)
 * and exposes the same helper functions that `lib/pricing.ts` used
 * to export from hardcoded constants.
 *
 * Falls back to hardcoded defaults while the fetch is in-flight or
 * on error, so callers always have usable data.
 */

'use client';

import { useEffect, useState } from 'react';
import { configApi, type PricingConfigResponse } from '@/lib/api';
import type { Tier, BillingPeriod } from '@/lib/pricing';

// ── Hardcoded fallback (matches migration-050 seed) ─────────────────────────

const FALLBACK: PricingConfigResponse = {
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

// ── Module-level singleton cache ────────────────────────────────────────────
// Shared across all hook instances to avoid redundant fetches.

let cachedConfig: PricingConfigResponse | null = null;
let fetchPromise: Promise<PricingConfigResponse> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchConfig(): Promise<PricingConfigResponse> {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) return cachedConfig;
  if (fetchPromise) return fetchPromise;

  fetchPromise = configApi
    .getPricing()
    .then((res) => {
      if (res.success && res.data) {
        cachedConfig = res.data;
        cacheTimestamp = Date.now();
        return res.data;
      }
      return FALLBACK;
    })
    .catch(() => FALLBACK)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

/** Invalidate the module-level cache so the next consumer gets fresh data. */
export function invalidatePricingCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePricingReturn {
  /** The raw pricing config object. */
  config: PricingConfigResponse;
  /** True while the initial fetch is in-flight. */
  loading: boolean;
  /** Get price for a tier + period. */
  getPricing: (tier: Tier, period?: BillingPeriod) => number;
  /** Get both monthly + annual for a tier. */
  getAllPricing: (tier: Tier) => { monthly: number; annual: number };
  /** Annual savings breakdown for a tier. */
  getAnnualSavings: (tier: Tier) => {
    monthlyTotal: number;
    annualPrice: number;
    savings: number;
    savingsPercentage: number;
  };
  /** Format a dollar amount. */
  formatPrice: (amount: number) => string;
  /** Whether the tier is enterprise (contact-for-pricing). */
  isEnterpriseTier: (tier: Tier) => boolean;
  /** Force re-fetch from backend. */
  refresh: () => Promise<void>;
}

export function usePricing(): UsePricingReturn {
  const [config, setConfig] = useState<PricingConfigResponse>(
    cachedConfig ?? FALLBACK
  );
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    let cancelled = false;

    fetchConfig().then((c) => {
      if (!cancelled) {
        setConfig(c);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const getPricingFn = (tier: Tier, period: BillingPeriod = 'monthly'): number => {
    return period === 'annual'
      ? config.tiers[tier].annual
      : config.tiers[tier].monthly;
  };

  const getAllPricingFn = (tier: Tier) => ({
    monthly: config.tiers[tier].monthly,
    annual: config.tiers[tier].annual,
  });

  const getAnnualSavingsFn = (tier: Tier) => {
    const monthlyTotal = config.tiers[tier].monthly * 12;
    const annualPrice = config.tiers[tier].annual;
    const savings = monthlyTotal - annualPrice;
    const savingsPercentage =
      monthlyTotal > 0 ? (savings / monthlyTotal) * 100 : 0;
    return {
      monthlyTotal,
      annualPrice,
      savings,
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
    };
  };

  const formatPriceFn = (amount: number): string => `$${amount.toFixed(2)}`;

  const isEnterpriseTierFn = (tier: Tier): boolean => tier === 'enterprise';

  const refresh = async () => {
    cachedConfig = null;
    cacheTimestamp = 0;
    const c = await fetchConfig();
    setConfig(c);
  };

  return {
    config,
    loading,
    getPricing: getPricingFn,
    getAllPricing: getAllPricingFn,
    getAnnualSavings: getAnnualSavingsFn,
    formatPrice: formatPriceFn,
    isEnterpriseTier: isEnterpriseTierFn,
    refresh,
  };
}
