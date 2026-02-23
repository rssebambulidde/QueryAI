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
  OrderApplicationContextShippingPreference,
} from '@paypal/paypal-server-sdk';
import config from '../config/env';
import logger from '../config/logger';
import { ValidationError } from '../types/error';

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
  preferCard?: boolean; // If true, modify approval URL to prefer card payment
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
            shippingPreference: OrderApplicationContextShippingPreference.NoShipping, // No shipping required for digital goods - allows international billing addresses without restrictions
            // Remove locale to let PayPal auto-detect user's country and show appropriate address fields
            // Setting locale to 'en-US' was causing PayPal to restrict addresses to USA states
            // PayPal will automatically detect user's location and show correct address format
            landingPage: 'BILLING' as any, // Force billing/card form instead of PayPal login screen (requires "PayPal Account Optional" enabled)
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

      // Always modify the approval URL to force card payment and guest checkout
      // This ensures users see the card form directly without PayPal account creation prompt
      let approvalUrl = approveLink.href;
      const url = new URL(approvalUrl);
      url.searchParams.set('fundingSource', 'card');
      // Add guest parameter to encourage guest checkout (card payment without account)
      url.searchParams.set('guest', '1');
      // Force billing page instead of login page
      url.searchParams.set('landingPage', 'billing');
      // Remove any locale restrictions to allow international addresses
      // PayPal will auto-detect user's country and show appropriate address fields
      url.searchParams.delete('locale');
      approvalUrl = url.toString();
      logger.info('PayPal approval URL modified for card payment and guest checkout', {
        orderId: result.id,
        originalUrl: approveLink.href,
        modifiedUrl: approvalUrl,
        note: 'Guest checkout requires "PayPal Account Optional" enabled in PayPal business account settings',
      });

      return {
        orderId: result.id,
        approvalUrl,
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

// --- Dynamic Plan Management (9.6.6) ---

/**
 * Key in system_settings where dynamic plan IDs are stored.
 * Value shape: { pro_monthly?: string, pro_annual?: string, enterprise_monthly?: string, enterprise_annual?: string }
 */
const PAYPAL_PLAN_IDS_KEY = 'paypal_plan_ids';

export interface DynamicPlanIds {
  pro_monthly?: string;
  pro_annual?: string;
  enterprise_monthly?: string;
  enterprise_annual?: string;
}

/**
 * Create a PayPal catalog product (needed once before creating plans).
 * Returns the product ID.  Safe to call multiple times — idempotent via product_id param.
 */
export async function createProduct(
  productId: string = 'QUERYAI-SUBSCRIPTION',
  name: string = 'QueryAI Subscription',
  description: string = 'QueryAI AI-powered research assistant subscription'
): Promise<string> {
  const token = await getAccessToken();
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': `product-${productId}`, // idempotency key
    },
    body: JSON.stringify({
      id: productId,
      name,
      description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // 422 = already exists — that's fine, return the requested ID
    if (res.status === 422 && text.includes('DUPLICATE_RESOURCE_IDENTIFIER')) {
      logger.info('PayPal product already exists', { productId });
      return productId;
    }
    logger.error('PayPal createProduct failed', { status: res.status, body: text });
    throw new Error(`PayPal createProduct failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  logger.info('PayPal product created', { productId: data.id });
  return data.id;
}

export interface CreatePlanParams {
  productId: string;
  name: string;
  description?: string;
  price: number;       // USD
  currency?: string;
  intervalUnit: 'MONTH' | 'YEAR';
  intervalCount?: number; // default 1
}

export interface CreatePlanResult {
  planId: string;
  status: string;
}

/**
 * Create a PayPal billing plan under an existing product.
 * Uses the PayPal REST v1 Billing Plans API (not SDK — SDK doesn't expose plan creation).
 */
export async function createPlan(
  params: CreatePlanParams
): Promise<CreatePlanResult> {
  const token = await getAccessToken();
  const baseUrl = getBaseUrl();
  const currency = params.currency ?? 'USD';
  const intervalCount = params.intervalCount ?? 1;

  const body = {
    product_id: params.productId,
    name: params.name,
    description: params.description ?? `${params.name} subscription`,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: {
          interval_unit: params.intervalUnit,
          interval_count: intervalCount,
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // infinite
        pricing_scheme: {
          fixed_price: {
            value: params.price.toFixed(2),
            currency_code: currency,
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  };

  const res = await fetch(`${baseUrl}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('PayPal createPlan failed', { status: res.status, body: text, params });
    throw new Error(`PayPal createPlan failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string; status: string };
  logger.info('PayPal plan created', {
    planId: data.id,
    name: params.name,
    price: params.price,
    interval: params.intervalUnit,
  });

  return { planId: data.id, status: data.status };
}

/**
 * Create all required PayPal plans for the given pricing config and
 * persist the plan IDs to system_settings.
 *
 * Called by PricingConfigService.update() when admin changes prices.
 * Existing subscribers stay on their old plan (PayPal handles this natively).
 *
 * Returns the map of new plan IDs.
 */
export async function createPlansForPricing(
  tiers: {
    pro: { monthly: number; annual: number };
    enterprise: { monthly: number; annual: number };
  },
  updatedBy: string
): Promise<DynamicPlanIds> {
  // Ensure product exists
  const productId = await createProduct();

  const newPlanIds: DynamicPlanIds = {};

  // Create plans for each tier / billing period combination
  const combos: {
    key: keyof DynamicPlanIds;
    tier: string;
    price: number;
    interval: 'MONTH' | 'YEAR';
  }[] = [];

  if (tiers.pro.monthly > 0) {
    combos.push({ key: 'pro_monthly', tier: 'Pro', price: tiers.pro.monthly, interval: 'MONTH' });
  }
  if (tiers.pro.annual > 0) {
    combos.push({ key: 'pro_annual', tier: 'Pro', price: tiers.pro.annual, interval: 'YEAR' });
  }
  if (tiers.enterprise.monthly > 0) {
    combos.push({ key: 'enterprise_monthly', tier: 'Enterprise', price: tiers.enterprise.monthly, interval: 'MONTH' });
  }
  if (tiers.enterprise.annual > 0) {
    combos.push({ key: 'enterprise_annual', tier: 'Enterprise', price: tiers.enterprise.annual, interval: 'YEAR' });
  }

  for (const combo of combos) {
    try {
      const result = await createPlan({
        productId,
        name: `QueryAI ${combo.tier} — ${combo.interval === 'YEAR' ? 'Annual' : 'Monthly'}`,
        price: combo.price,
        intervalUnit: combo.interval,
      });
      newPlanIds[combo.key] = result.planId;
    } catch (err) {
      logger.error('createPlansForPricing: plan creation failed', {
        combo: combo.key,
        error: (err as Error).message,
      });
      // Continue with remaining combos — partial success is better than none
    }
  }

  // Persist to system_settings (merge with any existing IDs)
  if (Object.keys(newPlanIds).length > 0) {
    const { SystemSettingsService } = await import('./system-settings.service');
    const existing = (await SystemSettingsService.get<DynamicPlanIds>(PAYPAL_PLAN_IDS_KEY)) ?? {};
    const merged: DynamicPlanIds = { ...existing, ...newPlanIds };
    await SystemSettingsService.set(PAYPAL_PLAN_IDS_KEY, merged, updatedBy);
    logger.info('Dynamic PayPal plan IDs saved', { merged });
  }

  return newPlanIds;
}

/**
 * Get dynamic plan IDs from system_settings.
 */
export async function getDynamicPlanIds(): Promise<DynamicPlanIds> {
  const { SystemSettingsService } = await import('./system-settings.service');
  return (await SystemSettingsService.get<DynamicPlanIds>(PAYPAL_PLAN_IDS_KEY)) ?? {};
}

// --- Subscriptions ---

function getPlanIdForTier(
  tier: 'pro' | 'enterprise',
  billingPeriod: 'monthly' | 'annual' = 'monthly'
): string | undefined {
  // 1. Check dynamic plan IDs from system_settings cache (sync)
  //    These are set when admin changes pricing via 9.6.6 createPlansForPricing()
  const dynamicKey = `${tier}_${billingPeriod}` as keyof DynamicPlanIds;
  const dynamicId = cachedDynamicPlanIds[dynamicKey]?.trim();
  if (dynamicId) return dynamicId;

  // 2. Fall back to env-var plan IDs
  if (billingPeriod === 'annual') {
    const annualMap = {
      pro: config.PAYPAL_PLAN_ID_PRO_ANNUAL,
      enterprise: config.PAYPAL_PLAN_ID_ENTERPRISE_ANNUAL,
    };
    const id = annualMap[tier]?.trim();
    if (id) return id;
    // Fall back to monthly plan if no annual plan configured
  }
  const monthlyMap = {
    pro: config.PAYPAL_PLAN_ID_PRO,
    enterprise: config.PAYPAL_PLAN_ID_ENTERPRISE,
  };
  return monthlyMap[tier]?.trim() || undefined;
}

/**
 * Warm the in-memory dynamic plan ID cache.
 * Called at startup and after createPlansForPricing().
 */
let cachedDynamicPlanIds: DynamicPlanIds = {};

export async function refreshDynamicPlanIdCache(): Promise<void> {
  try {
    cachedDynamicPlanIds = await getDynamicPlanIds();
  } catch (err) {
    logger.warn('refreshDynamicPlanIdCache: failed, using empty cache', {
      error: (err as Error).message,
    });
  }
}

export interface CreateSubscriptionParams {
  tier: 'pro' | 'enterprise';
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
    throw new ValidationError(
      `Recurring subscription is not configured for ${params.tier} (${period}). Administrator must set ${key} in environment and create a subscription plan in PayPal Dashboard.`
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
        // Don't set locale - let PayPal auto-detect user's country for international address support
        // PayPal determines locale from: shipping address country, locale code, or logged-in user's country
        // By not setting locale, PayPal will use user's browser/IP location to determine country
        // This allows international users to enter addresses in their country's format
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

  // Modify approval URL to support international addresses
  // PayPal may default to business account country (USA) - we need to let it detect user's country
  let approvalUrl = approveLink.href;
  try {
    const url = new URL(approvalUrl);
    // Remove any locale/country restrictions that force USA address format
    url.searchParams.delete('locale');
    url.searchParams.delete('country.x');
    url.searchParams.delete('country_code');
    // Remove any state/ZIP restrictions
    url.searchParams.delete('state');
    url.searchParams.delete('zip');
    // PayPal will use IP geolocation, browser settings, or user's PayPal account country
    // to determine the appropriate address format
    url.searchParams.set('useraction', 'commit'); // Shows "Pay Now" button
    approvalUrl = url.toString();
    
    logger.info('PayPal subscription approval URL modified for international addresses', {
      subscriptionId: data.id,
      originalUrl: approveLink.href,
      modifiedUrl: approvalUrl,
      note: 'PayPal will auto-detect user country from IP/browser/PayPal account settings',
    });
  } catch (err) {
    // If URL parsing fails, use original URL
    logger.warn('Failed to modify subscription approval URL', { error: err, url: approveLink.href });
  }

  logger.info('PayPal subscription created', {
    subscriptionId: data.id,
    tier: params.tier,
    status: data.status,
  });

  return {
    subscriptionId: data.id,
    approvalUrl,
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
 * Handles both snake_case (PayPal REST API) and camelCase (SDK) response formats.
 */
export async function getSubscription(
  subscriptionId: string
): Promise<SubscriptionDetails> {
  const response = await subscriptions().getSubscription({ id: subscriptionId });
  const data = response.result as Record<string, unknown>;

  // PayPal REST API returns snake_case; SDK may return camelCase
  const startTime =
    (typeof data.start_time === 'string' ? data.start_time : undefined) ??
    (typeof data.startTime === 'string' ? data.startTime : undefined);
  const billingInfo = data.billing_info ?? data.billingInfo;
  const bi = billingInfo && typeof billingInfo === 'object' ? (billingInfo as Record<string, unknown>) : null;
  const nextBillingTime =
    (typeof bi?.next_billing_time === 'string' ? bi.next_billing_time : undefined) ??
    (typeof bi?.nextBillingTime === 'string' ? bi.nextBillingTime : undefined);
  const planIdRaw = data.plan_id ?? data.planId;
  const customIdRaw = data.custom_id ?? data.customId;
  const planId = typeof planIdRaw === 'string' ? planIdRaw : undefined;
  const customId = typeof customIdRaw === 'string' ? customIdRaw : undefined;

  return {
    subscriptionId: (data.id ?? subscriptionId) as string,
    status: (data.status ?? '') as string,
    plan_id: planId,
    start_time: startTime,
    next_billing_time: nextBillingTime,
    custom_id: customId,
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
 * Suspend (pause) a subscription in PayPal.
 * The subscription remains in SUSPENDED state until activated again.
 */
export async function suspendSubscription(
  subscriptionId: string,
  reason: string = 'User requested pause'
): Promise<void> {
  await subscriptions().suspendSubscription({
    id: subscriptionId,
    body: { reason },
  });

  logger.info('PayPal subscription suspended', { subscriptionId, reason });
}

/**
 * Activate (resume) a previously suspended subscription in PayPal.
 */
export async function activateSubscription(
  subscriptionId: string,
  reason?: string
): Promise<void> {
  await subscriptions().activateSubscription({
    id: subscriptionId,
    body: reason ? { reason } : undefined,
  });

  logger.info('PayPal subscription activated', { subscriptionId, reason });
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
  | 'BILLING.SUBSCRIPTION.ACTIVATED'
  | 'BILLING.SUBSCRIPTION.UPDATED'
  | 'BILLING.SUBSCRIPTION.CANCELLED'
  | 'BILLING.SUBSCRIPTION.SUSPENDED'
  | 'BILLING.SUBSCRIPTION.EXPIRED'
  | 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
  | 'PAYMENT.CAPTURE.REFUNDED'
  | 'PAYMENT.CAPTURE.COMPLETED';

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
  static suspendSubscription = suspendSubscription;
  static activateSubscription = activateSubscription;
  static updateSubscription = updateSubscription;
  static verifyWebhookSignature = verifyWebhookSignature;
  // 9.6.6 Dynamic plan management
  static createProduct = createProduct;
  static createPlan = createPlan;
  static createPlansForPricing = createPlansForPricing;
  static getDynamicPlanIds = getDynamicPlanIds;
  static refreshDynamicPlanIdCache = refreshDynamicPlanIdCache;
}
