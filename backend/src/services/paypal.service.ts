/**
 * PayPal Service
 * Handles PayPal payment and subscription processing (PayPal-only provider).
 * Uses @paypal/paypal-server-sdk (v2) for Orders, Payments, Subscriptions.
 * Webhook verification uses REST (fetch) – SDK does not expose it.
 */

import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  SubscriptionsController,
  CheckoutPaymentIntent,
  PatchOp,
  ApiError,
  OrderApplicationContextUserAction,
} from '@paypal/paypal-server-sdk';
import config from '../config/env';
import logger from '../config/logger';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** PayPal REST base URL (for webhook verify only) */
function getBaseUrl(): string {
  return config.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/** Cached SDK client and controllers */
let client: Client | null = null;
let ordersController: OrdersController | null = null;
let paymentsController: PaymentsController | null = null;
let subscriptionsController: SubscriptionsController | null = null;

function getClient(): Client {
  if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) {
    logger.error('PayPal credentials not configured');
    throw new Error(
      'PayPal credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.'
    );
  }
  if (!client) {
    client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: config.PAYPAL_CLIENT_ID,
        oAuthClientSecret: config.PAYPAL_CLIENT_SECRET,
      },
      environment:
        config.PAYPAL_MODE === 'live' ? Environment.Production : Environment.Sandbox,
      timeout: 0,
    });
    ordersController = new OrdersController(client);
    paymentsController = new PaymentsController(client);
    subscriptionsController = new SubscriptionsController(client);
  }
  return client;
}

function orders(): OrdersController {
  getClient();
  return ordersController!;
}

function payments(): PaymentsController {
  getClient();
  return paymentsController!;
}

function subscriptions(): SubscriptionsController {
  getClient();
  return subscriptionsController!;
}

/** OAuth2 token for webhook verification (REST only). */
let accessToken: string | null = null;
let tokenExpiry: Date | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
    return accessToken;
  }
  const baseUrl = getBaseUrl();
  const auth = Buffer.from(
    `${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error('PayPal OAuth failed', { status: res.status, body });
    throw new Error(`PayPal OAuth failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
  return accessToken;
}

function statusCodeFromError(e: unknown): number | undefined {
  if (e instanceof ApiError) return e.statusCode;
  return (e as { statusCode?: number })?.statusCode;
}

/** Retry wrapper for transient failures */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = statusCodeFromError(e);
      const isRetryable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        (e as Error).message?.includes('ECONNRESET') ||
        (e as Error).message?.includes('ETIMEDOUT');
      if (!isRetryable || i === MAX_RETRIES - 1) throw e;
      logger.warn(`PayPal ${label} retry ${i + 1}/${MAX_RETRIES}`, {
        error: (e as Error).message,
      });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (i + 1)));
    }
  }
  throw lastErr;
}

// --- Orders (one-time payments) ---

export interface CreatePaymentParams {
  amount: number;
  currency: string;
  description?: string;
  custom_id?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatePaymentResult {
  orderId: string;
  approvalUrl: string;
  status: string;
}

/**
 * Create a one-time payment (order). User must approve via approvalUrl, then call executePayment.
 */
export async function createPayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  return withRetry(async () => {
    const value = params.amount.toFixed(2);
    
    // Validate amount is greater than 0
    if (parseFloat(value) <= 0) {
      logger.error('PayPal create order: Invalid amount', { amount: params.amount, value });
      throw new Error('Payment amount must be greater than 0');
    }
    
    // Validate currency code (must be uppercase and valid)
    const currencyCode = params.currency.toUpperCase();
    if (!currencyCode || currencyCode.length !== 3) {
      logger.error('PayPal create order: Invalid currency', { currency: params.currency });
      throw new Error('Invalid currency code');
    }
    
    logger.info('PayPal creating order', {
      amount: value,
      currency: currencyCode,
      description: params.description,
    });
    
    try {
      const response = await orders().createOrder({
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              amount: {
                currencyCode,
                value,
              },
              description: params.description ?? undefined,
              customId: params.custom_id ?? undefined,
            },
          ],
          applicationContext: {
            returnUrl: params.returnUrl,
            cancelUrl: params.cancelUrl,
            brandName: 'QueryAI',
            userAction: OrderApplicationContextUserAction.PayNow, // Required for card payments - shows "Pay Now" button and enables card payment option
          },
        },
        prefer: 'return=representation',
      });

      const result = response.result as {
        id: string;
        status: string;
        links?: { rel: string; href: string }[];
      };

      const approveLink = result.links?.find((l) => l.rel === 'approve');
      if (!approveLink?.href) {
        logger.error('PayPal create order missing approve link', { result });
        throw new Error('PayPal create order: missing approval URL');
      }

      logger.info('PayPal order created successfully', {
        orderId: result.id,
        amount: value,
        currency: currencyCode,
        status: result.status,
      });

      return {
        orderId: result.id,
        approvalUrl: approveLink.href,
        status: result.status,
      };
    } catch (error: unknown) {
      // Enhanced error logging for debugging 400 errors
      let statusCode: number | undefined;
      let errorMessage: string | undefined;
      let errorBody: unknown;
      
      // Check if it's a PayPal SDK ApiError
      if (error instanceof ApiError) {
        statusCode = error.statusCode;
        errorMessage = error.message;
        // ApiError from PayPal SDK has a result property with error details
        errorBody = (error as any).result || (error as any).body;
        
        logger.error('PayPal SDK ApiError caught', {
          statusCode,
          message: errorMessage,
          result: errorBody,
          errorName: error.name,
          stack: error.stack,
        });
      } else {
        // Try to extract error details from generic error
        const genericError = error as { statusCode?: number; message?: string; body?: unknown; result?: unknown; response?: { body?: unknown } };
        statusCode = genericError.statusCode;
        errorMessage = genericError.message;
        errorBody = genericError.body || genericError.result || genericError.response?.body;
        
        logger.error('PayPal create order generic error', {
          statusCode,
          message: errorMessage,
          body: errorBody,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      
      // Log request parameters for debugging
      logger.error('PayPal create order error - request context', {
        requestParams: {
          amount: value,
          currency: currencyCode,
          description: params.description,
          returnUrl: params.returnUrl,
          cancelUrl: params.cancelUrl,
        },
      });
      
      // Re-throw with more context if it's a 400 error
      if (statusCode === 400) {
        const message = errorMessage || 'PayPal API returned 400 Bad Request';
        
        // Try to extract detailed error information from PayPal API response
        let detailedError = message;
        if (errorBody) {
          try {
            const bodyStr = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody, null, 2);
            detailedError = `${message}. PayPal API Response: ${bodyStr}`;
            
            // Try to extract specific error details if it's a PayPal error response
            if (typeof errorBody === 'object' && errorBody !== null) {
              const paypalError = errorBody as { details?: Array<{ field?: string; issue?: string; description?: string }>; name?: string; message?: string };
              if (paypalError.details && Array.isArray(paypalError.details)) {
                const issues = paypalError.details.map(d => `${d.field || 'unknown'}: ${d.issue || d.description || 'unknown issue'}`).join('; ');
                detailedError = `${message}. Issues: ${issues}`;
              } else if (paypalError.name || paypalError.message) {
                detailedError = `${message}. ${paypalError.name || ''}: ${paypalError.message || ''}`;
              }
            }
          } catch (e) {
            detailedError = `${message}. PayPal API Response: ${String(errorBody)}`;
          }
        }
        
        logger.error('PayPal 400 error - final details', {
          detailedError,
          errorBody: typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody, null, 2),
        });
        
        // Create a ValidationError so it returns 400 status code
        const { ValidationError } = await import('../types/error');
        throw new ValidationError(detailedError);
      }
      
      // Re-throw the original error for non-400 errors
      throw error;
    }
  }, 'createPayment');
}

export interface ExecutePaymentResult {
  orderId: string;
  captureId: string;
  status: string;
  amount: string;
  currency: string;
  payerEmail?: string;
  payerName?: string;
}

/**
 * Execute (capture) an approved order. Call after user approves on PayPal.
 */
export async function executePayment(
  orderId: string
): Promise<ExecutePaymentResult> {
  return withRetry(async () => {
    const response = await orders().captureOrder({
      id: orderId,
      prefer: 'return=representation',
    });

    const result = response.result as {
      id: string;
      status: string;
      purchaseUnits?: {
        payments?: {
          captures?: {
            id: string;
            amount?: { currencyCode: string; value: string };
            status?: string;
          }[];
        };
      }[];
      payer?: {
        emailAddress?: string;
        name?: { givenName?: string; surname?: string };
      };
    };

    const pu = result.purchaseUnits?.[0];
    const capture = pu?.payments?.captures?.[0];
    if (!capture?.id) {
      logger.error('PayPal capture missing capture id', { result });
      throw new Error('PayPal capture: missing capture id');
    }

    const amount = capture.amount?.value ?? '0';
    const currency = capture.amount?.currencyCode ?? 'USD';
    const payerName = result.payer?.name
      ? [result.payer.name.givenName, result.payer.name.surname].filter(Boolean).join(' ')
      : undefined;

    logger.info('PayPal order captured', {
      orderId: result.id,
      captureId: capture.id,
      amount,
      currency,
    });

    return {
      orderId: result.id,
      captureId: capture.id,
      status: result.status,
      amount,
      currency,
      payerEmail: result.payer?.emailAddress,
      payerName,
    };
  }, 'executePayment');
}

export interface PaymentDetails {
  orderId: string;
  status: string;
  captureId?: string;
  amount?: string;
  currency?: string;
  createTime?: string;
  updateTime?: string;
}

/**
 * Get payment (order) details.
 */
export async function getPaymentDetails(
  orderId: string
): Promise<PaymentDetails> {
  return withRetry(async () => {
    const response = await orders().getOrder({ id: orderId });
    const result = response.result as {
      id: string;
      status: string;
      createTime?: string;
      updateTime?: string;
      purchaseUnits?: {
        payments?: {
          captures?: {
            id: string;
            amount?: { currencyCode: string; value: string };
          }[];
        };
      }[];
    };

    const pu = result.purchaseUnits?.[0];
    const capture = pu?.payments?.captures?.[0];

    return {
      orderId: result.id,
      status: result.status,
      captureId: capture?.id,
      amount: capture?.amount?.value,
      currency: capture?.amount?.currencyCode,
      createTime: result.createTime,
      updateTime: result.updateTime,
    };
  }, 'getPaymentDetails');
}

export interface RefundPaymentParams {
  captureId: string;
  amount?: number;
  currency?: string;
  note?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  status: string;
}

/**
 * Refund a captured payment (full or partial). Uses PaymentsController.
 */
export async function refundPayment(
  params: RefundPaymentParams
): Promise<RefundPaymentResult> {
  return withRetry(async () => {
    const body: {
      amount?: { currencyCode: string; value: string };
      noteToPayer?: string;
    } = {};
    if (params.amount != null && params.currency) {
      body.amount = {
        currencyCode: params.currency,
        value: params.amount.toFixed(2),
      };
    }
    if (params.note) body.noteToPayer = params.note;

    const response = await payments().refundCapturedPayment({
      captureId: params.captureId,
      body: Object.keys(body).length > 0 ? body : undefined,
      prefer: 'return=representation',
    });

    const result = response.result as { id: string; status: string };

    logger.info('PayPal refund created', {
      refundId: result.id,
      captureId: params.captureId,
      status: result.status,
    });

    return {
      refundId: result.id,
      status: result.status,
    };
  }, 'refundPayment');
}

// --- Subscriptions ---

function getPlanIdForTier(
  tier: 'starter' | 'premium' | 'pro' | 'enterprise',
  billingPeriod: 'monthly' | 'annual' = 'monthly'
): string | undefined {
  if (billingPeriod === 'annual') {
    const annualMap = {
      starter: config.PAYPAL_PLAN_ID_STARTER_ANNUAL,
      premium: config.PAYPAL_PLAN_ID_PREMIUM_ANNUAL,
      pro: config.PAYPAL_PLAN_ID_PRO_ANNUAL,
      enterprise: config.PAYPAL_PLAN_ID_ENTERPRISE_ANNUAL,
    };
    const id = annualMap[tier]?.trim();
    if (id) return id;
    // Fall back to monthly plan if no annual plan configured
  }
  const monthlyMap = {
    starter: config.PAYPAL_PLAN_ID_STARTER,
    premium: config.PAYPAL_PLAN_ID_PREMIUM,
    pro: config.PAYPAL_PLAN_ID_PRO,
    enterprise: config.PAYPAL_PLAN_ID_ENTERPRISE,
  };
  return monthlyMap[tier]?.trim() || undefined;
}

export interface CreateSubscriptionParams {
  tier: 'starter' | 'premium' | 'pro' | 'enterprise';
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
  /** Billing period. Uses annual plan ID when 'annual' and PAYPAL_PLAN_ID_*_ANNUAL set. */
  billing_period?: 'monthly' | 'annual';
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  approvalUrl: string;
  status: string;
}

/**
 * Create a subscription. User must approve via approvalUrl.
 * Plan IDs must be set in env (PAYPAL_PLAN_ID_*) or created via Dashboard.
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResult> {
  const period = params.billing_period ?? 'monthly';
  const planId = getPlanIdForTier(params.tier, period);
  if (!planId) {
    const key = period === 'annual' ? `PAYPAL_PLAN_ID_${params.tier.toUpperCase()}_ANNUAL` : `PAYPAL_PLAN_ID_${params.tier.toUpperCase()}`;
    throw new Error(
      `PayPal plan ID for tier "${params.tier}" (${period}) is not configured. Set ${key} or create plans in PayPal Dashboard.`
    );
  }

  const response = await subscriptions().createSubscription({
    body: {
      planId,
      customId: params.customId ?? undefined,
      applicationContext: {
        returnUrl: params.returnUrl,
        cancelUrl: params.cancelUrl,
        brandName: 'QueryAI',
      },
      autoRenewal: false,
    },
    prefer: 'return=representation',
  });

  const data = response.result as {
    id: string;
    status: string;
    links?: { rel: string; href: string }[];
  };

  const approveLink = data.links?.find((l) => l.rel === 'approve');
  if (!approveLink?.href) {
    logger.error('PayPal create subscription missing approve link', { data });
    throw new Error('PayPal create subscription: missing approval URL');
  }

  logger.info('PayPal subscription created', {
    subscriptionId: data.id,
    tier: params.tier,
    status: data.status,
  });

  return {
    subscriptionId: data.id,
    approvalUrl: approveLink.href,
    status: data.status,
  };
}

export interface SubscriptionDetails {
  subscriptionId: string;
  status: string;
  plan_id?: string;
  start_time?: string;
  next_billing_time?: string;
  custom_id?: string;
}

/**
 * Get subscription details.
 */
export async function getSubscription(
  subscriptionId: string
): Promise<SubscriptionDetails> {
  const response = await subscriptions().getSubscription({ id: subscriptionId });
  const data = response.result as {
    id: string;
    status: string;
    planId?: string;
    startTime?: string;
    billingInfo?: { nextBillingTime?: string };
    customId?: string;
  };

  return {
    subscriptionId: data.id,
    status: data.status,
    plan_id: data.planId,
    start_time: data.startTime,
    next_billing_time: data.billingInfo?.nextBillingTime,
    custom_id: data.customId,
  };
}

/**
 * Cancel a subscription.
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string
): Promise<void> {
  await subscriptions().cancelSubscription({
    id: subscriptionId,
    body: reason ? { reason } : undefined,
  });

  logger.info('PayPal subscription cancelled', { subscriptionId, reason });
}

/**
 * Update subscription (e.g. custom_id). Plan changes typically use revise API.
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: { plan_id?: string; custom_id?: string }
): Promise<SubscriptionDetails> {
  if (!updates.custom_id && !updates.plan_id) {
    return getSubscription(subscriptionId);
  }

  const patches: { op: PatchOp; path: string; value: string }[] = [];
  if (updates.custom_id !== undefined) {
    patches.push({ op: PatchOp.Replace, path: '/custom_id', value: updates.custom_id });
  }
  if (updates.plan_id) {
    patches.push({ op: PatchOp.Replace, path: '/plan_id', value: updates.plan_id });
  }
  if (patches.length === 0) {
    return getSubscription(subscriptionId);
  }

  await subscriptions().patchSubscription({
    id: subscriptionId,
    body: patches,
  });

  return getSubscription(subscriptionId);
}

// --- Webhooks (REST only) ---

export interface WebhookVerifyParams {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: Record<string, unknown>;
}

/**
 * Verify webhook signature using PayPal REST API.
 */
export async function verifyWebhookSignature(
  params: WebhookVerifyParams
): Promise<boolean> {
  const webhookId = config.PAYPAL_WEBHOOK_ID || params.webhookId;
  if (!webhookId) {
    logger.warn('PayPal webhook verification skipped: no PAYPAL_WEBHOOK_ID');
    return false;
  }

  const token = await getAccessToken();
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: webhookId,
      webhook_event: params.webhookEvent,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('PayPal webhook verify request failed', {
      status: res.status,
      body: text,
    });
    return false;
  }

  const data = (await res.json()) as { verification_status?: string };
  const ok = data.verification_status === 'SUCCESS';
  if (!ok) {
    logger.warn('PayPal webhook verification failed', { data });
  }
  return ok;
}

export type WebhookEventType =
  | 'PAYMENT.SALE.COMPLETED'
  | 'BILLING.SUBSCRIPTION.CREATED'
  | 'BILLING.SUBSCRIPTION.UPDATED'
  | 'BILLING.SUBSCRIPTION.CANCELLED'
  | 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
  | 'PAYMENT.CAPTURE.REFUNDED';

export interface ProcessWebhookResult {
  handled: boolean;
  error?: string;
}

/**
 * Process webhook event. Parses event type and payload; does not update DB.
 * Route layer should verify signature first, then call this and persist state.
 */
export function processWebhook(
  eventType: string,
  payload: Record<string, unknown>
): ProcessWebhookResult {
  const type = eventType as WebhookEventType;
  logger.info('PayPal webhook received', { event_type: type, id: payload.id });

  switch (type) {
    case 'PAYMENT.SALE.COMPLETED':
      return { handled: true };
    case 'BILLING.SUBSCRIPTION.CREATED':
      return { handled: true };
    case 'BILLING.SUBSCRIPTION.UPDATED':
      return { handled: true };
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      return { handled: true };
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      return { handled: true };
    case 'PAYMENT.CAPTURE.REFUNDED':
      return { handled: true };
    default:
      logger.warn('PayPal webhook unhandled event type', { event_type: type });
      return { handled: false };
  }
}

/**
 * PayPalService class – static API matching spec.
 */
export class PayPalService {
  static createPayment = createPayment;
  static executePayment = executePayment;
  static getPaymentDetails = getPaymentDetails;
  static refundPayment = refundPayment;
  static createSubscription = createSubscription;
  static getSubscription = getSubscription;
  static cancelSubscription = cancelSubscription;
  static updateSubscription = updateSubscription;
  static verifyWebhookSignature = verifyWebhookSignature;
  static processWebhook = processWebhook;
}
