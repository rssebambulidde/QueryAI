import { Router, Request, Response } from 'express';
import { PesapalService } from '../services/pesapal.service';
import { DatabaseService } from '../services/database.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import logger from '../config/logger';
import config from '../config/env';

const router = Router();

/**
 * POST /api/payment/initiate
 * Initiate a payment for subscription upgrade
 */
router.post(
  '/initiate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { tier, firstName, lastName, email, phoneNumber } = req.body;

    if (!tier || !['premium', 'pro'].includes(tier)) {
      throw new ValidationError('Invalid tier. Must be "premium" or "pro"');
    }

    if (!firstName || !lastName || !email) {
      throw new ValidationError('Missing required fields: firstName, lastName, email');
    }

    // Get user profile for additional info
    const userProfile = await DatabaseService.getUserProfile(userId);
    if (!userProfile) {
      throw new ValidationError('User profile not found');
    }

    // Get subscription to link payment
    const subscription = await DatabaseService.getUserSubscription(userId);

    // Get currency from request (default to UGX)
    const currency = req.body.currency || 'UGX';
    if (!['UGX', 'USD'].includes(currency)) {
      throw new ValidationError('Invalid currency. Must be "UGX" or "USD"');
    }

    // Tier pricing in UGX and USD
    const tierPricing: Record<'premium' | 'pro', Record<'UGX' | 'USD', number>> = {
      premium: { UGX: 50000, USD: 15 },
      pro: { UGX: 150000, USD: 45 },
    };
    const amount = tierPricing[tier as 'premium' | 'pro'][currency as 'UGX' | 'USD'];

    // Build callback URLs - use production URL, not localhost
    // In production, API_BASE_URL should be set to Railway URL
    const baseUrl = config.API_BASE_URL || (config.NODE_ENV === 'production' 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'queryai-production.up.railway.app'}`
      : 'http://localhost:3001');
    const callbackUrl = `${baseUrl}/api/payment/callback`;
    const cancellationUrl = `${baseUrl}/api/payment/cancel`;

    try {
      // Submit order to Pesapal
      const orderResponse = await PesapalService.submitOrderRequest({
        userId,
        tier,
        amount,
        currency: currency as 'UGX' | 'USD',
        description: `QueryAI ${tier} subscription`,
        callbackUrl,
        cancellationUrl,
        firstName,
        lastName,
        email: email || userProfile.email,
        phoneNumber: phoneNumber || undefined,
      });

      // Check if user wants recurring payment
      const { recurring = false } = req.body;

      // Create payment record
      const payment = await DatabaseService.createPayment({
        user_id: userId,
        subscription_id: subscription?.id,
        pesapal_order_tracking_id: orderResponse.order_tracking_id,
        pesapal_merchant_reference: orderResponse.merchant_reference,
        tier,
        amount,
        currency: currency as 'UGX' | 'USD',
        status: 'pending',
        payment_description: `QueryAI ${tier} subscription${recurring ? ' (recurring)' : ''}`,
      });

      // If recurring payment requested, create recurring payment authorization
      if (recurring && orderResponse.order_tracking_id) {
        try {
          const { EmailService } = await import('../services/email.service');
          const recurringResult = await PesapalService.createRecurringPayment({
            userId,
            tier,
            amount,
            currency: currency as 'UGX' | 'USD',
            firstName,
            lastName,
            email: email || userProfile.email,
            phoneNumber: phoneNumber || undefined,
            callbackUrl: `${baseUrl}/api/payment/callback`,
          });

          // Update payment with recurring payment ID
          await DatabaseService.updatePayment(payment.id, {
            recurring_payment_id: recurringResult.recurring_payment_id,
          });

          // Update subscription to enable auto-renew
          if (subscription) {
            await DatabaseService.updateSubscription(userId, {
              auto_renew: true,
            });
          }

          logger.info('Recurring payment authorization created', {
            paymentId: payment.id,
            recurringPaymentId: recurringResult.recurring_payment_id,
          });
        } catch (recurringError: any) {
          logger.warn('Failed to create recurring payment, proceeding with one-time payment', recurringError);
          // Continue with one-time payment if recurring fails
        }
      }

      logger.info('Payment initiated', {
        userId,
        tier,
        paymentId: payment.id,
        orderTrackingId: orderResponse.order_tracking_id,
      });

      res.status(200).json({
        success: true,
        data: {
          payment: {
            id: payment.id,
            tier: payment.tier,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
          },
          redirect_url: orderResponse.redirect_url,
          order_tracking_id: orderResponse.order_tracking_id,
        },
      });
    } catch (error: any) {
      logger.error('Failed to initiate payment:', error);
      throw new ValidationError(`Failed to initiate payment: ${error.message}`);
    }
  })
);

/**
 * GET /api/payment/callback
 * Handle payment callback from Pesapal (redirect after payment)
 */
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { OrderTrackingId, OrderMerchantReference } = req.query;

    if (!OrderTrackingId && !OrderMerchantReference) {
      const frontendUrl = config.FRONTEND_URL || process.env.FRONTEND_URL || 
        (config.NODE_ENV === 'production' 
          ? 'https://queryai-frontend.pages.dev'
          : 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/dashboard?payment=error`);
    }

    try {
      // Get payment status from Pesapal
      if (OrderTrackingId) {
        const status = await PesapalService.getTransactionStatus(OrderTrackingId as string);
        
        // Find and update payment
        const payment = await DatabaseService.getPaymentByOrderTrackingId(OrderTrackingId as string);
        if (payment) {
          const paymentStatus = PesapalService['mapPesapalStatusToPaymentStatus'](status.payment_status);
          await DatabaseService.updatePayment(payment.id, {
            status: paymentStatus,
            callback_data: status as any,
          });

          // If completed, update subscription
          if (paymentStatus === 'completed') {
            const { SubscriptionService } = await import('../services/subscription.service');
            await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
          }
        }
      }

      // Redirect to frontend with success status
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const status = OrderTrackingId ? 'success' : 'pending';
      return res.redirect(`${frontendUrl}/dashboard?payment=${status}`);
    } catch (error: any) {
      logger.error('Payment callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/dashboard?payment=error`);
    }
  })
);

/**
 * GET /api/payment/cancel
 * Handle payment cancellation
 */
router.get(
  '/cancel',
  asyncHandler(async (req: Request, res: Response) => {
      const frontendUrl = config.FRONTEND_URL || process.env.FRONTEND_URL || 
        (config.NODE_ENV === 'production' 
          ? 'https://queryai-frontend.pages.dev'
          : 'http://localhost:3000');
      
      // Send payment cancellation email notification
      try {
        const { EmailService } = await import('../services/email.service');
        const userProfile = await DatabaseService.getUserProfile(payment.user_id);
        if (userProfile && payment) {
          await EmailService.sendPaymentCancellationEmail(
            userProfile.email,
            userProfile.full_name || userProfile.email,
            payment
          );
        }
      } catch (emailError) {
        logger.error('Failed to send payment cancellation email:', emailError);
        // Don't fail the redirect if email fails
      }
      
      return res.redirect(`${frontendUrl}/dashboard?payment=cancelled`);
  })
);

/**
 * POST /api/payment/webhook
 * Handle Pesapal webhook (IPN - Instant Payment Notification)
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const webhookData = req.body;

      logger.info('Received Pesapal webhook', {
        orderTrackingId: webhookData.OrderTrackingId,
        merchantReference: webhookData.OrderMerchantReference,
        notificationType: webhookData.OrderNotificationType,
      });

      // Verify webhook authenticity
      const isValid = await PesapalService.verifyWebhookSignature(webhookData);
      if (!isValid) {
        logger.warn('Webhook verification failed, rejecting webhook', {
          orderTrackingId: webhookData.OrderTrackingId,
          merchantReference: webhookData.OrderMerchantReference,
        });
        // Still return 200 to prevent Pesapal from retrying invalid webhooks
        res.status(200).json({ success: false, message: 'Webhook verification failed' });
        return;
      }

      // Process webhook
      const payment = await PesapalService.processWebhook(webhookData);

      if (payment) {
        logger.info('Webhook processed successfully', {
          paymentId: payment.id,
          status: payment.status,
        });
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error: any) {
      logger.error('Webhook processing error:', error);
      // Still return 200 to prevent Pesapal from retrying
      res.status(200).json({ success: false, error: error.message });
    }
  })
);

/**
 * GET /api/payment/status/:orderTrackingId
 * Get payment status by order tracking ID
 */
router.get(
  '/status/:orderTrackingId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { orderTrackingId } = req.params;
    const trackingId = Array.isArray(orderTrackingId) ? orderTrackingId[0] : orderTrackingId;

    if (!trackingId) {
      throw new ValidationError('Order tracking ID is required');
    }

    // Get payment from database
    const payment = await DatabaseService.getPaymentByOrderTrackingId(trackingId);

    if (!payment) {
      throw new ValidationError('Payment not found');
    }

    // Verify payment belongs to user
    if (payment.user_id !== userId) {
      throw new ValidationError('Unauthorized');
    }

    // Get latest status from Pesapal
    try {
      const pesapalStatus = await PesapalService.getTransactionStatus(trackingId);
      
      // Update payment if status changed
      const paymentStatus = PesapalService['mapPesapalStatusToPaymentStatus'](pesapalStatus.payment_status);
      if (payment.status !== paymentStatus) {
        await DatabaseService.updatePayment(payment.id, {
          status: paymentStatus,
          callback_data: pesapalStatus as any,
        });

        // If completed, update subscription
        if (paymentStatus === 'completed') {
          const { SubscriptionService } = await import('../services/subscription.service');
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          payment: {
            ...payment,
            status: paymentStatus,
          },
          pesapal_status: pesapalStatus,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get payment status:', error);
      // Return payment from database even if Pesapal call fails
      res.status(200).json({
        success: true,
        data: {
          payment,
        },
      });
    }
  })
);

/**
 * GET /api/payment/history
 * Get user's payment history
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
      data: {
        payments,
      },
    });
  })
);

/**
 * POST /api/payment/refund
 * Process refund for a payment
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

    // Get payment
    const payment = await DatabaseService.getPaymentById(paymentId);
    if (!payment) {
      throw new ValidationError('Payment not found');
    }

    // Verify payment belongs to user
    if (payment.user_id !== userId) {
      throw new ValidationError('Unauthorized');
    }

    // Only allow refunds for completed payments
    if (payment.status !== 'completed') {
      throw new ValidationError('Only completed payments can be refunded');
    }

    // Calculate refund amount (default to full amount)
    const refundAmount = amount || payment.amount;

    // Validate refund amount
    if (refundAmount > payment.amount) {
      throw new ValidationError('Refund amount cannot exceed payment amount');
    }

    if (payment.refund_amount && (refundAmount + (payment.refund_amount || 0)) > payment.amount) {
      throw new ValidationError('Total refund amount cannot exceed payment amount');
    }

    try {
      // Process refund through Pesapal
      if (!payment.pesapal_order_tracking_id) {
        throw new ValidationError('Payment tracking ID not found');
      }

      const refundResult = await PesapalService.processRefund({
        orderTrackingId: payment.pesapal_order_tracking_id,
        amount: refundAmount,
        currency: payment.currency,
        reason: reason || 'Customer request',
      });

      // Create refund record
      const refund = await DatabaseService.createRefund({
        payment_id: paymentId,
        user_id: userId,
        amount: refundAmount,
        currency: payment.currency,
        reason: reason,
        pesapal_refund_id: refundResult.refund_id,
        status: refundResult.status === 'completed' ? 'completed' : 'pending',
      });

      // Update payment with refund information
      const totalRefunded = (payment.refund_amount || 0) + refundAmount;
      await DatabaseService.updatePayment(paymentId, {
        refund_amount: totalRefunded,
        refund_reason: reason,
        refunded_at: refundResult.status === 'completed' ? new Date().toISOString() : undefined,
      });

      logger.info('Refund processed', {
        paymentId,
        refundId: refund?.id,
        amount: refundAmount,
        status: refundResult.status,
      });

      res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refund: refund,
          refund_status: refundResult.status,
        },
      });
    } catch (error: any) {
      logger.error('Failed to process refund:', error);
      throw new ValidationError(`Failed to process refund: ${error.message}`);
    }
  })
);

/**
 * GET /api/payment/ipn-list
 * Get list of registered IPN URLs
 */
router.get(
  '/ipn-list',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Only allow admin users (for now, you can add admin check)
    // For production, add proper admin role checking

    try {
      const ipnList = await PesapalService.getIPNList();

      res.status(200).json({
        success: true,
        data: {
          ipn_list: ipnList,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get IPN list:', error);
      throw new ValidationError(`Failed to get IPN list: ${error.message}`);
    }
  })
);

/**
 * DELETE /api/payment/ipn/:ipnId
 * Delete an IPN URL
 */
router.delete(
  '/ipn/:ipnId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Only allow admin users (for now, you can add admin check)

    const { ipnId } = req.params;
    const id = Array.isArray(ipnId) ? ipnId[0] : ipnId;

    if (!id) {
      throw new ValidationError('IPN ID is required');
    }

    try {
      const deleted = await PesapalService.deleteIPN(id);

      if (deleted) {
        res.status(200).json({
          success: true,
          message: 'IPN URL deleted successfully',
        });
      } else {
        throw new ValidationError('Failed to delete IPN URL');
      }
    } catch (error: any) {
      logger.error('Failed to delete IPN:', error);
      throw new ValidationError(`Failed to delete IPN: ${error.message}`);
    }
  })
);

export default router;
