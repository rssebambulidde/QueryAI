import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { BillingService } from '../services/billing.service';
import { OverageService } from '../services/overage.service';
import * as PayPalService from '../services/paypal.service';
import { DatabaseService } from '../services/database.service';
import config from '../config/env';
import logger from '../config/logger';

const router = Router();

function getBaseUrl(): string {
  let baseUrl = config.API_BASE_URL;
  if (!baseUrl || baseUrl.includes('localhost')) {
    if (config.NODE_ENV === 'production') {
      baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : config.BACKEND_FALLBACK_URL || config.API_BASE_URL;
    } else {
      baseUrl = 'http://localhost:3001';
    }
  }
  return baseUrl.replace(/\/$/, '');
}

/**
 * GET /api/billing/overage
 * Get overage summary for a period. Defaults to current calendar month.
 * Query: periodStart, periodEnd (ISO), currency (USD|UGX).
 */
router.get(
  '/overage',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { periodStart: ps, periodEnd: pe, currency } = req.query;

    let periodStart: Date;
    let periodEnd: Date;
    if (ps && pe && typeof ps === 'string' && typeof pe === 'string') {
      periodStart = new Date(ps);
      periodEnd = new Date(pe);
      if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
        throw new ValidationError('Invalid periodStart or periodEnd');
      }
    } else {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);
    }

    const curr = (currency === 'UGX' ? 'UGX' : 'USD') as 'UGX' | 'USD';
    const summary = await OverageService.computeOverageForPeriod(userId, periodStart, periodEnd, {
      currency: curr,
    });

    return res.status(200).json({
      success: true,
      data: {
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
        currency: summary.currency,
        totalCharged: summary.totalCharged,
        records: summary.records.map((r) => ({
          metric_type: r.metric_type,
          limit_value: r.limit_value,
          usage_value: r.usage_value,
          overage_units: r.overage_units,
          unit_price: Number(r.unit_price),
          amount_charged: Number(r.amount_charged),
        })),
      },
    });
  })
);

/**
 * POST /api/billing/overage/initiate
 * Create overage payment, create PayPal order, return redirect URL to complete payment.
 * Body: periodStart, periodEnd (ISO), currency (USD|UGX).
 */
router.post(
  '/overage/initiate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { periodStart: ps, periodEnd: pe, currency } = req.body;

    if (!ps || !pe || typeof ps !== 'string' || typeof pe !== 'string') {
      throw new ValidationError('periodStart and periodEnd (ISO) required');
    }
    const periodStart = new Date(ps);
    const periodEnd = new Date(pe);
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      throw new ValidationError('Invalid periodStart or periodEnd');
    }

    const curr = (currency === 'UGX' ? 'UGX' : 'USD') as 'UGX' | 'USD';
    const payment = await BillingService.createOveragePayment(userId, periodStart, periodEnd, curr);
    if (!payment) {
      return res.status(200).json({
        success: true,
        data: { noOverage: true, message: 'No overage charges for this period' },
      });
    }

    const baseUrl = getBaseUrl();
    const returnUrl = `${baseUrl}/api/payment/callback`;
    const cancelUrl = `${baseUrl}/api/payment/cancel`;

    const orderResponse = await PayPalService.createPayment({
      amount: Number(payment.amount),
      currency: payment.currency,
      description: payment.payment_description || 'QueryAI overage charges',
      custom_id: userId,
      returnUrl,
      cancelUrl,
    });

    await DatabaseService.updatePayment(payment.id, {
      paypal_order_id: orderResponse.orderId,
      updated_at: new Date().toISOString(),
    });

    logger.info('Overage payment initiated', {
      userId,
      paymentId: payment.id,
      orderId: orderResponse.orderId,
    });

    return res.status(200).json({
      success: true,
      data: {
        payment_id: payment.id,
        redirect_url: orderResponse.approvalUrl,
        order_id: orderResponse.orderId,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  })
);

export default router;
