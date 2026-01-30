import { Router, Request, Response } from 'express';
import * as PayPalService from '../services/paypal.service';
import { DatabaseService } from '../services/database.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import logger from '../config/logger';
import config from '../config/env';
import type { Database } from '../types/database';

const router = Router();

function getBaseUrl(): string {
  let baseUrl = config.API_BASE_URL;
  if (!baseUrl || baseUrl.includes('localhost')) {
    if (config.NODE_ENV === 'production') {
      baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : 'https://queryai-production.up.railway.app';
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
    frontendUrl = isProduction ? 'https://queryai-frontend.pages.dev' : 'http://localhost:3000';
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
 * POST /api/payment/initiate
 * Initiate a PayPal payment for subscription upgrade (account or card via PayPal)
 */
router.post(
  '/initiate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { tier, firstName, lastName, email, recurring = false, billing_period: bp } = req.body;

    if (!tier || !['starter', 'premium', 'pro'].includes(tier)) {
      if (tier === 'enterprise') {
        throw new ValidationError('Enterprise is contact-for-pricing. Use the Enterprise contact form to reach sales.');
      }
      throw new ValidationError('Invalid tier. Must be "starter", "premium", or "pro"');
    }

    if (!firstName || !lastName || !email) {
      throw new ValidationError('Missing required fields: firstName, lastName, email');
    }

    const billingPeriod = (bp === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual';

    const userProfile = await DatabaseService.getUserProfile(userId);
    if (!userProfile) {
      throw new ValidationError('User profile not found');
    }

    const subscription = await DatabaseService.getUserSubscription(userId);

    const currency = (req.body.currency || 'USD') as string;
    if (!['USD', 'UGX'].includes(currency)) {
      throw new ValidationError('Invalid currency. Must be "USD" or "UGX"');
    }

    const { getPricing } = await import('../constants/pricing');
    const amount = getPricing(
      tier as 'starter' | 'premium' | 'pro',
      currency as 'UGX' | 'USD',
      billingPeriod
    );

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
      const subscriptionResponse = await PayPalService.createSubscription({
        tier: tier as 'starter' | 'premium' | 'pro',
        returnUrl,
        cancelUrl,
        customId: userId,
        billing_period: billingPeriod,
      });

      const payment = await DatabaseService.createPayment({
        user_id: userId,
        subscription_id: subscription?.id,
        payment_provider: 'paypal',
        paypal_subscription_id: subscriptionResponse.subscriptionId,
        tier,
        amount,
        currency: currency as 'UGX' | 'USD',
        status: 'pending',
        payment_description: `QueryAI ${tier} subscription (${billingPeriod}, recurring)`,
        callback_data: { billing_period: billingPeriod },
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
    const orderResponse = await PayPalService.createPayment({
      amount,
      currency,
      description: `QueryAI ${tier} subscription (${billingPeriod})`,
      custom_id: userId,
      returnUrl,
      cancelUrl,
    });

    const payment = await DatabaseService.createPayment({
      user_id: userId,
      subscription_id: subscription?.id,
      payment_provider: 'paypal',
      paypal_order_id: orderResponse.orderId,
      tier,
      amount,
      currency: currency as 'UGX' | 'USD',
      status: 'pending',
      payment_description: `QueryAI ${tier} subscription (${billingPeriod})`,
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
 * Handle PayPal redirect after user approves. Token = order ID (one-time) or subscription ID (recurring).
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    const frontendUrl = getFrontendUrl();

    logger.info('PayPal callback received', { token: token ? 'present' : 'missing', query: req.query });

    if (!token) {
      logger.warn('PayPal callback missing token');
      return res.redirect(`${frontendUrl}/dashboard?payment=error`);
    }

    let payment = await DatabaseService.getPaymentByPayPalOrderId(token);
    if (!payment) {
      payment = await DatabaseService.getPaymentByPayPalSubscriptionId(token);
    }
    if (!payment) {
      logger.warn('Payment not found in callback', { token });
      return res.redirect(`${frontendUrl}/dashboard?payment=error`);
    }

    const isRecurring = !!payment.paypal_subscription_id;
    let paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled' = payment.status;

    if (isRecurring) {
      // Recurring: user approved subscription; sync from PayPal and activate
      try {
        const subDetails = await PayPalService.getSubscription(token);
        const status = (subDetails.status || '').toUpperCase();
        if (status === 'ACTIVE' || status === 'APPROVAL_PENDING') {
          paymentStatus = 'completed';
          const periodStart = subDetails.start_time
            ? new Date(subDetails.start_time)
            : new Date();
          const periodEnd = subDetails.next_billing_time
            ? new Date(subDetails.next_billing_time)
            : new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          const storedBillingPeriod = (payment.callback_data as { billing_period?: string } | null)?.billing_period as 'monthly' | 'annual' | undefined;
          const billingPeriod = storedBillingPeriod === 'annual' ? 'annual' : 'monthly';
          const currency = (payment.currency || 'USD') as 'UGX' | 'USD';
          const { getAnnualDiscountPercent } = await import('../constants/pricing');
          const annualDiscount = billingPeriod === 'annual'
            ? getAnnualDiscountPercent(payment.tier as 'starter' | 'premium' | 'pro', currency)
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
            paypal_subscription_id: token,
            tier: payment.tier,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            status: 'active',
            auto_renew: true,
            billing_period: billingPeriod,
            annual_discount: annualDiscount,
          });

          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);

          logger.info('PayPal subscription activated', {
            paymentId: payment.id,
            subscriptionId: token,
            tier: payment.tier,
          });
        }
      } catch (subError: unknown) {
        logger.error('PayPal subscription sync failed', { paymentId: payment.id, token, error: subError });
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

      try {
        const result = await PayPalService.executePayment(token);
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
          callback_data: callbackData,
          payment_method: result.payerEmail ? 'paypal' : undefined,
          completed_at: new Date().toISOString(),
        });

        logger.info('PayPal payment captured', {
          paymentId: payment.id,
          orderId: token,
          captureId,
        });
      } catch (captureError: unknown) {
        logger.error('PayPal capture failed', { paymentId: payment.id, orderId: token, error: captureError });
        const err = captureError as { statusCode?: number; message?: string };
        if (err.statusCode === 422 || (err.message && err.message.includes('already captured'))) {
          const details = await PayPalService.getPaymentDetails(token);
          paymentStatus = mapPayPalOrderStatusToPaymentStatus(details.status);
          await DatabaseService.updatePayment(payment.id, {
            status: paymentStatus,
            paypal_payment_id: details.captureId,
            callback_data: { ...details },
            completed_at: paymentStatus === 'completed' ? new Date().toISOString() : undefined,
          });
        } else {
          paymentStatus = 'failed';
          await DatabaseService.updatePayment(payment.id, {
            status: 'failed',
            callback_data: { error: (captureError as Error).message },
          });
          return res.redirect(`${frontendUrl}/dashboard?payment=failed`);
        }
      }
    }

    const updatedPayment = await DatabaseService.getPaymentById(payment.id);
    if (!updatedPayment) {
      return res.redirect(`${frontendUrl}/dashboard?payment=error`);
    }

    if (paymentStatus === 'completed') {
      const { SubscriptionService } = await import('../services/subscription.service');
      const subscriptionBefore = await DatabaseService.getUserSubscription(payment.user_id);
      await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
      const subscriptionAfter = await DatabaseService.getUserSubscription(payment.user_id);

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
            getTierOrder(newTier as 'free' | 'starter' | 'premium' | 'pro') >
            getTierOrder(oldTier as 'free' | 'starter' | 'premium' | 'pro')
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

      return res.redirect(`${frontendUrl}/dashboard?payment=success`);
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
      return res.redirect(`${frontendUrl}/dashboard?payment=failed`);
    }

    return res.redirect(`${frontendUrl}/dashboard?payment=pending`);
  })
);

/**
 * GET /api/payment/cancel
 * User cancelled on PayPal; redirect to frontend.
 */
router.get(
  '/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const frontendUrl = getFrontendUrl();
    const token = req.query.token as string;
    if (token) {
      let payment = await DatabaseService.getPaymentByPayPalOrderId(token);
      if (!payment) {
        payment = await DatabaseService.getPaymentByPayPalSubscriptionId(token);
      }
      if (payment) {
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
    return res.redirect(`${frontendUrl}/dashboard?payment=cancelled`);
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

    if (authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime) {
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
        logger.warn('PayPal webhook verification failed');
        res.status(200).json({ success: false, message: 'Webhook verification failed' });
        return;
      }
    } else {
      logger.warn('PayPal webhook missing verification headers');
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && resource) {
      const captureId = resource.id as string | undefined;
      if (captureId) {
        const { supabaseAdmin } = await import('../config/database');
        const { data: payments } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('paypal_payment_id', captureId)
          .limit(1);
        const payment = payments?.[0] as Database.Payment | undefined;
        if (payment && payment.status !== 'completed') {
          await DatabaseService.updatePayment(payment.id, {
            status: 'completed',
            callback_data: resource,
            completed_at: new Date().toISOString(),
          });
          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
          logger.info('Payment completed via webhook', { paymentId: payment.id, captureId });
        }
      }
    }

    if (eventType === 'PAYMENT.SALE.COMPLETED' && resource) {
      const billingAgreementId = resource.billing_agreement_id as string | undefined;
      if (billingAgreementId) {
        const { SubscriptionService } = await import('../services/subscription.service');
        await SubscriptionService.handlePayPalSubscriptionRenewal(billingAgreementId, resource);
        logger.info('PayPal subscription renewal processed via webhook', {
          paypalSubscriptionId: billingAgreementId,
        });
      }
    }

    if (
      (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') &&
      resource
    ) {
      const subscriptionId = resource.id as string | undefined;
      if (subscriptionId) {
        const { SubscriptionService } = await import('../services/subscription.service');
        await SubscriptionService.handlePayPalSubscriptionCancelled(
          subscriptionId,
          `PayPal event: ${eventType}`
        );
        logger.info('PayPal subscription cancel/suspend processed via webhook', {
          paypalSubscriptionId: subscriptionId,
          eventType,
        });
      }
    }

    const result = PayPalService.processWebhook(eventType || '', resource || {});
    if (!result.handled) {
      logger.debug('PayPal webhook event not handled', { event_type: eventType });
    }

    res.status(200).json({ success: true, message: 'Webhook received' });
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
          callback_data: details as unknown as Record<string, unknown>,
          paypal_payment_id: details.captureId,
          completed_at: paymentStatus === 'completed' ? new Date().toISOString() : undefined,
        });
        if (paymentStatus === 'completed') {
          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
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
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { paymentId, amount, reason } = req.body;
    if (!paymentId) {
      throw new ValidationError('Payment ID is required');
    }

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

export default router;
