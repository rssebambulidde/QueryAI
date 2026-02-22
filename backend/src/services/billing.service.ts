import { DatabaseService } from './database.service';
import { OverageService } from './overage.service';
import type { Database } from '../types/database';
import logger from '../config/logger';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceLineItems {
  /** Subscription/base line. Null when payment is overage-only. */
  base: { description: string; amount: number } | null;
  /** Overage line items when payment has linked overage records. */
  overage: { lines: InvoiceLineItem[]; total: number } | null;
  total: number;
}

/**
 * Billing Service
 * Overage billing, invoice line items, and overage payment creation.
 */
export class BillingService {
  /**
   * Compute and store overage for a user in a period. Idempotent.
   */
  static async computeAndStoreOverage(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    currency: string = 'USD'
  ): Promise<{ totalCharged: number; currency: string; recordCount: number }> {
    const sub = await DatabaseService.getUserSubscription(userId);
    const summary = await OverageService.computeOverageForPeriod(userId, periodStart, periodEnd, {
      currency,
      subscriptionId: sub?.id,
    });
    return {
      totalCharged: summary.totalCharged,
      currency: summary.currency,
      recordCount: summary.records.length,
    };
  }

  /**
   * Create an overage payment record, link overage_records to it, and return the payment.
   * Computes overage first. If no overage, returns null.
   */
  static async createOveragePayment(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    currency: string = 'USD'
  ): Promise<Database.Payment | null> {
    const sub = await DatabaseService.getUserSubscription(userId);
    if (!sub) {
      logger.warn('createOveragePayment: no subscription', { userId });
      return null;
    }

    const summary = await OverageService.computeOverageForPeriod(userId, periodStart, periodEnd, {
      currency,
      subscriptionId: sub.id,
    });

    if (summary.totalCharged <= 0 || summary.records.length === 0) {
      return null;
    }

    const ps = periodStart.toISOString().slice(0, 10);
    const pe = periodEnd.toISOString().slice(0, 10);
    const parts = summary.records.map(
      (r) => `${r.metric_type}: ${r.overage_units} × ${r.currency} ${Number(r.unit_price).toFixed(4)}`
    );
    const paymentDescription = `QueryAI overage charges ${ps}–${pe} (${parts.join('; ')})`;

    const payment = await DatabaseService.createPayment({
      user_id: userId,
      subscription_id: sub.id,
      payment_provider: 'paypal',
      tier: sub.tier as 'free' | 'pro',
      amount: summary.totalCharged,
      currency: summary.currency,
      status: 'pending',
      payment_description: paymentDescription,
    });

    const linked = await OverageService.linkOverageToPayment(
      userId,
      summary.periodStart,
      summary.periodEnd,
      payment.id
    );
    if (!linked) {
      logger.error('createOveragePayment: failed to link overage to payment', { paymentId: payment.id });
    }

    return payment;
  }

  /**
   * Get invoice line items for a payment. Includes overage breakdown when payment has linked overage records.
   * Overage-only payments have base = null and only overage lines.
   */
  static async getInvoiceLineItems(payment: Database.Payment): Promise<InvoiceLineItems> {
    const overageRecords = await OverageService.getOverageByPaymentId(payment.id);
    let base: { description: string; amount: number } | null = null;
    let overage: { lines: InvoiceLineItem[]; total: number } | null = null;

    if (overageRecords.length > 0) {
      const lines: InvoiceLineItem[] = overageRecords.map((r) => ({
        description: `Overage: ${r.metric_type} (${r.overage_units} units)`,
        quantity: r.overage_units,
        unitPrice: Number(r.unit_price),
        amount: Number(r.amount_charged),
      }));
      const overageTotal = lines.reduce((s, l) => s + l.amount, 0);
      overage = { lines, total: overageTotal };
    }

    const baseAmount = Number(payment.amount);
    const baseDesc = payment.payment_description || `QueryAI ${payment.tier} subscription`;
    if (overage && Math.abs(baseAmount - overage.total) < 0.01) {
      base = null;
    } else {
      base = { description: baseDesc, amount: baseAmount };
    }

    const total = base && overage ? base.amount + overage.total : overage ? overage.total : baseAmount;
    return { base, overage, total };
  }
}
