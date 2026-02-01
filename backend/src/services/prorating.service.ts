import { Database } from '../types/database';
import { getPricing } from '../constants/pricing';
import type { BillingPeriod, Tier } from '../constants/pricing';

/**
 * Prorating Service
 * Calculates prorated amounts for mid-period subscription changes (tier and/or billing period).
 */
export class ProratingService {
  /**
   * Calculate prorated amount for upgrade/downgrade or period change.
   * Uses getPricing(tier, currency, period) when periods are provided.
   */
  static calculateProratedAmount(
    currentTier: Tier,
    newTier: Tier,
    periodStart: Date,
    periodEnd: Date,
    currentDate: Date = new Date(),
    currency: 'UGX' | 'USD' = 'UGX',
    currentBillingPeriod: BillingPeriod = 'monthly',
    newBillingPeriod: BillingPeriod = 'monthly'
  ): {
    proratedAmount: number;
    daysUsed: number;
    daysRemaining: number;
    creditAmount: number;
    chargeAmount: number;
  } {
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
    const daysUsed = Math.ceil((currentDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
    const daysRemaining = Math.max(0, totalDays - daysUsed);

    const currentPrice = getPricing(currentTier, currency, currentBillingPeriod);
    const newPrice = getPricing(newTier, currency, newBillingPeriod);

    const currentDailyRate = totalDays > 0 ? currentPrice / totalDays : 0;
    const newDailyRate = totalDays > 0 ? newPrice / totalDays : 0;

    const creditAmount = currentDailyRate * daysRemaining;
    const chargeAmount = newDailyRate * daysRemaining;
    const proratedAmount = chargeAmount - creditAmount;

    return {
      proratedAmount: Math.max(0, proratedAmount),
      daysUsed,
      daysRemaining,
      creditAmount,
      chargeAmount,
    };
  }

  /**
   * Calculate prorated period end date
   * When upgrading/downgrading mid-period, adjust the period end
   */
  static calculateProratedPeriodEnd(
    currentPeriodEnd: Date,
    daysRemaining: number
  ): Date {
    const newPeriodEnd = new Date(currentPeriodEnd);
    // Keep the same period end, but prorate the amount
    // Alternatively, could extend period by remaining days
    return newPeriodEnd;
  }

  /**
   * Get prorated pricing for tier and/or billing-period change.
   * @param toBillingPeriod - Optional. Target period when switching monthly ↔ annual; defaults to subscription.billing_period.
   */
  static getProratedPricing(
    fromTier: Tier,
    toTier: Tier,
    subscription: Database.Subscription,
    currency: 'UGX' | 'USD' = 'UGX',
    toBillingPeriod?: BillingPeriod
  ): {
    currentTierPrice: number;
    newTierPrice: number;
    proratedAmount: number;
    daysRemaining: number;
    creditAmount: number;
    chargeAmount: number;
  } {
    const sub = subscription as Database.Subscription & { billing_period?: BillingPeriod };
    const currentPeriod: BillingPeriod = sub.billing_period ?? 'monthly';
    const newPeriod: BillingPeriod = toBillingPeriod ?? currentPeriod;

    const currentPrice = getPricing(fromTier, currency, currentPeriod);
    const newPrice = getPricing(toTier, currency, newPeriod);

    if (!subscription.current_period_start || !subscription.current_period_end) {
      return {
        currentTierPrice: currentPrice,
        newTierPrice: newPrice,
        proratedAmount: newPrice,
        daysRemaining: 30,
        creditAmount: 0,
        chargeAmount: newPrice,
      };
    }

    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();

    const prorated = this.calculateProratedAmount(
      fromTier,
      toTier,
      periodStart,
      periodEnd,
      now,
      currency,
      currentPeriod,
      newPeriod
    );

    return {
      currentTierPrice: currentPrice,
      newTierPrice: newPrice,
      proratedAmount: prorated.proratedAmount,
      daysRemaining: prorated.daysRemaining,
      creditAmount: prorated.creditAmount,
      chargeAmount: prorated.chargeAmount,
    };
  }
}
