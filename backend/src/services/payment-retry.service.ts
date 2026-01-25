import { DatabaseService } from './database.service';
import { SubscriptionService } from './subscription.service';
import { PesapalService } from './pesapal.service';
import logger from '../config/logger';
import { Database } from '../types/database';

/**
 * Payment Retry Service
 * Handles automatic retry of failed payments with grace periods
 */
export class PaymentRetryService {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS = [24 * 60 * 60 * 1000, 48 * 60 * 60 * 1000, 72 * 60 * 60 * 1000]; // 1, 2, 3 days
  private static readonly GRACE_PERIOD_DAYS = 7; // 7 days grace period

  /**
   * Process failed payments and retry if applicable
   */
  static async processFailedPayments(): Promise<void> {
    try {
      // Get all failed payments that haven't exceeded max retries
      const { supabaseAdmin } = await import('../config/database');
      
      const { data: failedPayments, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('status', 'failed')
        .or(`retry_count.is.null,retry_count.lt.${this.MAX_RETRY_ATTEMPTS}`)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch failed payments:', error);
        return;
      }

      if (!failedPayments || failedPayments.length === 0) {
        logger.info('No failed payments to process');
        return;
      }

      for (const payment of failedPayments) {
        try {
          await this.processPaymentRetry(payment as Database.Payment);
        } catch (error) {
          logger.error('Failed to process payment retry:', {
            paymentId: payment.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to process failed payments:', error);
    }
  }

  /**
   * Process retry for a single failed payment
   */
  private static async processPaymentRetry(payment: Database.Payment): Promise<void> {
    const retryCount = payment.retry_count || 0;
    const lastRetryAt = payment.last_retry_at ? new Date(payment.last_retry_at) : new Date(payment.created_at);
    const now = new Date();
    const timeSinceLastRetry = now.getTime() - lastRetryAt.getTime();

    // Check if enough time has passed since last retry
    if (retryCount > 0 && timeSinceLastRetry < this.RETRY_DELAYS[retryCount - 1]) {
      logger.debug('Payment retry not yet due', {
        paymentId: payment.id,
        retryCount,
        timeSinceLastRetry,
        requiredDelay: this.RETRY_DELAYS[retryCount - 1],
      });
      return;
    }

    // Check if we've exceeded max retries
    if (retryCount >= this.MAX_RETRY_ATTEMPTS) {
      logger.info('Payment exceeded max retry attempts, checking grace period', {
        paymentId: payment.id,
        retryCount,
      });

      // Check grace period
      await this.checkGracePeriod(payment);
      return;
    }

    // Attempt to get latest status from Pesapal
    if (payment.pesapal_order_tracking_id) {
      try {
        const status = await PesapalService.getTransactionStatus(payment.pesapal_order_tracking_id);
        const paymentStatus = PesapalService['mapPesapalStatusToPaymentStatus'](status.payment_status);

        if (paymentStatus === 'completed') {
          // Payment succeeded on retry
          await DatabaseService.updatePayment(payment.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            payment_method: status.payment_method,
            retry_count: retryCount + 1,
            last_retry_at: now.toISOString(),
          });

          // Update subscription
          await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);

          logger.info('Payment succeeded on retry', {
            paymentId: payment.id,
            retryCount: retryCount + 1,
          });
        } else if (paymentStatus === 'failed') {
          // Still failed, increment retry count
          await DatabaseService.updatePayment(payment.id, {
            retry_count: retryCount + 1,
            last_retry_at: now.toISOString(),
          });

          logger.info('Payment retry failed, incrementing retry count', {
            paymentId: payment.id,
            retryCount: retryCount + 1,
          });
        }
      } catch (error) {
        logger.error('Failed to check payment status on retry:', {
          paymentId: payment.id,
          error,
        });
      }
    }
  }

  /**
   * Check grace period for failed payments
   */
  private static async checkGracePeriod(payment: Database.Payment): Promise<void> {
    const subscription = await DatabaseService.getUserSubscription(payment.user_id);
    if (!subscription || subscription.tier === 'free') {
      return; // Already free tier
    }

    const now = new Date();
    const paymentDate = new Date(payment.created_at);
    const gracePeriodEnd = new Date(paymentDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + this.GRACE_PERIOD_DAYS);

    // Update grace period end if not set
    if (!subscription.grace_period_end) {
      await DatabaseService.updateSubscription(payment.user_id, {
        grace_period_end: gracePeriodEnd.toISOString(),
      });
    }

    // Check if grace period has expired
    if (now > gracePeriodEnd) {
      // Grace period expired, downgrade to free
      logger.info('Grace period expired, downgrading subscription', {
        userId: payment.user_id,
        paymentId: payment.id,
        gracePeriodEnd,
      });

      await SubscriptionService.downgradeSubscription(payment.user_id, 'free', true);

      // Clear grace period
      await DatabaseService.updateSubscription(payment.user_id, {
        grace_period_end: undefined,
      });
    } else {
      logger.info('Subscription in grace period', {
        userId: payment.user_id,
        gracePeriodEnd,
        daysRemaining: Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      });
    }
  }

  /**
   * Get payments that need retry
   */
  static async getPaymentsNeedingRetry(): Promise<Database.Payment[]> {
    try {
      const { supabaseAdmin } = await import('../config/database');
      
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('status', 'failed')
        .or(`retry_count.is.null,retry_count.lt.${this.MAX_RETRY_ATTEMPTS}`)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch payments needing retry:', error);
        return [];
      }

      return (data || []) as Database.Payment[];
    } catch (error) {
      logger.error('Failed to get payments needing retry:', error);
      return [];
    }
  }
}
