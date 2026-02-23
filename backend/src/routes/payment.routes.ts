import { Router, Request, Response } from 'express';
import * as PayPalService from '../services/paypal.service';
import { DatabaseService } from '../services/database.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validate';
import { ValidationError } from '../types/error';
import { PaymentInitiateSchema, PaymentRefundSchema } from '../schemas/payment.schema';
import { webhookLimiter } from '../middleware/rateLimiter';
import logger from '../config/logger';
import config from '../config/env';
import type { Database } from '../types/database';
import type { Tier } from '../constants/pricing';

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

function getFrontendUrl(): string {
  const isProduction =
    config.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    !!process.env.RAILWAY_PUBLIC_DOMAIN;
  let frontendUrl = config.FRONTEND_URL || process.env.FRONTEND_URL;
  if (!frontendUrl || frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
    frontendUrl = isProduction
      ? (config.FRONTEND_FALLBACK_URL || 'http://localhost:3000')
      : 'http://localhost:3000';
  }
  return frontendUrl;
}

function mapPayPalOrderStatusToPaymentStatus(
  status: string
): 'pending' | 'completed' | 'failed' | 'cancelled' {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'APPROVED') return 'completed';
  if (s === 'VOIDED' || s === 'CANCELLED') return 'cancelled';
  if (s === 'DECLINED' || s === 'FAILED') return 'failed';
  return 'pending';
}

/**
 * Extract locked-price + promo data from payment callback_data.
 * Returns undefined when no lock data is present (backward-compatible).
 */
function extractPriceLock(callbackData: unknown): {
  locked_price_monthly?: number;
  locked_price_annual?: number;
  promo_code_id?: string;
  promo_discount_percent?: number;
} | undefined {
  if (!callbackData || typeof callbackData !== 'object') return undefined;
  const d = callbackData as Record<string, unknown>;
  if (d.locked_price_monthly == null && d.locked_price_annual == null) return undefined;
  return {
    locked_price_monthly: typeof d.locked_price_monthly === 'number' ? d.locked_price_monthly : undefined,
    locked_price_annual: typeof d.locked_price_annual === 'number' ? d.locked_price_annual : undefined,
    promo_code_id: typeof d.promo_code_id === 'string' ? d.promo_code_id : undefined,
    promo_discount_percent: typeof d.promo_discount_percent === 'number' ? d.promo_discount_percent : undefined,
  };
}

/**
 * POST /api/payment/initiate
 * Initiate a PayPal payment for subscription upgrade (account or card via PayPal)
 */
router.post(
  '/initiate',
  validateRequest(PaymentInitiateSchema),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Log incoming request for debugging
    logger.info('Payment initiate request received', {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'present' : 'missing',
      },
      path: req.path,
      method: req.method,
    });

    const userId = req.user?.id;
    if (!userId) {
      logger.error('Payment initiate: User not authenticated', { userId: req.user });
      throw new ValidationError('User not authenticated');
    }

    const { tier, firstName, lastName, email, recurring, billing_period: bp, return_url, prefer_card, promo_code } = req.body;
    
    logger.info('Payment initiate: Parsed request body', {
      userId,
      tier,
      firstName: firstName ? 'provided' : 'missing',
      lastName: lastName ? 'provided' : 'missing',
      email: email ? 'provided' : 'missing',
      recurring,
      billing_period: bp,
      currency: req.body.currency,
      return_url: return_url ? 'provided' : 'missing',
      promo_code: promo_code ? 'provided' : 'none',
    });

    const billingPeriod = (bp === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual';

    const [userProfile, subscription] = await Promise.all([
      DatabaseService.getUserProfile(userId),
      DatabaseService.getUserSubscription(userId),
    ]);
    if (!userProfile) {
      throw new ValidationError('User profile not found');
    }

    const normalizedCurrency = 'USD' as const;

    const { getPricing, getAllPricing } = await import('../constants/pricing');
    const catalogAmount = getPricing(
      tier as Tier,
      billingPeriod
    );

    // Lock both prices at purchase time (9.6.2 — grace period)
    const allPrices = getAllPricing(tier as Tier);
    const lockedPriceMonthly = allPrices.monthly;
    const lockedPriceAnnual = allPrices.annual;

    // Apply promo code if provided (9.6.3)
    let amount = catalogAmount;
    let promoCodeId: string | null = null;
    let promoDiscountPercent: number | null = null;
    let promoDiscountAmount = 0;

    if (promo_code) {
      const { PromoCodeService } = await import('../services/promo-code.service');
      const validation = await PromoCodeService.validate(
        promo_code,
        userId,
        tier,
        billingPeriod,
        catalogAmount,
      );

      if (!validation.valid) {
        throw new ValidationError(validation.reason);
      }

      amount = validation.discountedAmount;
      promoCodeId = validation.promo.id;
      promoDiscountPercent = validation.discountPercent;
      promoDiscountAmount = catalogAmount - amount;

      logger.info('Promo code applied', {
        userId,
        promoCode: promo_code,
        promoCodeId,
        discountPercent: promoDiscountPercent,
        originalAmount: catalogAmount,
        discountedAmount: amount,
      });
    }
    
    // Validate amount is greater than 0
    if (amount <= 0) {
      logger.error('Invalid payment amount', { tier, currency: normalizedCurrency, billingPeriod, amount });
      throw new ValidationError(`Invalid payment amount for tier "${tier}". Please contact support.`);
    }

    // Duplicate payment prevention — reject if user has a pending payment for the same tier
    const recentPayments = await DatabaseService.getUserPayments(userId, 20);
    const pendingForTier = recentPayments.filter(
      (p) => p.status === 'pending' && p.tier === tier
    );

    // Auto-cancel stale pending payments (>30 minutes old)
    const STALE_THRESHOLD_MS = 30 * 60 * 1000;
    for (const p of pendingForTier) {
      const age = Date.now() - new Date(p.created_at).getTime();
      if (age > STALE_THRESHOLD_MS) {
        await DatabaseService.updatePayment(p.id, { status: 'cancelled' });
        logger.info('Auto-cancelled stale pending payment', { paymentId: p.id, ageMinutes: Math.round(age / 60000) });
      }
    }

    // Re-check for remaining (recent) pending payments
    const activePending = pendingForTier.filter(
      (p) => Date.now() - new Date(p.created_at).getTime() <= STALE_THRESHOLD_MS
    );
    if (activePending.length > 0) {
      const pendingId = activePending[0].id;
      const err = new ValidationError(
        'You already have a recent pending payment for this tier. Cancel it or wait for it to complete before starting a new one.'
      );
      // Attach payment ID so the frontend can offer to cancel it
      (err as unknown as Record<string, unknown>).pendingPaymentId = pendingId;
      throw err;
    }
    
    logger.info('Payment initiation request', {
      userId,
      tier,
      currency: normalizedCurrency,
      billingPeriod,
      amount,
      catalogAmount,
      promoCodeId,
      recurring,
      firstName: firstName ? 'provided' : 'missing',
      lastName: lastName ? 'provided' : 'missing',
      email: email ? 'provided' : 'missing',
    });

    // Build callback_data with locked prices + promo info for activation
    const priceLockData = {
      locked_price_monthly: lockedPriceMonthly,
      locked_price_annual: lockedPriceAnnual,
      ...(promoCodeId && {
        promo_code_id: promoCodeId,
        promo_discount_percent: promoDiscountPercent,
        promo_discount_amount: promoDiscountAmount,
        catalog_amount: catalogAmount,
      }),
    };

    const baseUrl = getBaseUrl();
    const returnUrl = `${baseUrl}/api/payment/callback`;
    const cancelUrl = `${baseUrl}/api/payment/cancel`;

    logger.info('PayPal payment URLs configured', {
      baseUrl,
      returnUrl,
      cancelUrl,
      recurring: !!recurring,
      nodeEnv: config.NODE_ENV,
    });

    if (recurring) {
      // Recurring: PayPal Subscriptions (plan-based billing)
      // Note: PayPal Subscriptions API does NOT support guest checkout - requires PayPal account
      let subscriptionResponse;
      try {
        subscriptionResponse = await PayPalService.createSubscription({
          tier: tier as 'pro' | 'enterprise',
          returnUrl,
          cancelUrl,
          customId: userId,
          billing_period: billingPeriod,
        });
      } catch (subError: unknown) {
        const err = subError as { statusCode?: number; message?: string; result?: { details?: { description?: string }[] }; body?: unknown };
        const detailMsg = err.result?.details?.[0]?.description || err.message;
        logger.error('PayPal create subscription failed', {
          userId,
          tier,
          billingPeriod,
          error: detailMsg,
          statusCode: err.statusCode,
        });
        // Surface actual error instead of generic Internal server error
        throw new ValidationError(
          detailMsg || 'Failed to create recurring subscription. Please verify PayPal plan IDs are configured and try one-time payment if recurring fails.'
        );
      }

      const payment = await DatabaseService.createPayment({
        user_id: userId,
        subscription_id: subscription?.id,
        payment_provider: 'paypal',
        paypal_subscription_id: subscriptionResponse.subscriptionId,
        tier,
        amount,
        currency: normalizedCurrency,
        status: 'pending',
        payment_description: `QueryAI ${tier} subscription (${billingPeriod}, recurring)`,
        callback_data: { 
          billing_period: billingPeriod,
          return_url: return_url || undefined,
          ...priceLockData,
        },
      });

      logger.info('PayPal recurring subscription initiated', {
        userId,
        tier,
        paymentId: payment.id,
        subscriptionId: subscriptionResponse.subscriptionId,
      });

      return res.status(200).json({
        success: true,
        data: {
          payment: {
            id: payment.id,
            tier: payment.tier,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            billing_period: billingPeriod,
          },
          redirect_url: subscriptionResponse.approvalUrl,
          subscription_id: subscriptionResponse.subscriptionId,
          recurring: true,
          billing_period: billingPeriod,
        },
      });
    }

    // One-time: PayPal Orders (capture after approval)
    // Note: Card payments are automatically enabled when userAction: 'PAY_NOW' is set in createPayment
    logger.info('Creating PayPal order for one-time payment', {
      userId,
      tier,
      amount,
      currency: normalizedCurrency,
      billingPeriod,
      returnUrl,
      cancelUrl,
    });
    
    let orderResponse;
    try {
      orderResponse = await PayPalService.createPayment({
        amount,
        currency: normalizedCurrency,
        description: `QueryAI ${tier} subscription (${billingPeriod})`,
        custom_id: userId,
        returnUrl,
        cancelUrl,
        preferCard: true, // Always prefer card payment (PayPal account option removed)
      });
      logger.info('PayPal order created successfully', {
        orderId: orderResponse.orderId,
        approvalUrl: orderResponse.approvalUrl,
      });
    } catch (paypalError: unknown) {
      const error = paypalError as { statusCode?: number; message?: string; body?: unknown };
      logger.error('PayPal order creation failed', {
        userId,
        tier,
        amount,
        currency: normalizedCurrency,
        billingPeriod,
        error: {
          statusCode: error.statusCode,
          message: error.message,
          body: error.body,
          stack: (paypalError as Error)?.stack,
        },
        requestParams: {
          returnUrl,
          cancelUrl,
          description: `QueryAI ${tier} subscription (${billingPeriod})`,
        },
      });
      throw paypalError;
    }

    const payment = await DatabaseService.createPayment({
      user_id: userId,
      subscription_id: subscription?.id,
      payment_provider: 'paypal',
      paypal_order_id: orderResponse.orderId,
      tier,
      amount,
      currency: normalizedCurrency,
      status: 'pending',
      payment_description: `QueryAI ${tier} subscription (${billingPeriod})`,
      callback_data: {
        return_url: return_url || undefined,
        billing_period: billingPeriod,
        ...priceLockData,
      },
    });

    logger.info('PayPal payment initiated', {
      userId,
      tier,
      paymentId: payment.id,
      orderId: orderResponse.orderId,
    });

    return res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment.id,
          tier: payment.tier,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          billing_period: billingPeriod,
        },
        redirect_url: orderResponse.approvalUrl,
        order_id: orderResponse.orderId,
        billing_period: billingPeriod,
      },
    });
  })
);

/**
 * GET /api/payment/callback
 * Handle PayPal redirect after user approves.
 *
 * One-time (Orders): PayPal sends token (order ID) or orderId.
 * Recurring (Subscriptions): PayPal adds subscription_id (I-xxx), ba_token (BA-xxx), and token (approval token).
 * We store paypal_subscription_id (I-xxx) — only subscription_id maps to our payment; token/ba_token cannot.
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const frontendUrl = getFrontendUrl();
    const q = req.query as Record<string, string | undefined>;

    // Extract all possible param names (PayPal may use snake_case or camelCase)
    const token = q.token || q.PayerID || q.paymentId;
    const orderId = q.orderId || q.order_id;
    const subscriptionId = q.subscription_id || q.subscriptionId || q.subscriptionID;
    const baToken = q.ba_token || q.baToken;

    logger.info('PayPal callback received', {
      token: token ? 'present' : 'missing',
      orderId: orderId ? 'present' : 'missing',
      subscriptionId: subscriptionId ? 'present' : 'missing',
      baToken: baToken ? 'present' : 'missing',
      allQueryParams: Object.keys(req.query),
    });

    let payment: Database.Payment | null = null;

    // For subscriptions: subscription_id (I-xxx) is the only usable identifier — we store it.
    // token/ba_token are approval tokens (BA-xxx) and cannot be used to find our payment.
    if (subscriptionId) {
      payment = await DatabaseService.getPaymentByPayPalSubscriptionId(subscriptionId);
    }

    // For one-time: order ID (token or orderId) maps to paypal_order_id
    if (!payment && (orderId || token)) {
      const orderLookup = orderId || token!;
      payment = await DatabaseService.getPaymentByPayPalOrderId(orderLookup);
    }
    if (!payment && token && token !== orderId) {
      payment = await DatabaseService.getPaymentByPayPalOrderId(token);
    }

    // Fallback: if we only have ba_token, we cannot resolve — no API to map approval token to subscription ID.
    // User should use sync-subscription from dashboard.
    
    if (!payment) {
      logger.warn('Payment not found in callback', {
        token: token ? 'present' : 'missing',
        orderId: orderId ? 'present' : 'missing',
        subscriptionId: subscriptionId ? 'present' : 'missing',
        baToken: baToken ? 'present' : 'missing',
        hint: !subscriptionId && baToken ? 'Only ba_token present; use sync-subscription from dashboard' : undefined,
      });
      // Still redirect but with error info
      return res.redirect(`${frontendUrl}/dashboard?payment=error&reason=payment_not_found`);
    }

    const isRecurring = !!payment.paypal_subscription_id;
    let paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled' = payment.status;
    let tierAlreadyUpdated = false; // Track if updateSubscriptionTier was already called (for recurring)
    
    // Idempotency check: if payment is already completed, skip processing but still redirect to success
    const isAlreadyCompleted = payment.status === 'completed';

    if (isAlreadyCompleted) {
      logger.info('Payment already completed, skipping duplicate processing', {
        paymentId: payment.id,
        currentStatus: payment.status,
      });
      paymentStatus = 'completed';
      // Still need to check if tier was updated (in case webhook completed it)
      const existingSubscription = await DatabaseService.getUserSubscription(payment.user_id);
      if (existingSubscription?.tier === payment.tier) {
        tierAlreadyUpdated = true;
      }
    } else if (isRecurring) {
      // Recurring: user approved subscription; sync from PayPal and activate
      const subscriptionLookupId = payment.paypal_subscription_id || subscriptionId || '';
      try {
        const subDetails = await PayPalService.getSubscription(subscriptionLookupId);
        const status = (subDetails.status || '').toUpperCase();
        if (status === 'ACTIVE') {
          paymentStatus = 'completed';
          const periodStart = subDetails.start_time
            ? new Date(subDetails.start_time)
            : new Date();
          const periodEnd = subDetails.next_billing_time
            ? new Date(subDetails.next_billing_time)
            : new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          const storedBillingPeriod = (payment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined;
          const billingPeriod = storedBillingPeriod === 'annual' ? 'annual' : 'monthly';
          const currency = 'USD';
          const { getAnnualDiscountPercent } = await import('../constants/pricing');
          const annualDiscount = billingPeriod === 'annual'
            ? getAnnualDiscountPercent(payment.tier as Tier)
            : 0;

          await DatabaseService.updatePayment(payment.id, {
            status: 'completed',
            callback_data: {
              ...(typeof payment.callback_data === 'object' && payment.callback_data ? payment.callback_data : {}),
              ...(subDetails as unknown as Record<string, unknown>),
            } as Record<string, unknown>,
            completed_at: new Date().toISOString(),
          });

          await DatabaseService.updateSubscription(payment.user_id, {
            paypal_subscription_id: subscriptionLookupId,
            tier: payment.tier,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            status: 'active',
            auto_renew: true,
            billing_period: billingPeriod,
            annual_discount: annualDiscount,
          });

          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier, false, billingPeriod, extractPriceLock(payment.callback_data));
          tierAlreadyUpdated = true; // Mark as already updated to avoid duplicate call

          logger.info('PayPal subscription activated', {
            paymentId: payment.id,
            subscriptionId: subscriptionLookupId,
            tier: payment.tier,
          });
        }
      } catch (subError: unknown) {
        logger.error('PayPal subscription sync failed', {
          paymentId: payment.id,
          subscriptionId: subscriptionLookupId,
          error: subError,
        });
        paymentStatus = 'failed';
        await DatabaseService.updatePayment(payment.id, {
          status: 'failed',
          callback_data: { error: (subError as Error).message },
        });
        return res.redirect(`${frontendUrl}/dashboard?payment=failed`);
      }
    } else {
      // One-time: capture order
      let captureId: string | undefined;
      let callbackData: Record<string, unknown> = {};

      const orderLookupId = payment.paypal_order_id || orderId || token || '';
      try {
        const result = await PayPalService.executePayment(orderLookupId);
        paymentStatus = 'completed';
        captureId = result.captureId;
        callbackData = {
          captureId: result.captureId,
          amount: result.amount,
          currency: result.currency,
          payerEmail: result.payerEmail,
          payerName: result.payerName,
        };

        await DatabaseService.updatePayment(payment.id, {
          status: 'completed',
          paypal_payment_id: captureId,
          callback_data: {
            ...(typeof payment.callback_data === 'object' && payment.callback_data ? payment.callback_data : {}),
            ...callbackData, // Merge capture result with existing callback_data (preserves billing_period)
          },
          payment_method: result.payerEmail ? 'paypal' : undefined,
          completed_at: new Date().toISOString(),
        });

        logger.info('PayPal payment captured', {
          paymentId: payment.id,
          orderId: orderLookupId,
          captureId,
        });
      } catch (captureError: unknown) {
        logger.error('PayPal capture failed', {
          paymentId: payment.id,
          orderId: orderLookupId,
          error: captureError,
        });
        const err = captureError as { statusCode?: number; message?: string };
        if (err.statusCode === 422 || (err.message && err.message.includes('already captured'))) {
          // Order already captured - check status and update payment
          try {
            const details = await PayPalService.getPaymentDetails(orderLookupId);
            paymentStatus = mapPayPalOrderStatusToPaymentStatus(details.status);
            await DatabaseService.updatePayment(payment.id, {
              status: paymentStatus,
              paypal_payment_id: details.captureId,
              callback_data: { ...details },
              completed_at: paymentStatus === 'completed' ? new Date().toISOString() : undefined,
            });
            logger.info('PayPal payment status synced after capture error', {
              paymentId: payment.id,
              orderId: orderLookupId,
              status: paymentStatus,
            });
          } catch (detailsError) {
            logger.error('Failed to get payment details after capture error', {
              paymentId: payment.id,
              orderId: orderLookupId,
              error: detailsError,
            });
            // Don't fail - webhook will handle it
            paymentStatus = payment.status; // Keep current status
          }
        } else {
          // For other errors, check if order is actually approved/completed
          try {
            const orderDetails = await PayPalService.getPaymentDetails(orderLookupId);
            const orderStatus = (orderDetails.status || '').toUpperCase();
            if (orderStatus === 'COMPLETED' || orderStatus === 'APPROVED') {
              // Order is approved/completed but capture failed - try to get capture ID from details
              paymentStatus = 'completed';
              await DatabaseService.updatePayment(payment.id, {
                status: 'completed',
                paypal_payment_id: orderDetails.captureId,
                callback_data: { ...orderDetails, captureError: (captureError as Error).message },
                completed_at: new Date().toISOString(),
              });
              logger.info('PayPal payment marked as completed based on order status', {
                paymentId: payment.id,
                orderId: orderLookupId,
                orderStatus,
              });
            } else {
              // Order not yet approved/completed
              paymentStatus = 'pending';
              logger.warn('PayPal order not yet completed', {
                paymentId: payment.id,
                orderId: orderLookupId,
                orderStatus,
              });
            }
          } catch (detailsError) {
            logger.error('Failed to check order status after capture error', {
              paymentId: payment.id,
              orderId: orderLookupId,
              captureError: (captureError as Error).message,
              detailsError,
            });
            // Keep payment as pending - webhook will handle completion
            paymentStatus = 'pending';
          }
        }
      }
    }

    const updatedPayment = await DatabaseService.getPaymentById(payment.id);
    if (!updatedPayment) {
      return res.redirect(`${frontendUrl}/dashboard?payment=error`);
    }

    // Get return URL from payment callback_data or default to dashboard
    const returnUrl = (updatedPayment.callback_data as { return_url?: string } | null)?.return_url;
    const redirectBase = returnUrl || `${frontendUrl}/dashboard`;

    if (paymentStatus === 'completed') {
      const { SubscriptionService } = await import('../services/subscription.service');
      const subscriptionBefore = await DatabaseService.getUserSubscription(payment.user_id);
      
      // Only update subscription tier if not already updated (recurring subscriptions update it earlier)
      if (!tierAlreadyUpdated) {
        // Extract billing_period from payment callback_data if available (for one-time payments)
        const paymentBillingPeriod = (updatedPayment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined;
        await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier, false, paymentBillingPeriod, extractPriceLock(updatedPayment.callback_data));
      }

      // Record promo code usage if a promo was applied (9.6.3)
      if (!isAlreadyCompleted) {
        const promoId = (updatedPayment.callback_data as Record<string, unknown> | null)?.promo_code_id as string | undefined;
        const promoDiscount = (updatedPayment.callback_data as Record<string, unknown> | null)?.promo_discount_amount as number | undefined;
        if (promoId) {
          const { PromoCodeService } = await import('../services/promo-code.service');
          PromoCodeService.recordUsage(promoId, payment.user_id, payment.id, promoDiscount ?? 0);
        }
      }
      
      const subscriptionAfter = await DatabaseService.getUserSubscription(payment.user_id);

      // Idempotency: Only send emails if payment was not already completed (prevents duplicate emails from callback + webhook)
      if (!isAlreadyCompleted) {
        try {
          const { EmailService } = await import('../services/email.service');
          const { getTierOrder } = await import('../constants/pricing');
          const userProfile = await DatabaseService.getUserProfile(payment.user_id);
          if (userProfile) {
            await EmailService.sendPaymentSuccessEmail(
              userProfile.email,
              userProfile.full_name || userProfile.email,
              updatedPayment
            );
            await EmailService.sendInvoiceEmail(
              userProfile.email,
              userProfile.full_name || userProfile.email,
              updatedPayment
            );
            const oldTier = subscriptionBefore?.tier ?? 'free';
            const newTier = payment.tier;
            if (oldTier === 'free' && newTier !== 'free') {
              await EmailService.sendWelcomeEmail(
                userProfile.email,
                userProfile.full_name || userProfile.email,
                newTier
              );
            } else if (
              getTierOrder(newTier as Tier) >
              getTierOrder(oldTier as Tier)
            ) {
              const periodStart = subscriptionAfter?.current_period_start
                ? new Date(subscriptionAfter.current_period_start)
                : new Date();
              const periodEnd = subscriptionAfter?.current_period_end
                ? new Date(subscriptionAfter.current_period_end)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              await EmailService.sendUpgradeConfirmationEmail(
                userProfile.email,
                userProfile.full_name || userProfile.email,
                newTier,
                periodStart,
                periodEnd,
                { proratedAmount: updatedPayment.amount, currency: updatedPayment.currency }
              );
            }
          }
        } catch (emailError) {
          logger.error('Failed to send payment emails:', emailError);
        }
      } else {
        logger.info('Skipping email sends - payment already completed (idempotency)', {
          paymentId: payment.id,
        });
      }

      // Redirect to original page or dashboard with success message
      const successUrl = returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=success`
        : `${frontendUrl}/dashboard?payment=success`;
      return res.redirect(successUrl);
    }

    if (paymentStatus === 'failed') {
      try {
        const { EmailService } = await import('../services/email.service');
        const userProfile = await DatabaseService.getUserProfile(payment.user_id);
        if (userProfile) {
          await EmailService.sendPaymentFailureEmail(
            userProfile.email,
            userProfile.full_name || userProfile.email,
            updatedPayment,
            updatedPayment.retry_count || 0
          );
        }
      } catch (emailError) {
        logger.error('Failed to send payment failure email:', emailError);
      }
      const failedUrl = returnUrl 
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=failed`
        : `${frontendUrl}/dashboard?payment=failed`;
      return res.redirect(failedUrl);
    }

    const pendingUrl = returnUrl 
      ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=pending`
      : `${frontendUrl}/dashboard?payment=pending`;
    return res.redirect(pendingUrl);
  })
);

/**
 * GET /api/payment/cancel
 * User cancelled on PayPal or encountered an error; redirect to frontend.
 * PayPal may call this with token, orderId, subscription_id, or no parameters
 */
router.get(
  '/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const frontendUrl = getFrontendUrl();
    
    // PayPal may send different parameters
    const token = 
      (req.query.token as string) || 
      (req.query.orderId as string) || 
      (req.query.subscription_id as string) ||
      (req.query.PayerID as string);
    
    logger.info('PayPal cancel/return received', { 
      token: token ? 'present' : 'missing',
      query: req.query,
      allQueryParams: Object.keys(req.query),
    });
    
    if (token) {
      let payment = await DatabaseService.getPaymentByPayPalOrderId(token);
      if (!payment) {
        payment = await DatabaseService.getPaymentByPayPalSubscriptionId(token);
      }
      if (payment) {
        // Only update to cancelled if still pending
        if (payment.status === 'pending') {
          await DatabaseService.updatePayment(payment.id, { status: 'cancelled' });
          try {
            const { EmailService } = await import('../services/email.service');
            const userProfile = await DatabaseService.getUserProfile(payment.user_id);
            if (userProfile) {
              const updated = await DatabaseService.getPaymentById(payment.id);
              if (updated) {
                await EmailService.sendPaymentCancellationEmail(
                  userProfile.email,
                  userProfile.full_name || userProfile.email,
                  updated
                );
              }
            }
          } catch (emailError) {
            logger.error('Failed to send cancellation email:', emailError);
          }
        }
      }
    }
    
    // Always redirect back to dashboard, even if no token found
    // This handles cases where PayPal redirects without parameters
    return res.redirect(`${frontendUrl}/dashboard?payment=cancelled`);
  })
);

/**
 * POST /api/payment/sync-subscription
 * Sync pending subscription payments from PayPal (fallback when callback doesn't run or fails).
 * Call when user returns from PayPal but payment/tier didn't update (e.g. Auto return OFF).
 */
router.post(
  '/sync-subscription',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { subscription_id: subscriptionId } = req.body;

    // Find pending payments for this user with paypal_subscription_id
    const payments = subscriptionId
      ? [(await DatabaseService.getPaymentByPayPalSubscriptionId(subscriptionId))].filter(Boolean) as Database.Payment[]
      : (await DatabaseService.getUserPayments(userId, 20)).filter(
          (p) => p.status === 'pending' && p.paypal_subscription_id
        );

    if (payments.length === 0) {
      return res.status(200).json({
        success: true,
        data: { synced: false, message: 'No pending subscription payments to sync' },
      });
    }

    let synced = false;
    for (const payment of payments) {
      if (payment.user_id !== userId) continue;
      const subId = payment.paypal_subscription_id;
      if (!subId) continue;

      try {
        const subDetails = await PayPalService.getSubscription(subId);
        const status = (subDetails.status || '').toUpperCase();
        if (status !== 'ACTIVE') continue;

        // Update payment to completed
        await DatabaseService.updatePayment(payment.id, {
          status: 'completed',
          callback_data: {
            ...(typeof payment.callback_data === 'object' && payment.callback_data ? payment.callback_data : {}),
            ...(subDetails as unknown as Record<string, unknown>),
          } as Record<string, unknown>,
          completed_at: new Date().toISOString(),
        });

        // Update subscription
        const periodStart = subDetails.start_time
          ? new Date(subDetails.start_time)
          : new Date();
        const periodEnd = subDetails.next_billing_time
          ? new Date(subDetails.next_billing_time)
          : new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        const storedBillingPeriod = (payment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined;
        const billingPeriod = storedBillingPeriod === 'annual' ? 'annual' : 'monthly';
        const currency = 'USD';
        const { getAnnualDiscountPercent } = await import('../constants/pricing');
        const annualDiscount = billingPeriod === 'annual'
          ? getAnnualDiscountPercent(payment.tier as Tier)
          : 0;

        await DatabaseService.updateSubscription(payment.user_id, {
          paypal_subscription_id: subId,
          tier: payment.tier,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          status: 'active',
          auto_renew: true,
          billing_period: billingPeriod,
          annual_discount: annualDiscount,
        });

        const { SubscriptionService } = await import('../services/subscription.service');
        await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier, undefined, undefined, extractPriceLock(payment.callback_data));

        logger.info('Subscription synced via sync-subscription endpoint', {
          paymentId: payment.id,
          subscriptionId: subId,
          tier: payment.tier,
        });
        synced = true;
      } catch (err) {
        logger.warn('Sync subscription failed for payment', {
          paymentId: payment.id,
          subscriptionId: subId,
          error: err,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: { synced, message: synced ? 'Subscription synced' : 'No updates needed' },
    });
  })
);

/**
 * POST /api/payment/:paymentId/cancel
 * Let the user cancel their own pending payment so they can start a new one.
 */
router.post(
  '/:paymentId/cancel',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const paymentId = req.params.paymentId as string;

    const payment = await DatabaseService.getPaymentById(paymentId);
    if (!payment) {
      throw new ValidationError('Payment not found.');
    }
    if (payment.user_id !== userId) {
      throw new ValidationError('Payment not found.');
    }
    if (payment.status !== 'pending') {
      throw new ValidationError(`Cannot cancel a payment with status "${payment.status}".`);
    }

    await DatabaseService.updatePayment(paymentId, { status: 'cancelled' });

    logger.info('User cancelled pending payment', { userId, paymentId });

    return res.status(200).json({
      success: true,
      data: { message: 'Pending payment cancelled.' },
    });
  })
);

/**
 * GET /api/payment/webhook - reject GET
 */
router.get(
  '/webhook',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(405).json({
      success: false,
      message: 'Webhook endpoint only accepts POST requests',
    });
  })
);

/**
 * POST /api/payment/webhook
 * Handle PayPal webhook (verify signature, process events)
 */
router.post(
  '/webhook',
  webhookLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const webhookEvent = req.body as Record<string, unknown>;
    const eventType = webhookEvent.event_type as string | undefined;
    const resource = webhookEvent.resource as Record<string, unknown> | undefined;

    logger.info('PayPal webhook received', {
      event_type: eventType,
      id: webhookEvent.id,
    });

    const authAlgo = req.headers['paypal-auth-algo'] as string;
    const certUrl = req.headers['paypal-cert-url'] as string;
    const transmissionId = req.headers['paypal-transmission-id'] as string;
    const transmissionSig = req.headers['paypal-transmission-sig'] as string;
    const transmissionTime = req.headers['paypal-transmission-time'] as string;

    const hasVerificationHeaders = !!(authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime);

    // Use an explicit opt-in flag for skipping verification (e.g., local dev with PayPal sandbox).
    // This prevents accidental bypass if NODE_ENV is misconfigured in production.
    const skipWebhookVerification = process.env.SKIP_WEBHOOK_VERIFICATION === 'true';

    // Verify webhook signature if headers are present
    if (hasVerificationHeaders) {
      const isValid = await PayPalService.verifyWebhookSignature({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookId: config.PAYPAL_WEBHOOK_ID || '',
        webhookEvent,
      });
      if (!isValid) {
        logger.error('PayPal webhook verification failed - rejecting webhook', {
          event_type: eventType,
          webhook_id: webhookEvent.id,
          transmissionId,
        });
        return res.status(403).json({ 
          success: false, 
          message: 'Webhook verification failed' 
        });
      }
      logger.debug('PayPal webhook signature verified', {
        event_type: eventType,
        webhook_id: webhookEvent.id,
      });
    } else if (skipWebhookVerification) {
      // Explicit opt-in: only allow unverified webhooks when SKIP_WEBHOOK_VERIFICATION=true
      logger.warn('PayPal webhook missing verification headers — allowed via SKIP_WEBHOOK_VERIFICATION flag', {
        event_type: eventType,
        webhook_id: webhookEvent.id,
      });
    } else {
      // Reject webhooks without verification headers (default secure behavior)
      logger.error('PayPal webhook missing verification headers - rejecting', {
        event_type: eventType,
        webhook_id: webhookEvent.id,
        headers: {
          'paypal-auth-algo': authAlgo ? 'present' : 'missing',
          'paypal-cert-url': certUrl ? 'present' : 'missing',
          'paypal-transmission-id': transmissionId ? 'present' : 'missing',
          'paypal-transmission-sig': transmissionSig ? 'present' : 'missing',
          'paypal-transmission-time': transmissionTime ? 'present' : 'missing',
        },
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Webhook verification headers required' 
      });
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && resource) {
      const captureId = resource.id as string | undefined;
      if (captureId) {
        const { supabaseAdmin } = await import('../config/database');
        // First, try to find payment by capture ID (if callback already stored it)
        let { data: payments } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('paypal_payment_id', captureId)
          .limit(1);
        let payment = payments?.[0] as Database.Payment | undefined;
        
        // If not found by capture ID, try to find by order ID from capture resource
        // PayPal capture resource may have links or supplementary_data with order reference
        if (!payment) {
          const orderId = (resource as { supplementary_data?: { related_ids?: { order_id?: string } } }).supplementary_data?.related_ids?.order_id;
          if (orderId) {
            const foundPayment = await DatabaseService.getPaymentByPayPalOrderId(orderId);
            payment = foundPayment || undefined; // Convert null to undefined
            logger.info('PayPal webhook: Found payment by order ID from capture', {
              captureId,
              orderId,
              paymentId: payment?.id,
            });
          }
        }
        
        // If still not found, try to find pending payments and match by amount/currency
        // This is a fallback for cases where order ID isn't in the capture resource
        if (!payment) {
          const captureAmount = (resource as { amount?: { value?: string; currency_code?: string } }).amount;
          if (captureAmount?.value && captureAmount?.currency_code) {
            const { data: pendingPayments } = await supabaseAdmin
              .from('payments')
              .select('*')
              .eq('status', 'pending')
              .eq('amount', parseFloat(captureAmount.value))
              .eq('currency', captureAmount.currency_code.toUpperCase())
              .is('paypal_payment_id', null) // Only payments without capture ID yet
              .limit(10);
            
            // If multiple matches, we can't be sure - log warning
            if (pendingPayments && pendingPayments.length > 0) {
              if (pendingPayments.length === 1) {
                payment = pendingPayments[0] as Database.Payment;
                logger.info('PayPal webhook: Found payment by amount/currency match', {
                  captureId,
                  paymentId: payment.id,
                  amount: captureAmount.value,
                  currency: captureAmount.currency_code,
                });
              } else {
                logger.warn('PayPal webhook: Multiple pending payments match capture amount/currency', {
                  captureId,
                  amount: captureAmount.value,
                  currency: captureAmount.currency_code,
                  matchCount: pendingPayments.length,
                });
              }
            }
          }
        }
        
        if (payment && payment.status !== 'completed') {
          await DatabaseService.updatePayment(payment.id, {
            status: 'completed',
            paypal_payment_id: captureId, // Store capture ID if not already stored
            callback_data: {
              ...(typeof payment.callback_data === 'object' && payment.callback_data ? payment.callback_data : {}),
              ...(resource as Record<string, unknown>), // Merge webhook resource with existing callback_data (preserves billing_period)
            },
            completed_at: new Date().toISOString(),
          });
          const { SubscriptionService } = await import('../services/subscription.service');
          // Extract billing_period from payment callback_data if available (for one-time payments)
          const paymentBillingPeriod = (payment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined;
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier, false, paymentBillingPeriod, extractPriceLock(payment.callback_data));
          logger.info('Payment completed via webhook', { paymentId: payment.id, captureId });
        } else if (!payment) {
          logger.warn('PayPal webhook: Payment not found for capture', {
            captureId,
            eventType,
            resourceId: resource.id,
          });
        }
      }
    }

    // Handle subscription activation events
    if (
      (eventType === 'BILLING.SUBSCRIPTION.CREATED' || 
       eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' ||
       eventType === 'BILLING.SUBSCRIPTION.UPDATED') &&
      resource
    ) {
      const subscriptionId = resource.id as string | undefined;
      if (subscriptionId) {
        // Find payment by subscription ID
        const payment = await DatabaseService.getPaymentByPayPalSubscriptionId(subscriptionId);
        if (payment && payment.status === 'pending') {
          try {
            const subDetails = await PayPalService.getSubscription(subscriptionId);
            const status = (subDetails.status || '').toUpperCase();
            
            if (['ACTIVE', 'APPROVAL_PENDING', 'APPROVED'].includes(status)) {
              await DatabaseService.updatePayment(payment.id, {
                status: 'completed',
                callback_data: subDetails as unknown as Record<string, unknown>,
                completed_at: new Date().toISOString(),
              });

              const periodStart = subDetails.start_time
                ? new Date(subDetails.start_time)
                : new Date();
              const periodEnd = subDetails.next_billing_time
                ? new Date(subDetails.next_billing_time)
                : new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

              const storedBillingPeriod = (payment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined;
              const billingPeriod = storedBillingPeriod === 'annual' ? 'annual' : 'monthly';
              const currency = 'USD';
              const { getAnnualDiscountPercent } = await import('../constants/pricing');
              const annualDiscount = billingPeriod === 'annual'
                ? getAnnualDiscountPercent(payment.tier as 'pro')
                : 0;

              await DatabaseService.updateSubscription(payment.user_id, {
                paypal_subscription_id: subscriptionId,
                tier: payment.tier,
                current_period_start: periodStart.toISOString(),
                current_period_end: periodEnd.toISOString(),
                status: 'active',
                auto_renew: true,
                billing_period: billingPeriod,
                annual_discount: annualDiscount,
              });

              const { SubscriptionService } = await import('../services/subscription.service');
              await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier, undefined, undefined, extractPriceLock(payment.callback_data));

              logger.info('PayPal subscription activated via webhook', {
                paymentId: payment.id,
                subscriptionId,
                tier: payment.tier,
                eventType,
              });
            }
          } catch (subError: unknown) {
            logger.error('PayPal subscription activation via webhook failed', {
              subscriptionId,
              paymentId: payment.id,
              error: subError,
            });
          }
        }
      }
    }

    if (eventType === 'PAYMENT.SALE.COMPLETED' && resource) {
      // PayPal Subscriptions API v1: billing_agreement_id IS the subscription ID (I-xxx format)
      // PayPal may also send subscription_id or other fields - try multiple sources
      const subscriptionId =
        (resource.billing_agreement_id as string | undefined) ||
        (resource.subscription_id as string | undefined) ||
        (resource.subscriptionId as string | undefined) ||
        // Check if resource.id is a subscription ID (I-xxx format) - unlikely but possible
        (typeof resource.id === 'string' && resource.id.startsWith('I-') ? resource.id : undefined);

      if (subscriptionId) {
        try {
          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.handlePayPalSubscriptionRenewal(subscriptionId, resource);
          logger.info('PayPal subscription renewal processed via webhook', {
            paypalSubscriptionId: subscriptionId,
            source: resource.billing_agreement_id ? 'billing_agreement_id' : 
                    resource.subscription_id ? 'subscription_id' :
                    resource.subscriptionId ? 'subscriptionId' : 'id',
          });
        } catch (renewalError) {
          logger.error('PayPal subscription renewal via webhook failed', {
            subscriptionId,
            error: renewalError,
            resourceFields: Object.keys(resource),
          });
        }
      } else {
        // Not a subscription renewal - might be a one-time payment sale
        logger.debug('PAYMENT.SALE.COMPLETED webhook: No subscription ID found, skipping renewal processing', {
          resourceId: resource.id,
          hasBillingAgreementId: !!resource.billing_agreement_id,
        });
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' && resource) {
      const subscriptionId = resource.id as string | undefined;
      if (subscriptionId) {
        try {
          const subscription = await DatabaseService.getSubscriptionByPayPalSubscriptionId(subscriptionId);
          if (!subscription) {
            logger.warn('Subscription not found for PAYMENT.FAILED webhook', { subscriptionId });
            return res.status(200).json({ success: true, message: 'Webhook received' });
          }

          const now = new Date();
          const gracePeriodEnd = new Date(now);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 days grace period

          // Set grace period if not already set
          if (!subscription.grace_period_end) {
            await DatabaseService.updateSubscription(subscription.user_id, {
              grace_period_end: gracePeriodEnd.toISOString(),
            });
          }

          // Extract failure details from resource
          const failureReason = (resource as { failure_reason?: string; reason?: string }).failure_reason ||
                                (resource as { failure_reason?: string; reason?: string }).reason ||
                                'Payment method declined or insufficient funds';
          const resourceAmount = (resource as { amount?: { value?: string; currency_code?: string } }).amount;
          let amountValue = resourceAmount?.value ? parseFloat(resourceAmount.value) : undefined;
          const currency = 'USD';

          // If amount not in resource, calculate from subscription tier and billing period
          if (!amountValue) {
            const billingPeriod = (subscription as Database.Subscription & { billing_period?: string }).billing_period ?? 'monthly';
            const { getPricing } = await import('../constants/pricing');
            amountValue = getPricing(
              subscription.tier as 'pro' | 'enterprise',
              billingPeriod as 'monthly' | 'annual'
            );
          }

          // Check for existing pending or failed payment for this renewal attempt
          const existingPayments = await DatabaseService.getUserPayments(subscription.user_id, 10);
          const recentPayment = existingPayments.find(
            (p) => p.paypal_subscription_id === subscriptionId &&
                   (p.status === 'pending' || p.status === 'failed') &&
                   new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Within last 7 days
          );

          if (recentPayment) {
            // Update existing payment to failed status
            await DatabaseService.updatePayment(recentPayment.id, {
              status: 'failed',
              callback_data: {
                ...(typeof recentPayment.callback_data === 'object' && recentPayment.callback_data ? recentPayment.callback_data : {}),
                ...(resource as Record<string, unknown>),
                failure_reason: failureReason,
                webhook_event: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
              },
              webhook_data: resource as Record<string, unknown>,
            });
            logger.info('Updated existing payment to failed status', {
              paymentId: recentPayment.id,
              subscriptionId,
            });
          } else {
            // Create new failed payment record for this renewal attempt
            await DatabaseService.createPayment({
              user_id: subscription.user_id,
              subscription_id: subscription.id,
              payment_provider: 'paypal',
              paypal_subscription_id: subscriptionId,
              tier: subscription.tier,
              amount: amountValue,
              currency,
              status: 'failed',
              payment_description: `QueryAI ${subscription.tier} subscription renewal (failed)`,
              callback_data: {
                ...(resource as Record<string, unknown>),
                failure_reason: failureReason,
                webhook_event: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
              },
              webhook_data: resource as Record<string, unknown>,
            });
            logger.info('Created new failed payment record', {
              subscriptionId,
              userId: subscription.user_id,
            });
          }

          // Send failure notification email
          try {
            const { EmailService } = await import('../services/email.service');
            const [userProfile, updatedSubscription] = await Promise.all([
              DatabaseService.getUserProfile(subscription.user_id),
              DatabaseService.getUserSubscription(subscription.user_id),
            ]);
            if (userProfile) {
              if (updatedSubscription) {
                await EmailService.sendFailedRenewalNotificationEmail(
                  userProfile.email,
                  userProfile.full_name || userProfile.email,
                  updatedSubscription,
                  {
                    failureReason,
                    amount: amountValue,
                    currency,
                    daysRemaining: 7,
                  }
                );
                logger.info('Failed renewal notification email sent', {
                  subscriptionId,
                  userId: subscription.user_id,
                });
              }
            }
          } catch (emailError) {
            logger.error('Failed to send payment failure email', {
              subscriptionId,
              error: emailError,
            });
          }

          // Optionally trigger payment retry service (it will handle retries based on schedule)
          // Note: PaymentRetryService.processFailedPayments() is typically called by a scheduled job
          // We don't call it here to avoid blocking the webhook response

          logger.info('PayPal subscription payment failure processed via webhook', {
            paypalSubscriptionId: subscriptionId,
            userId: subscription.user_id,
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            failureReason,
          });
        } catch (error) {
          logger.error('PayPal subscription payment failure webhook processing failed', {
            subscriptionId,
            error,
          });
        }
      }
    }

    if (
      eventType === 'BILLING.SUBSCRIPTION.CANCELLED' &&
      resource
    ) {
      const subscriptionId = resource.id as string | undefined;
      if (subscriptionId) {
        const { SubscriptionService } = await import('../services/subscription.service');
        await SubscriptionService.handlePayPalSubscriptionCancelled(
          subscriptionId,
          `PayPal event: ${eventType}`
        );
        logger.info('PayPal subscription cancel processed via webhook', {
          paypalSubscriptionId: subscriptionId,
          eventType,
        });
      }
    }

    // Handle subscription suspended event (9.6.12 — separate from cancel)
    if (
      eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' &&
      resource
    ) {
      const subscriptionId = resource.id as string | undefined;
      if (subscriptionId) {
        const { SubscriptionService } = await import('../services/subscription.service');
        await SubscriptionService.handlePayPalSubscriptionSuspended(
          subscriptionId,
          `PayPal event: ${eventType}`
        );
        logger.info('PayPal subscription suspend processed via webhook', {
          paypalSubscriptionId: subscriptionId,
          eventType,
        });
      }
    }

    // Handle subscription expired event
    if (eventType === 'BILLING.SUBSCRIPTION.EXPIRED' && resource) {
      const subscriptionId = resource.id as string | undefined;
      if (subscriptionId) {
        try {
          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.handlePayPalSubscriptionExpired(
            subscriptionId,
            'PayPal subscription expired'
          );
          logger.info('PayPal subscription expired processed via webhook', {
            paypalSubscriptionId: subscriptionId,
            eventType,
          });
        } catch (expiredError) {
          logger.error('PayPal subscription expired webhook handler failed', {
            subscriptionId,
            error: expiredError,
          });
        }
      }
    }

    logger.info('PayPal webhook processed', { event_type: eventType });

    return res.status(200).json({ success: true, message: 'Webhook received' });
  })
);

/**
 * GET /api/payment/status/:orderId
 * Get payment status by PayPal order ID
 */
router.get(
  '/status/:orderId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    if (!orderId) {
      throw new ValidationError('Order ID is required');
    }

    const payment = await DatabaseService.getPaymentByPayPalOrderId(orderId);
    if (!payment) {
      throw new ValidationError('Payment not found');
    }
    if (payment.user_id !== userId) {
      throw new ValidationError('Unauthorized');
    }

    try {
      const details = await PayPalService.getPaymentDetails(orderId);
      const paymentStatus = mapPayPalOrderStatusToPaymentStatus(details.status);
      if (payment.status !== paymentStatus) {
        await DatabaseService.updatePayment(payment.id, {
          status: paymentStatus,
          callback_data: {
            ...(typeof payment.callback_data === 'object' && payment.callback_data ? payment.callback_data : {}),
            ...(details as unknown as Record<string, unknown>), // Merge payment details with existing callback_data (preserves billing_period)
          },
          paypal_payment_id: details.captureId,
          completed_at: paymentStatus === 'completed' ? new Date().toISOString() : undefined,
        });
        if (paymentStatus === 'completed') {
          const { SubscriptionService } = await import('../services/subscription.service');
          // Extract billing_period from payment callback_data if available (for one-time payments)
          const updatedPayment = await DatabaseService.getPaymentById(payment.id);
          const paymentBillingPeriod = updatedPayment ? (updatedPayment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined : undefined;
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier, false, paymentBillingPeriod, extractPriceLock(updatedPayment?.callback_data));
        }
      }

      const updated = await DatabaseService.getPaymentById(payment.id);
      res.status(200).json({
        success: true,
        data: {
          payment: updated || payment,
          paypal_status: details.status,
        },
      });
    } catch (error) {
      logger.error('Failed to get PayPal payment status:', error);
      res.status(200).json({
        success: true,
        data: { payment },
      });
    }
  })
);

/**
 * GET /api/payment/history
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }
    const payments = await DatabaseService.getUserPayments(userId);
    res.status(200).json({
      success: true,
      data: { payments },
    });
  })
);

/**
 * POST /api/payment/refund
 * Process refund via PayPal (uses capture ID)
 */
router.post(
  '/refund',
  validateRequest(PaymentRefundSchema),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { paymentId, amount, reason } = req.body;

    const payment = await DatabaseService.getPaymentById(paymentId);
    if (!payment) {
      throw new ValidationError('Payment not found');
    }
    if (payment.user_id !== userId) {
      throw new ValidationError('Unauthorized');
    }
    if (payment.status !== 'completed') {
      throw new ValidationError('Only completed payments can be refunded');
    }
    if (!payment.paypal_payment_id) {
      throw new ValidationError('Payment capture ID not found (PayPal)');
    }

    // Refund cooldown: disallow refund if payment completed > 30 days ago
    const completedAt = payment.completed_at ? new Date(payment.completed_at) : null;
    if (completedAt) {
      const daysSinceCompleted = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCompleted > 30) {
        throw new ValidationError(
          'Refund window has expired. Payments can only be refunded within 30 days of completion.'
        );
      }
    }

    // Refund cooldown: disallow multiple refunds on the same payment within 24 hours
    if (payment.refunded_at) {
      const hoursSinceLastRefund = (Date.now() - new Date(payment.refunded_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRefund < 24) {
        throw new ValidationError(
          'A refund was already processed for this payment recently. Please wait 24 hours before requesting another partial refund.'
        );
      }
    }

    const refundAmount = amount ?? payment.amount;
    if (refundAmount > payment.amount) {
      throw new ValidationError('Refund amount cannot exceed payment amount');
    }
    const totalRefunded = (payment.refund_amount || 0) + refundAmount;
    if (totalRefunded > payment.amount) {
      throw new ValidationError('Total refund amount cannot exceed payment amount');
    }

    const refundResult = await PayPalService.refundPayment({
      captureId: payment.paypal_payment_id,
      amount: refundAmount,
      currency: payment.currency,
      note: reason || 'Customer request',
    });

    const refund = await DatabaseService.createRefund({
      payment_id: paymentId,
      user_id: userId,
      amount: refundAmount,
      currency: payment.currency,
      reason: reason,
      paypal_refund_id: refundResult.refundId,
      status: refundResult.status === 'COMPLETED' ? 'completed' : 'pending',
    });

    await DatabaseService.updatePayment(paymentId, {
      refund_amount: totalRefunded,
      refund_reason: reason,
      refunded_at: refundResult.status === 'COMPLETED' ? new Date().toISOString() : undefined,
    });

    logger.info('Refund processed', {
      paymentId,
      refundId: refund?.id,
      amount: refundAmount,
      status: refundResult.status,
    });

    try {
      const { EmailService } = await import('../services/email.service');
      const userProfile = await DatabaseService.getUserProfile(userId);
      if (userProfile) {
        await EmailService.sendRefundConfirmationEmail(
          userProfile.email,
          userProfile.full_name || userProfile.email,
          refundAmount,
          payment.currency,
          { estimatedDays: 5 }
        );
      }
    } catch (emailError) {
      logger.error('Failed to send refund confirmation email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refund,
        refund_status: refundResult.status,
      },
    });
  })
);

// ─── Promo Code Validation (public, auth-required) ──────────────────────────

/**
 * POST /api/payment/validate-promo
 * Validate a promo code for a given tier + billing period.
 * Returns discount info or error.
 */
router.post(
  '/validate-promo',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    const { promo_code, tier, billing_period } = req.body;
    if (!promo_code || !tier) {
      throw new ValidationError('promo_code and tier are required');
    }

    const billingPeriod = billing_period === 'annual' ? 'annual' : 'monthly';

    const { getPricing } = await import('../constants/pricing');
    const originalAmount = getPricing(tier as Tier, billingPeriod);

    const { PromoCodeService } = await import('../services/promo-code.service');
    const result = await PromoCodeService.validate(
      promo_code,
      userId,
      tier,
      billingPeriod,
      originalAmount,
    );

    if (!result.valid) {
      res.status(400).json({
        success: false,
        error: { message: result.reason },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        discount_percent: result.discountPercent,
        original_amount: result.originalAmount,
        discounted_amount: result.discountedAmount,
        savings: result.originalAmount - result.discountedAmount,
      },
    });
  })
);

export default router;
