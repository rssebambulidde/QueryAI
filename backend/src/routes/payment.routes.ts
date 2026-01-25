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

    // Tier pricing (in KES)
    const tierPricing: Record<'premium' | 'pro', number> = {
      premium: 5000,
      pro: 15000,
    };
    const amount = tierPricing[tier as 'premium' | 'pro'];

    // Build callback URLs
    const baseUrl = config.API_BASE_URL || 'http://localhost:3001';
    const callbackUrl = `${baseUrl}/api/payment/callback`;
    const cancellationUrl = `${baseUrl}/api/payment/cancel`;

    try {
      // Submit order to Pesapal
      const orderResponse = await PesapalService.submitOrderRequest({
        userId,
        tier,
        amount,
        currency: 'KES',
        description: `QueryAI ${tier} subscription`,
        callbackUrl,
        cancellationUrl,
        firstName,
        lastName,
        email: email || userProfile.email,
        phoneNumber: phoneNumber || undefined,
      });

      // Create payment record
      const payment = await DatabaseService.createPayment({
        user_id: userId,
        subscription_id: subscription?.id,
        pesapal_order_tracking_id: orderResponse.order_tracking_id,
        pesapal_merchant_reference: orderResponse.merchant_reference,
        tier,
        amount,
        currency: 'KES',
        status: 'pending',
        payment_description: `QueryAI ${tier} subscription`,
      });

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
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?payment=error`);
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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

      logger.info('Received Pesapal webhook', webhookData);

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

export default router;
