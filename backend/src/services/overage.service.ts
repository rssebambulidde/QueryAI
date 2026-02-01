import { supabaseAdmin } from '../config/database';
import { DatabaseService } from './database.service';
import { SubscriptionService, TIER_LIMITS } from './subscription.service';
import { getOverageUnitPrice } from '../constants/pricing';
import type { Currency } from '../constants/pricing';
import type { Database } from '../types/database';
import logger from '../config/logger';

export interface OverageSummary {
  records: Database.OverageRecord[];
  totalCharged: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Overage Service
 * Computes and stores usage beyond tier limits; calculates overage charges.
 */
export class OverageService {
  /**
   * Compute overage for a user in a given period, persist to overage_records, and return summary.
   * Uses calendar month period (aligned with usage stats). Idempotent per (user, period, metric).
   */
  static async computeOverageForPeriod(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    options: { currency?: Currency; subscriptionId?: string } = {}
  ): Promise<OverageSummary> {
    const currency = (options.currency ?? 'USD') as Currency;
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      return { records: [], totalCharged: 0, currency, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
    }

    const tier = subscription.tier;
    const limits = TIER_LIMITS[tier];

    const [queriesUsed, documentUploadsUsed, tavilyUsed] = await Promise.all([
      DatabaseService.getUserUsageCount(userId, 'query', periodStart, periodEnd),
      DatabaseService.getUserUsageCount(userId, 'document_upload', periodStart, periodEnd),
      SubscriptionService.getTavilyUsageCount(userId, periodStart, periodEnd),
    ]);

    const records: Database.OverageRecord[] = [];
    let totalCharged = 0;

    const ps = periodStart.toISOString();
    const pe = periodEnd.toISOString();
    const subId = options.subscriptionId ?? subscription.id ?? null;

    // Queries overage
    const qLimit = limits.queriesPerMonth;
    if (qLimit != null && queriesUsed > qLimit) {
      const overageUnits = queriesUsed - qLimit;
      const unitPrice = getOverageUnitPrice('queries', currency);
      const amount = Math.round(overageUnits * unitPrice * 100) / 100;
      const row = await this.upsertOverageRecord({
        user_id: userId,
        subscription_id: subId,
        period_start: ps,
        period_end: pe,
        metric_type: 'queries',
        limit_value: qLimit,
        usage_value: queriesUsed,
        overage_units: overageUnits,
        tier,
        currency,
        unit_price: unitPrice,
        amount_charged: amount,
      });
      if (row) records.push(row);
      totalCharged += amount;
    }

    // Document upload overage
    const dLimit = limits.documentUploads;
    if (dLimit != null && documentUploadsUsed > dLimit) {
      const overageUnits = documentUploadsUsed - dLimit;
      const unitPrice = getOverageUnitPrice('document_upload', currency);
      const amount = Math.round(overageUnits * unitPrice * 100) / 100;
      const row = await this.upsertOverageRecord({
        user_id: userId,
        subscription_id: subId,
        period_start: ps,
        period_end: pe,
        metric_type: 'document_upload',
        limit_value: dLimit,
        usage_value: documentUploadsUsed,
        overage_units: overageUnits,
        tier,
        currency,
        unit_price: unitPrice,
        amount_charged: amount,
      });
      if (row) records.push(row);
      totalCharged += amount;
    }

    // Tavily overage
    const tLimit = limits.tavilySearchesPerMonth;
    if (tLimit != null && tavilyUsed > tLimit) {
      const overageUnits = tavilyUsed - tLimit;
      const unitPrice = getOverageUnitPrice('tavily_searches', currency);
      const amount = Math.round(overageUnits * unitPrice * 100) / 100;
      const row = await this.upsertOverageRecord({
        user_id: userId,
        subscription_id: subId,
        period_start: ps,
        period_end: pe,
        metric_type: 'tavily_searches',
        limit_value: tLimit,
        usage_value: tavilyUsed,
        overage_units: overageUnits,
        tier,
        currency,
        unit_price: unitPrice,
        amount_charged: amount,
      });
      if (row) records.push(row);
      totalCharged += amount;
    }

    totalCharged = Math.round(totalCharged * 100) / 100;
    return { records, totalCharged, currency, periodStart: ps, periodEnd: pe };
  }

  private static async upsertOverageRecord(
    r: Omit<Database.OverageRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Database.OverageRecord | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('overage_records')
        .upsert(
          {
            user_id: r.user_id,
            subscription_id: r.subscription_id ?? null,
            period_start: r.period_start,
            period_end: r.period_end,
            metric_type: r.metric_type,
            limit_value: r.limit_value,
            usage_value: r.usage_value,
            overage_units: r.overage_units,
            tier: r.tier,
            currency: r.currency,
            unit_price: r.unit_price,
            amount_charged: r.amount_charged,
            payment_id: r.payment_id ?? null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,period_start,period_end,metric_type',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        logger.error('Overage upsert failed', { error, user_id: r.user_id, metric_type: r.metric_type });
        return null;
      }
      return data as Database.OverageRecord;
    } catch (e) {
      logger.error('Overage upsert error', { err: e, user_id: r.user_id, metric_type: r.metric_type });
      return null;
    }
  }

  /**
   * Fetch overage records for a user in a period. Does not compute; use computeOverageForPeriod to (re)compute.
   */
  static async getOverageForPeriod(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<OverageSummary> {
    const ps = periodStart.toISOString();
    const pe = periodEnd.toISOString();
    const { data, error } = await supabaseAdmin
      .from('overage_records')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', ps)
      .eq('period_end', pe)
      .order('metric_type');

    if (error) {
      logger.error('Failed to fetch overage records', { error, userId, ps, pe });
      return { records: [], totalCharged: 0, currency: 'USD', periodStart: ps, periodEnd: pe };
    }

    const records = (data ?? []) as Database.OverageRecord[];
    const totalCharged = records.reduce((s, r) => s + Number(r.amount_charged), 0);
    const currency = records[0]?.currency ?? 'USD';
    return { records, totalCharged, currency, periodStart: ps, periodEnd: pe };
  }

  /**
   * Get total overage charges for a user in a period (from stored records). Run computeOverageForPeriod first if needed.
   */
  static async getOverageCharges(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ total: number; currency: string }> {
    const summary = await this.getOverageForPeriod(userId, periodStart, periodEnd);
    return { total: summary.totalCharged, currency: summary.currency };
  }

  /**
   * Fetch overage records linked to a payment (for invoice line items).
   */
  static async getOverageByPaymentId(paymentId: string): Promise<Database.OverageRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('overage_records')
      .select('*')
      .eq('payment_id', paymentId)
      .order('metric_type');
    if (error) {
      logger.error('Failed to fetch overage by payment_id', { error, paymentId });
      return [];
    }
    return (data ?? []) as Database.OverageRecord[];
  }

  /**
   * Link overage records for a period to a payment (e.g. after overage invoice is paid).
   */
  static async linkOverageToPayment(
    userId: string,
    periodStart: string,
    periodEnd: string,
    paymentId: string
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('overage_records')
      .update({ payment_id: paymentId, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd);

    if (error) {
      logger.error('Failed to link overage to payment', { error, userId, paymentId });
      return false;
    }
    return true;
  }
}
