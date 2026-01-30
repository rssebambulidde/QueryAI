/**
 * Frontend pricing helpers. Must match backend constants/pricing.ts.
 */

export type Tier = 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
export type Currency = 'UGX' | 'USD';
export type BillingPeriod = 'monthly' | 'annual';

const MONTHLY: Record<Tier, Record<Currency, number>> = {
  free: { UGX: 0, USD: 0 },
  starter: { UGX: 27000, USD: 9 },
  premium: { UGX: 50000, USD: 15 },
  pro: { UGX: 150000, USD: 45 },
  enterprise: { UGX: 0, USD: 0 },
};

const ANNUAL: Record<Tier, Record<Currency, number>> = {
  free: { UGX: 0, USD: 0 },
  starter: { UGX: 270000, USD: 90 },
  premium: { UGX: 500000, USD: 150 },
  pro: { UGX: 1500000, USD: 450 },
  enterprise: { UGX: 0, USD: 0 },
};

export function getPricing(
  tier: Tier,
  currency: Currency,
  period: BillingPeriod = 'monthly'
): number {
  if (tier === 'enterprise') return 0;
  return period === 'annual' ? ANNUAL[tier][currency] : MONTHLY[tier][currency];
}

export function getAnnualSavings(
  tier: Tier,
  currency: Currency
): { monthlyTotal: number; annualPrice: number; savings: number; savingsPercentage: number } {
  if (tier === 'enterprise')
    return { monthlyTotal: 0, annualPrice: 0, savings: 0, savingsPercentage: 0 };
  const monthlyTotal = MONTHLY[tier][currency] * 12;
  const annualPrice = ANNUAL[tier][currency];
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

export function formatPrice(amount: number, currency: Currency): string {
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  return `${amount.toLocaleString('en-US')} UGX`;
}
