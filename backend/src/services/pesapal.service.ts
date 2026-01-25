import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import config from '../config/env';
import logger from '../config/logger';
import { DatabaseService } from './database.service';
import { SubscriptionService } from './subscription.service';
import { Database } from '../types/database';

/**
 * Pesapal Service
 * Handles Pesapal payment processing integration
 */
export class PesapalService {
  private static apiClient: AxiosInstance;
  private static accessToken: string | null = null;
  private static tokenExpiry: Date | null = null;

  /**
   * Get Pesapal API base URL based on environment
   */
  private static getApiBaseUrl(): string {
    const isProduction = config.PESAPAL_ENVIRONMENT === 'production';
    // Pesapal v3 API endpoints
    return isProduction
      ? 'https://pay.pesapal.com/v3/api'
      : 'https://cybqa.pesapal.com/pesapalv3/api';
  }

  /**
   * Initialize API client
   */
  private static getApiClient(): AxiosInstance {
    if (!this.apiClient) {
      this.apiClient = axios.create({
        baseURL: this.getApiBaseUrl(),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
    }
    return this.apiClient;
  }

  /**
   * Authenticate with Pesapal and get access token
   */
  private static async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Validate credentials are set
    if (!config.PESAPAL_CONSUMER_KEY || !config.PESAPAL_CONSUMER_SECRET) {
      logger.error('Pesapal credentials not configured');
      throw new Error('Pesapal credentials are not configured. Please set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET environment variables.');
    }

    try {
      const client = this.getApiClient();
      const apiUrl = this.getApiBaseUrl();
      logger.info('Attempting Pesapal authentication', {
        environment: config.PESAPAL_ENVIRONMENT,
        apiUrl,
        hasConsumerKey: !!config.PESAPAL_CONSUMER_KEY,
        hasConsumerSecret: !!config.PESAPAL_CONSUMER_SECRET,
      });

      const response = await client.post('/Auth/RequestToken', {
        consumer_key: config.PESAPAL_CONSUMER_KEY,
        consumer_secret: config.PESAPAL_CONSUMER_SECRET,
      });

      logger.info('Pesapal authentication response received', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        responseData: response.data,
      });

      // Pesapal may return token in different formats
      // Try response.data.token first, then response.data, then check if it's a string
      let token: string | null = null;
      
      if (response.data) {
        if (typeof response.data === 'string') {
          token = response.data;
        } else if (response.data.token) {
          token = response.data.token;
        } else if (response.data.access_token) {
          token = response.data.access_token;
        } else if (response.data.data?.token) {
          token = response.data.data.token;
        }
      }

      if (token) {
        this.accessToken = token;
        // Set expiry to 55 minutes (tokens typically last 1 hour)
        this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
        logger.info('Pesapal authentication successful');
        return this.accessToken;
      }

      // Log the full response for debugging
      logger.error('Invalid Pesapal authentication response format', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        dataType: typeof response.data,
      });

      throw new Error('Invalid authentication response from Pesapal: Token not found in response');
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        },
      };
      
      logger.error('Pesapal authentication failed:', errorDetails);
      
      // Provide more helpful error messages
      if (error.response?.status === 401) {
        throw new Error('Pesapal authentication failed: Invalid consumer key or secret. Please verify your Pesapal credentials.');
      } else if (error.response?.status === 400) {
        throw new Error(`Pesapal authentication failed: Bad request. ${error.response?.data?.message || error.message}`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Pesapal authentication failed: Unable to connect to Pesapal API. Please check your network connection and Pesapal service status.');
      } else {
        throw new Error(`Pesapal authentication failed: ${error.response?.data?.message || error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Register IPN (Instant Payment Notification) URL
   */
  static async registerIPN(ipnUrl: string): Promise<string> {
    try {
      const token = await this.authenticate();
      const client = this.getApiClient();

      const response = await client.post(
        '/URLSetup/RegisterIPN',
        {
          url: ipnUrl,
          ipn_notification_type: 'GET',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data && response.data.ipn_id) {
        logger.info('IPN registered successfully', { ipn_id: response.data.ipn_id, url: ipnUrl });
        return response.data.ipn_id;
      }

      throw new Error('Failed to register IPN');
    } catch (error: any) {
      logger.error('Failed to register IPN:', error.response?.data || error.message);
      throw new Error(`Failed to register IPN: ${error.message}`);
    }
  }

  /**
   * Submit order request to Pesapal
   */
  static async submitOrderRequest(params: {
    userId: string;
    tier: 'premium' | 'pro';
    amount: number;
    currency?: string;
    description?: string;
    callbackUrl: string;
    cancellationUrl: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  }): Promise<{
    order_tracking_id: string;
    merchant_reference: string;
    redirect_url: string;
  }> {
    try {
      const token = await this.authenticate();
      const client = this.getApiClient();

      // Generate unique merchant reference
      const merchantReference = `QUERYAI-${params.userId}-${Date.now()}`;

      // Amount should be provided, but validate currency
      const currency = params.currency || 'UGX';
      if (!['UGX', 'USD'].includes(currency)) {
        throw new Error('Invalid currency. Must be UGX or USD');
      }
      const amount = params.amount;

      // Determine country code based on currency
      // UGX = Uganda, USD can be used from multiple countries, default to UG for Uganda
      const countryCode = currency === 'UGX' ? 'UG' : 'UG';

      const orderData = {
        id: merchantReference,
        currency: currency,
        amount: amount,
        description: params.description || `QueryAI ${params.tier} subscription`,
        callback_url: params.callbackUrl,
        cancellation_url: params.cancellationUrl,
        notification_id: '', // Will be set after IPN registration
        billing_address: {
          email_address: params.email,
          phone_number: params.phoneNumber || '',
          country_code: countryCode,
          first_name: params.firstName,
          middle_name: '',
          last_name: params.lastName,
          line_1: '',
          line_2: '',
          city: '',
          state: '',
          postal_code: '',
          zip_code: '',
        },
        // Optional: Add IPN notification ID if registered
        // notification_id: '', // Can be set if IPN is registered
      };

      logger.info('Submitting order to Pesapal', {
        merchantReference,
        amount,
        currency,
        tier: params.tier,
      });

      const response = await client.post('/Transactions/SubmitOrderRequest', orderData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      logger.info('Pesapal order submission response received', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        responseData: response.data,
      });

      // Pesapal may return data in different formats
      // Try multiple possible response structures
      let orderTrackingId: string | null = null;
      let redirectUrl: string | null = null;

      if (response.data) {
        // Try direct properties first
        orderTrackingId = response.data.order_tracking_id || 
                         response.data.orderTrackingId ||
                         response.data.OrderTrackingId ||
                         response.data.data?.order_tracking_id ||
                         response.data.data?.orderTrackingId;
        
        redirectUrl = response.data.redirect_url ||
                     response.data.redirectUrl ||
                     response.data.RedirectUrl ||
                     response.data.data?.redirect_url ||
                     response.data.data?.redirectUrl;
      }

      if (orderTrackingId) {
        logger.info('Order submitted to Pesapal successfully', {
          order_tracking_id: orderTrackingId,
          merchant_reference: merchantReference,
          hasRedirectUrl: !!redirectUrl,
        });

        return {
          order_tracking_id: orderTrackingId,
          merchant_reference: merchantReference,
          redirect_url: redirectUrl || '',
        };
      }

      // Log the full response for debugging
      logger.error('Invalid Pesapal order submission response format', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        dataType: typeof response.data,
        expectedFields: ['order_tracking_id', 'redirect_url'],
      });

      throw new Error('Invalid response from Pesapal: Order tracking ID not found in response');
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
        },
      };
      
      logger.error('Failed to submit order to Pesapal:', errorDetails);
      
      // Provide more helpful error messages
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error?.message ||
                           JSON.stringify(error.response?.data);
        throw new Error(`Failed to submit order: Bad request. ${errorMessage}`);
      } else if (error.response?.status === 401) {
        throw new Error('Failed to submit order: Authentication failed. Please check Pesapal credentials.');
      } else if (error.response?.status === 422) {
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error?.message ||
                           'Validation error';
        throw new Error(`Failed to submit order: Invalid order data. ${errorMessage}`);
      } else {
        throw new Error(`Failed to submit order: ${error.response?.data?.message || error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Get transaction status from Pesapal
   */
  static async getTransactionStatus(orderTrackingId: string): Promise<{
    payment_status: string;
    payment_method: string;
    amount: number;
    currency: string;
  }> {
    try {
      const token = await this.authenticate();
      const client = this.getApiClient();

      const response = await client.get(`/Transactions/GetTransactionStatus?OrderTrackingId=${orderTrackingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data) {
        return {
          payment_status: response.data.payment_status_description || response.data.payment_status || 'UNKNOWN',
          payment_method: response.data.payment_method || '',
          amount: parseFloat(response.data.amount || '0'),
          currency: response.data.currency || 'UGX',
        };
      }

      throw new Error('Invalid response from Pesapal');
    } catch (error: any) {
      logger.error('Failed to get transaction status:', error.response?.data || error.message);
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature (if Pesapal provides one)
   */
  static verifyWebhookSignature(data: any, signature: string): boolean {
    // Pesapal may provide webhook verification
    // For now, we'll verify by checking the order tracking ID exists in our database
    // In production, implement proper signature verification if Pesapal provides it
    return true; // Placeholder - implement actual verification
  }

  /**
   * Process payment webhook
   */
  static async processWebhook(webhookData: {
    OrderTrackingId: string;
    OrderMerchantReference: string;
    OrderNotificationType: string;
    PaymentStatusDescription?: string;
    PaymentMethod?: string;
    Amount?: number;
    Currency?: string;
  }): Promise<Database.Payment | null> {
    try {
      logger.info('Processing Pesapal webhook', webhookData);

      // Find payment by merchant reference or order tracking ID
      const payment = await DatabaseService.getPaymentByMerchantReference(
        webhookData.OrderMerchantReference
      ) || await DatabaseService.getPaymentByOrderTrackingId(webhookData.OrderTrackingId);

      if (!payment) {
        logger.warn('Payment not found for webhook', {
          merchant_reference: webhookData.OrderMerchantReference,
          order_tracking_id: webhookData.OrderTrackingId,
        });
        return null;
      }

      // Update payment status
      const status = this.mapPesapalStatusToPaymentStatus(webhookData.PaymentStatusDescription || '');
      const updateData: Partial<Database.Payment> = {
        status,
        webhook_data: webhookData as any,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.payment_method = webhookData.PaymentMethod || undefined;
      }

      const updatedPayment = await DatabaseService.updatePayment(payment.id, updateData);

      // If payment completed, update subscription
      if (status === 'completed' && payment.user_id) {
        await SubscriptionService.updateSubscriptionTier(payment.user_id, payment.tier);
        logger.info('Subscription updated after successful payment', {
          userId: payment.user_id,
          tier: payment.tier,
          paymentId: payment.id,
        });
      }

      return updatedPayment;
    } catch (error: any) {
      logger.error('Failed to process webhook:', error);
      throw error;
    }
  }

  /**
   * Map Pesapal payment status to our payment status
   */
  private static mapPesapalStatusToPaymentStatus(pesapalStatus: string): 'pending' | 'completed' | 'failed' | 'cancelled' {
    const status = pesapalStatus.toUpperCase();
    
    if (status.includes('COMPLETED') || status.includes('SUCCESS')) {
      return 'completed';
    }
    if (status.includes('FAILED') || status.includes('ERROR')) {
      return 'failed';
    }
    if (status.includes('CANCELLED') || status.includes('CANCEL')) {
      return 'cancelled';
    }
    return 'pending';
  }
}
