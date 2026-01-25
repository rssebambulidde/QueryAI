import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';

/**
 * Database service for common database operations
 */
export class DatabaseService {
  /**
   * Create a user profile when a user signs up
   */
  static async createUserProfile(
    userId: string,
    email: string,
    fullName?: string
  ): Promise<Database.UserProfile | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          email,
          full_name: fullName,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating user profile:', error);
        throw error;
      }

      logger.info(`User profile created for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to create user profile:', error);
      return null;
    }
  }

  /**
   * Get user profile by ID
   */
  static async getUserProfile(
    userId: string
  ): Promise<Database.UserProfile | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        logger.error('Error fetching user profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(
    userId: string,
    updates: Partial<Database.UserProfile>
  ): Promise<Database.UserProfile | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating user profile:', error);
        throw error;
      }

      logger.info(`User profile updated for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to update user profile:', error);
      return null;
    }
  }

  /**
   * Get user subscription
   */
  static async getUserSubscription(
    userId: string
  ): Promise<Database.Subscription | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found - create default free subscription
          return await this.createDefaultSubscription(userId);
        }
        logger.error('Error fetching subscription:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get user subscription:', error);
      return null;
    }
  }

  /**
   * Create default free subscription for a user
   */
  static async createDefaultSubscription(
    userId: string
  ): Promise<Database.Subscription | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier: 'free',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(), // 30 days from now
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating default subscription:', error);
        throw error;
      }

      logger.info(`Default free subscription created for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to create default subscription:', error);
      return null;
    }
  }

  /**
   * Log usage
   */
  static async logUsage(
    userId: string,
    type: 'query' | 'api_call' | 'document_upload',
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin.from('usage_logs').insert({
        user_id: userId,
        type,
        metadata: metadata || {},
      });

      if (error) {
        logger.error('Error logging usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to log usage:', error);
      return false;
    }
  }

  /**
   * Update user subscription
   */
  static async updateSubscription(
    userId: string,
    updates: Partial<Database.Subscription>
  ): Promise<Database.Subscription | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating subscription:', error);
        throw error;
      }

      logger.info(`Subscription updated for user: ${userId}`);
      return data;
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      return null;
    }
  }

  /**
   * Get usage count for a user in current period
   */
  static async getUserUsageCount(
    userId: string,
    type: 'query' | 'api_call' | 'document_upload',
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    try {
      const query = supabaseAdmin
        .from('usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', type);

      if (startDate) {
        query.gte('created_at', startDate.toISOString());
      }
      
      if (endDate) {
        query.lte('created_at', endDate.toISOString());
      }

      const { count, error } = await query;

      if (error) {
        logger.error('Error getting usage count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('Failed to get usage count:', error);
      return 0;
    }
  }

  /**
   * Create a payment record
   */
  static async createPayment(payment: Omit<Database.Payment, 'id' | 'created_at' | 'updated_at'>): Promise<Database.Payment> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .insert({
          ...payment,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating payment:', error);
        throw error;
      }

      return data as Database.Payment;
    } catch (error) {
      logger.error('Failed to create payment:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  static async getPaymentById(paymentId: string): Promise<Database.Payment | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Error getting payment:', error);
        throw error;
      }

      return data as Database.Payment;
    } catch (error) {
      logger.error('Failed to get payment:', error);
      return null;
    }
  }

  /**
   * Get payment by merchant reference
   */
  static async getPaymentByMerchantReference(merchantReference: string): Promise<Database.Payment | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('pesapal_merchant_reference', merchantReference)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Error getting payment by merchant reference:', error);
        throw error;
      }

      return data as Database.Payment;
    } catch (error) {
      logger.error('Failed to get payment by merchant reference:', error);
      return null;
    }
  }

  /**
   * Get payment by order tracking ID
   */
  static async getPaymentByOrderTrackingId(orderTrackingId: string): Promise<Database.Payment | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('pesapal_order_tracking_id', orderTrackingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Error getting payment by order tracking ID:', error);
        throw error;
      }

      return data as Database.Payment;
    } catch (error) {
      logger.error('Failed to get payment by order tracking ID:', error);
      return null;
    }
  }

  /**
   * Get user payments
   */
  static async getUserPayments(userId: string, limit = 50): Promise<Database.Payment[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error getting user payments:', error);
        throw error;
      }

      return (data || []) as Database.Payment[];
    } catch (error) {
      logger.error('Failed to get user payments:', error);
      return [];
    }
  }

  /**
   * Update payment
   */
  /**
   * Log subscription history change
   */
  static async logSubscriptionHistory(
    subscriptionId: string,
    userId: string,
    changeType: 'tier_change' | 'status_change' | 'period_change' | 'cancellation' | 'reactivation' | 'renewal',
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>,
    reason?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin.from('subscription_history').insert({
        subscription_id: subscriptionId,
        user_id: userId,
        change_type: changeType,
        old_value: oldValue || null,
        new_value: newValue || null,
        reason: reason || null,
      });

      if (error) {
        logger.error('Error logging subscription history:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to log subscription history:', error);
      return false;
    }
  }

  /**
   * Get subscription history for a user
   */
  static async getSubscriptionHistory(userId: string): Promise<Database.SubscriptionHistory[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscription_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching subscription history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get subscription history:', error);
      return [];
    }
  }

  /**
   * Create refund record
   */
  static async createRefund(refundData: {
    payment_id: string;
    user_id: string;
    amount: number;
    currency: string;
    reason?: string;
    pesapal_refund_id?: string;
    status?: 'pending' | 'completed' | 'failed';
    refund_data?: Record<string, any>;
  }): Promise<Database.Refund | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('refunds')
        .insert({
          ...refundData,
          status: refundData.status || 'pending',
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating refund:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to create refund:', error);
      return null;
    }
  }

  /**
   * Get refunds for a user
   */
  static async getUserRefunds(userId: string): Promise<Database.Refund[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('refunds')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching refunds:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get refunds:', error);
      return [];
    }
  }

  /**
   * Update refund status
   */
  static async updateRefund(
    refundId: string,
    updates: Partial<Database.Refund>
  ): Promise<Database.Refund | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('refunds')
        .update(updates)
        .eq('id', refundId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating refund:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to update refund:', error);
      return null;
    }
  }

  static async updatePayment(
    paymentId: string,
    updates: Partial<Database.Payment>
  ): Promise<Database.Payment | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating payment:', error);
        throw error;
      }

      return data as Database.Payment;
    } catch (error) {
      logger.error('Failed to update payment:', error);
      return null;
    }
  }
}
