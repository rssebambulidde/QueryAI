import { Database } from '../types/database';
import logger from '../config/logger';

/**
 * Prorating Service
 * Calculates prorated amounts for mid-period subscription changes
 */
export class ProratingService {
  /**
   * Calculate prorated amount for upgrade/downgrade
   */
  static calculateProratedAmount(
    currentTier: 'free' | 'premium' | 'pro',
    newTier: 'free' | 'premium' | 'pro',
    periodStart: Date,
    periodEnd: Date,
    currentDate: Date = new Date()
  ): {
    proratedAmount: number;
    daysUsed: number;
    daysRemaining: number;
    creditAmount: number;
    chargeAmount: number;
  } {
    const tierPricing: Record<'free' | 'premium' | 'pro', Record<'UGX' | 'USD', number>> = {
      free: { UGX: 0, USD: 0 },
      premium: { UGX: 50000, USD: 15 },
      pro: { UGX: 150000, USD: 45 },
    };

    // Calculate days
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
    const daysUsed = Math.ceil((currentDate.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
    const daysRemaining = totalDays - daysUsed;

    // Calculate amounts (using UGX as default, can be adjusted)
    const currentMonthlyPrice = tierPricing[currentTier].UGX;
    const newMonthlyPrice = tierPricing[newTier].UGX;

    // Calculate daily rates
    const currentDailyRate = currentMonthlyPrice / totalDays;
    const newDailyRate = newMonthlyPrice / totalDays;

    // Credit for unused portion of current tier
    const creditAmount = currentDailyRate * daysRemaining;

    // Charge for remaining portion of new tier
    const chargeAmount = newDailyRate * daysRemaining;

    // Net amount to charge (could be negative for downgrades)
    const proratedAmount = chargeAmount - creditAmount;

    return {
      proratedAmount: Math.max(0, proratedAmount), // Don't charge negative amounts
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
   * Get prorated pricing for tier change
   */
  static getProratedPricing(
    fromTier: 'free' | 'premium' | 'pro',
    toTier: 'free' | 'premium' | 'pro',
    subscription: Database.Subscription,
    currency: 'UGX' | 'USD' = 'UGX'
  ): {
    currentTierPrice: number;
    newTierPrice: number;
    proratedAmount: number;
    daysRemaining: number;
    creditAmount: number;
    chargeAmount: number;
  } {
    if (!subscription.current_period_start || !subscription.current_period_end) {
      // No period set, return full price
      const tierPricing: Record<'free' | 'premium' | 'pro', Record<'UGX' | 'USD', number>> = {
        free: { UGX: 0, USD: 0 },
        premium: { UGX: 50000, USD: 15 },
        pro: { UGX: 150000, USD: 45 },
      };

      return {
        currentTierPrice: tierPricing[fromTier][currency],
        newTierPrice: tierPricing[toTier][currency],
        proratedAmount: tierPricing[toTier][currency],
        daysRemaining: 30,
        creditAmount: 0,
        chargeAmount: tierPricing[toTier][currency],
      };
    }

    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();

    const prorated = this.calculateProratedAmount(fromTier, toTier, periodStart, periodEnd, now);

    const tierPricing: Record<'free' | 'premium' | 'pro', Record<'UGX' | 'USD', number>> = {
      free: { UGX: 0, USD: 0 },
      premium: { UGX: 50000, USD: 15 },
      pro: { UGX: 150000, USD: 45 },
    };

    return {
      currentTierPrice: tierPricing[fromTier][currency],
      newTierPrice: tierPricing[toTier][currency],
      proratedAmount: prorated.proratedAmount,
      daysRemaining: prorated.daysRemaining,
      creditAmount: prorated.creditAmount,
      chargeAmount: prorated.chargeAmount,
    };
  }
}
