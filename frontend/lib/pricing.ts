/**
 * Frontend pricing helpers. Must match backend constants/pricing.ts.
 */

export type Tier = 'free' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';

const MONTHLY: Record<Tier, number> = {
  free: 0,
  pro: 45,
  enterprise: 99,
};

const ANNUAL: Record<Tier, number> = {
  free: 0,
  pro: 450,
  enterprise: 999,
};

export function getPricing(
  tier: Tier,
  period: BillingPeriod = 'monthly'
): number {
  return period === 'annual' ? ANNUAL[tier] : MONTHLY[tier];
}

export function getAnnualSavings(
  tier: Tier
): { monthlyTotal: number; annualPrice: number; savings: number; savingsPercentage: number } {
  const monthlyTotal = MONTHLY[tier] * 12;
  const annualPrice = ANNUAL[tier];
  const savings = monthlyTotal - annualPrice;
  const savingsPercentage = monthlyTotal > 0 ? (savings / monthlyTotal) * 100 : 0;
  return {
    monthlyTotal,
    annualPrice,
    savings,
    savingsPercentage: Math.round(savingsPercentage * 100) / 100,
  };
}

export function isEnterpriseTier(tier: Tier): boolean {
  return tier === 'enterprise';
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
