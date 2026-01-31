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

    const { tier, firstName, lastName, email, recurring = false, billing_period: bp, return_url, prefer_card } = req.body;
    
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
    });

    if (!tier || !['starter', 'premium', 'pro', 'enterprise'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be "starter", "premium", "pro", or "enterprise"');
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
    if (!['USD', 'UGX'].includes(currency.toUpperCase())) {
      throw new ValidationError('Invalid currency. Must be "USD" or "UGX"');
    }
    
    const normalizedCurrency = currency.toUpperCase() as 'UGX' | 'USD';

    const { getPricing } = await import('../constants/pricing');
    const amount = getPricing(
      tier as 'starter' | 'premium' | 'pro' | 'enterprise',
      normalizedCurrency,
      billingPeriod
    );
    
    // Validate amount is greater than 0
    if (amount <= 0) {
      logger.error('Invalid payment amount', { tier, currency: normalizedCurrency, billingPeriod, amount });
      throw new ValidationError(`Invalid payment amount for tier "${tier}". Please contact support.`);
    }
    
    logger.info('Payment initiation request', {
      userId,
      tier,
      currency: normalizedCurrency,
      billingPeriod,
      amount,
      recurring,
      firstName: firstName ? 'provided' : 'missing',
      lastName: lastName ? 'provided' : 'missing',
      email: email ? 'provided' : 'missing',
    });

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
        tier: tier as 'starter' | 'premium' | 'pro' | 'enterprise',
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
        currency: normalizedCurrency,
        status: 'pending',
        payment_description: `QueryAI ${tier} subscription (${billingPeriod}, recurring)`,
        callback_data: { 
          billing_period: billingPeriod,
          return_url: return_url || undefined, // Store return URL for redirect after payment
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
        preferCard: prefer_card === true, // Pass card preference to PayPal service
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
        return_url: return_url || undefined, // Store return URL for redirect after payment
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
 * Handle PayPal redirect after user approves. Token = order ID (one-time) or subscription ID (recurring).
 * PayPal may send token as: token, PayerID, paymentId, or subscription_id
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const frontendUrl = getFrontendUrl();
    
    // PayPal sends different parameters depending on payment type
    // Try multiple possible parameter names
    const token = 
      (req.query.token as string) || 
      (req.query.PayerID as string) || 
      (req.query.paymentId as string) || 
      (req.query.subscription_id as string) ||
      (req.query.ba_token as string); // Billing agreement token for subscriptions
    
    const orderId = req.query.orderId as string;
    const subscriptionId = req.query.subscription_id as string;

    logger.info('PayPal callback received', { 
      token: token ? 'present' : 'missing',
      orderId: orderId ? 'present' : 'missing',
      subscriptionId: subscriptionId ? 'present' : 'missing',
      query: req.query,
      allQueryParams: Object.keys(req.query),
    });

    // Determine which ID to use for lookup
    let lookupToken = token || orderId || subscriptionId;
    
    if (!lookupToken) {
      logger.warn('PayPal callback missing all token parameters', { query: req.query });
      return res.redirect(`${frontendUrl}/dashboard?payment=error&reason=missing_token`);
    }

    // Try to find payment by order ID or subscription ID
    let payment = await DatabaseService.getPaymentByPayPalOrderId(lookupToken);
    if (!payment) {
      payment = await DatabaseService.getPaymentByPayPalSubscriptionId(lookupToken);
    }
    // Also try with orderId parameter if different
    if (!payment && orderId && orderId !== lookupToken) {
      payment = await DatabaseService.getPaymentByPayPalOrderId(orderId);
    }
    // Also try with subscriptionId parameter if different
    if (!payment && subscriptionId && subscriptionId !== lookupToken) {
      payment = await DatabaseService.getPaymentByPayPalSubscriptionId(subscriptionId);
    }
    
    if (!payment) {
      logger.warn('Payment not found in callback', { 
        lookupToken, 
        orderId, 
        subscriptionId,
        query: req.query 
      });
      // Still redirect but with error info
      return res.redirect(`${frontendUrl}/dashboard?payment=error&reason=payment_not_found`);
    }

    const isRecurring = !!payment.paypal_subscription_id;
    let paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled' = payment.status;

    if (isRecurring) {
      // Recurring: user approved subscription; sync from PayPal and activate
      try {
        const subscriptionLookupId = payment.paypal_subscription_id || lookupToken || subscriptionId;
        const subDetails = await PayPalService.getSubscription(subscriptionLookupId);
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
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);

          logger.info('PayPal subscription activated', {
            paymentId: payment.id,
            subscriptionId: payment.paypal_subscription_id || lookupToken,
            tier: payment.tier,
          });
        }
      } catch (subError: unknown) {
        logger.error('PayPal subscription sync failed', { 
          paymentId: payment.id, 
          subscriptionId: payment.paypal_subscription_id || lookupToken,
          lookupToken,
          error: subError 
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

      try {
        const orderLookupId = payment.paypal_order_id || lookupToken;
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
          callback_data: callbackData,
          payment_method: result.payerEmail ? 'paypal' : undefined,
          completed_at: new Date().toISOString(),
        });

        logger.info('PayPal payment captured', {
          paymentId: payment.id,
          orderId: orderLookupId,
          captureId,
        });
      } catch (captureError: unknown) {
        const orderLookupId = payment.paypal_order_id || lookupToken;
        logger.error('PayPal capture failed', { 
          paymentId: payment.id, 
          orderId: orderLookupId,
          lookupToken,
          error: captureError 
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
            callback_data: resource,
            completed_at: new Date().toISOString(),
          });
          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
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
            
            if (status === 'ACTIVE' || status === 'APPROVAL_PENDING') {
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
              const currency = (payment.currency || 'USD') as 'UGX' | 'USD';
              const { getAnnualDiscountPercent } = await import('../constants/pricing');
              const annualDiscount = billingPeriod === 'annual'
                ? getAnnualDiscountPercent(payment.tier as 'starter' | 'premium' | 'pro', currency)
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
              await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);

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
