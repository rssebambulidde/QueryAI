/**
 * Pricing Constants
 * Centralized pricing configuration for all subscription tiers
 */

export type Tier = 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
export type Currency = 'UGX' | 'USD';
export type BillingPeriod = 'monthly' | 'annual';

/**
 * Monthly pricing for each tier in different currencies.
 */
export const MONTHLY_PRICING: Record<Tier, Record<Currency, number>> = {
  free: { UGX: 0, USD: 0 },
  starter: { UGX: 27000, USD: 9 },
  premium: { UGX: 50000, USD: 15 },
  pro: { UGX: 150000, USD: 45 },
  enterprise: { UGX: 300000, USD: 99 }, // Fixed pricing for self-enrollment
};

/**
 * Annual pricing for each tier in different currencies.
 * Enterprise is contact-for-pricing (0).
 */
export const ANNUAL_PRICING: Record<Tier, Record<Currency, number>> = {
  free: { UGX: 0, USD: 0 },
  starter: { UGX: 270000, USD: 90 },
  premium: { UGX: 500000, USD: 150 },
  pro: { UGX: 1500000, USD: 450 },
  enterprise: { UGX: 0, USD: 0 }, // Contact for pricing
};

/**
 * Get pricing for a specific tier, currency, and billing period
 */
export function getPricing(
  tier: Tier,
  currency: Currency = 'UGX',
  period: BillingPeriod = 'monthly'
): number {
  return period === 'annual' ? ANNUAL_PRICING[tier][currency] : MONTHLY_PRICING[tier][currency];
}

/** Enterprise tier uses contact-for-pricing; not available via standard checkout. */
export function isEnterpriseTier(tier: Tier): boolean {
  return tier === 'enterprise';
}

/**
 * Get all pricing for a tier (both currencies and periods)
 */
export function getAllPricing(tier: Tier): {
  monthly: Record<Currency, number>;
  annual: Record<Currency, number>;
} {
  return {
    monthly: MONTHLY_PRICING[tier],
    annual: ANNUAL_PRICING[tier],
  };
}

/**
 * Calculate annual savings compared to monthly pricing
 */
export function getAnnualSavings(
  tier: Tier,
  currency: Currency = 'UGX'
): {
  monthlyTotal: number;
  annualPrice: number;
  savings: number;
  savingsPercentage: number;
} {
  const monthlyTotal = MONTHLY_PRICING[tier][currency] * 12;
  const annualPrice = ANNUAL_PRICING[tier][currency];
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
export function getAnnualDiscountPercent(tier: Tier, currency: Currency = 'UGX'): number {
  return getAnnualSavings(tier, currency).savingsPercentage;
}

/**
 * Format price for display
 */
export function formatPrice(
  amount: number,
  currency: Currency = 'UGX'
): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  // UGX formatting (no decimals)
  return `${amount.toLocaleString('en-US')} UGX`;
}

/**
 * Overage unit pricing (per query, per document upload, per Tavily search) when usage exceeds tier limits.
 * Used for usage-based overage billing.
 */
export type OverageMetricType = 'queries' | 'document_upload' | 'tavily_searches';

export const OVERAGE_UNIT_PRICING: Record<OverageMetricType, Record<Currency, number>> = {
  queries: { UGX: 100, USD: 0.05 },
  document_upload: { UGX: 2000, USD: 0.50 },
  tavily_searches: { UGX: 500, USD: 0.10 },
};

export function getOverageUnitPrice(metric: OverageMetricType, currency: Currency = 'USD'): number {
  return OVERAGE_UNIT_PRICING[metric][currency];
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: Tier): string {
  const names: Record<Tier, string> = {
    free: 'Free',
    starter: 'Starter',
    premium: 'Premium',
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
    starter: 'Perfect for getting started with AI-powered queries',
    premium: 'Enhanced features with document uploads and topics',
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
    starter: 1,
    premium: 2,
    pro: 3,
    enterprise: 4,
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
  const allTiers: Tier[] = ['free', 'starter', 'premium', 'pro', 'enterprise'];
  const currentOrder = getTierOrder(currentTier);
  return allTiers.filter((tier) => getTierOrder(tier) > currentOrder);
}

/**
 * Get downgrade options for a tier
 */
export function getDowngradeOptions(currentTier: Tier): Tier[] {
  const allTiers: Tier[] = ['free', 'starter', 'premium', 'pro', 'enterprise'];
  const currentOrder = getTierOrder(currentTier);
  return allTiers.filter((tier) => getTierOrder(tier) < currentOrder);
}

export default {
  MONTHLY_PRICING,
  ANNUAL_PRICING,
  getPricing,
  getAllPricing,
  getAnnualSavings,
  getAnnualDiscountPercent,
  formatPrice,
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
