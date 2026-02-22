/**
 * Pricing Constants
 *
 * Thin wrapper around PricingConfigService.  Dollar amounts are read
 * from the `system_settings` DB table (key = `pricing_config`) so
 * that a superadmin can change prices at runtime.
 *
 * All functions here are **synchronous** — they read from the
 * in-memory cache populated by `PricingConfigService.initialize()`
 * at server startup.  If the cache is cold the hardcoded fallback
 * inside PricingConfigService is returned (identical to migration
 * 050 seed values).
 *
 * Structural metadata (tier names, descriptions, ordering) remains
 * hardcoded — only dollar amounts are DB-driven.
 */

import { PricingConfigService } from '../services/pricing-config.service';
import type { PricingConfig } from '../services/pricing-config.service';

export type Tier = 'free' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';

// ── Price accessors (DB-driven via cache) ────────────────────────────────────

/** Helper — returns the cached pricing config snapshot. */
function cfg(): PricingConfig {
  return PricingConfigService.getCached();
}

/**
 * Monthly pricing for each tier in USD.
 * NOTE: This getter returns a **snapshot** — callers should not cache the reference.
 */
export function getMonthlyPricing(): Record<Tier, number> {
  const c = cfg();
  return {
    free: c.tiers.free.monthly,
    pro: c.tiers.pro.monthly,
    enterprise: c.tiers.enterprise.monthly,
  };
}

/**
 * Annual pricing for each tier in USD.
 */
export function getAnnualPricing(): Record<Tier, number> {
  const c = cfg();
  return {
    free: c.tiers.free.annual,
    pro: c.tiers.pro.annual,
    enterprise: c.tiers.enterprise.annual,
  };
}

/**
 * Backward-compat constants — lazily delegate to getters so existing
 * code that destructures `MONTHLY_PRICING` / `ANNUAL_PRICING` still
 * compiles.  Values reflect the hardcoded fallback at module-load time
 * but `getPricing()` always reads fresh cache.
 */
export const MONTHLY_PRICING: Record<Tier, number> = getMonthlyPricing();
export const ANNUAL_PRICING: Record<Tier, number> = getAnnualPricing();

/**
 * Get pricing for a specific tier and billing period (USD only).
 * Reads from the in-memory cache (DB-driven).
 */
export function getPricing(
  tier: Tier,
  period: BillingPeriod = 'monthly'
): number {
  const c = cfg();
  return period === 'annual' ? c.tiers[tier].annual : c.tiers[tier].monthly;
}

/** Enterprise tier uses contact-for-pricing; not available via standard checkout. */
export function isEnterpriseTier(tier: Tier): boolean {
  return tier === 'enterprise';
}

/**
 * Get all pricing for a tier (both periods)
 */
export function getAllPricing(tier: Tier): {
  monthly: number;
  annual: number;
} {
  const c = cfg();
  return {
    monthly: c.tiers[tier].monthly,
    annual: c.tiers[tier].annual,
  };
}

/**
 * Calculate annual savings compared to monthly pricing (USD)
 */
export function getAnnualSavings(
  tier: Tier
): {
  monthlyTotal: number;
  annualPrice: number;
  savings: number;
  savingsPercentage: number;
} {
  const c = cfg();
  const monthlyTotal = c.tiers[tier].monthly * 12;
  const annualPrice = c.tiers[tier].annual;
  const savings = monthlyTotal - annualPrice;
  const savingsPercentage = monthlyTotal > 0 ? (savings / monthlyTotal) * 100 : 0;

  return {
    monthlyTotal,
    annualPrice,
    savings,
    savingsPercentage: Math.round(savingsPercentage * 100) / 100,
  };
}

/**
 * Annual discount percentage (vs 12× monthly). Use for subscription.annual_discount.
 */
export function getAnnualDiscountPercent(tier: Tier): number {
  return getAnnualSavings(tier).savingsPercentage;
}

/**
 * Format price for display (USD)
 */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Overage unit pricing — DB-driven via cache.
 */
export type OverageMetricType = 'queries' | 'document_upload' | 'tavily_searches';

export function getOverageUnitPrice(metric: OverageMetricType): number {
  return cfg().overage[metric];
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: Tier): string {
  const names: Record<Tier, string> = {
    free: 'Free',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };
  return names[tier];
}

/**
 * Get tier description
 */
export function getTierDescription(tier: Tier): string {
  const descriptions: Record<Tier, string> = {
    free: 'Basic AI responses with limited queries',
    pro: 'Unlimited access with advanced features and priority support',
    enterprise: 'Teams, SSO, custom limits, and dedicated support',
  };
  return descriptions[tier];
}

/**
 * Check if tier is paid (not free)
 */
export function isPaidTier(tier: Tier): boolean {
  return tier !== 'free';
}

/**
 * Get tier order (for upgrade/downgrade logic)
 */
export function getTierOrder(tier: Tier): number {
  const order: Record<Tier, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  };
  return order[tier];
}

/**
 * Check if tier1 is higher than tier2
 */
export function isHigherTier(tier1: Tier, tier2: Tier): boolean {
  return getTierOrder(tier1) > getTierOrder(tier2);
}

/**
 * Check if tier1 is lower than tier2
 */
export function isLowerTier(tier1: Tier, tier2: Tier): boolean {
  return getTierOrder(tier1) < getTierOrder(tier2);
}

/**
 * Get upgrade options for a tier
 */
export function getUpgradeOptions(currentTier: Tier): Tier[] {
  const allTiers: Tier[] = ['free', 'pro', 'enterprise'];
  const currentOrder = getTierOrder(currentTier);
  return allTiers.filter((tier) => getTierOrder(tier) > currentOrder);
}

/**
 * Get downgrade options for a tier
 */
export function getDowngradeOptions(currentTier: Tier): Tier[] {
  const allTiers: Tier[] = ['free', 'pro', 'enterprise'];
  const currentOrder = getTierOrder(currentTier);
  return allTiers.filter((tier) => getTierOrder(tier) < currentOrder);
}

export default {
  MONTHLY_PRICING,
  ANNUAL_PRICING,
  getMonthlyPricing,
  getAnnualPricing,
  getPricing,
  getAllPricing,
  getAnnualSavings,
  getAnnualDiscountPercent,
  formatPrice,
  getOverageUnitPrice,
  getTierDisplayName,
  getTierDescription,
  isPaidTier,
  isEnterpriseTier,
  getTierOrder,
  isHigherTier,
  isLowerTier,
  getUpgradeOptions,
  getDowngradeOptions,
};
