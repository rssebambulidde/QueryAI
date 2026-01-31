/**
 * Payment routes end-to-end tests (PayPal-only).
 * Mocks DatabaseService, PayPalService, and auth; runs real router with in-process server.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import type { Express } from 'express';

const mockGetUserProfile = jest.fn();
const mockGetUserSubscription = jest.fn();
const mockCreatePayment = jest.fn();
const mockGetPaymentByPayPalOrderId = jest.fn();
const mockGetPaymentByPayPalSubscriptionId = jest.fn();
const mockUpdatePayment = jest.fn();
const mockUpdateSubscription = jest.fn();
const mockGetPaymentById = jest.fn();
const mockCreateRefund = jest.fn();

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
    getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
    getPaymentByPayPalOrderId: (...args: unknown[]) => mockGetPaymentByPayPalOrderId(...args),
    getPaymentByPayPalSubscriptionId: (...args: unknown[]) => mockGetPaymentByPayPalSubscriptionId(...args),
    updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
    updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
    getPaymentById: (...args: unknown[]) => mockGetPaymentById(...args),
    createRefund: (...args: unknown[]) => mockCreateRefund(...args),
    getUserPayments: jest.fn().mockResolvedValue([]),
  },
}));

const mockCreatePaymentPayPal = jest.fn();
const mockCreateSubscriptionPayPal = jest.fn();
const mockExecutePayment = jest.fn();
const mockGetSubscription = jest.fn();
const mockGetPaymentDetails = jest.fn();
const mockVerifyWebhookSignature = jest.fn();
const mockProcessWebhook = jest.fn();
const mockRefundPayment = jest.fn();

jest.mock('../services/paypal.service', () => ({
  createPayment: (...args: unknown[]) => mockCreatePaymentPayPal(...args),
  createSubscription: (...args: unknown[]) => mockCreateSubscriptionPayPal(...args),
  executePayment: (...args: unknown[]) => mockExecutePayment(...args),
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  getPaymentDetails: (...args: unknown[]) => mockGetPaymentDetails(...args),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  processWebhook: (...args: unknown[]) => mockProcessWebhook(...args),
  refundPayment: (...args: unknown[]) => mockRefundPayment(...args),
}));

const mockVerifyToken = jest.fn();
jest.mock('../services/auth.service', () => ({
  AuthService: {
    verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  },
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000',
    PAYPAL_WEBHOOK_ID: 'test-webhook-id',
    NODE_ENV: 'test',
  },
}));

const mockFrom = jest.fn();
jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Build app after mocks so payment routes use mocked deps
let app: Express;
let server: ReturnType<Express['listen']>;
let baseUrl: string;

beforeEach(async () => {
  jest.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@test.com' });
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }),
  });
  mockGetUserProfile.mockResolvedValue({ id: 'user-1', email: 'test@test.com', full_name: 'Test User' });
  mockGetUserSubscription.mockResolvedValue(null);
  mockCreatePayment.mockImplementation((o: { user_id: string; paypal_order_id?: string; paypal_subscription_id?: string; tier: string; amount: number; currency: string; status: string }) =>
    Promise.resolve({
      id: 'pay-1',
      user_id: o.user_id,
      paypal_order_id: o.paypal_order_id,
      paypal_subscription_id: o.paypal_subscription_id,
      tier: o.tier,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
    })
  );
  mockCreatePaymentPayPal.mockResolvedValue({
    orderId: 'ORDER-123',
    approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123',
    status: 'CREATED',
  });
  mockCreateSubscriptionPayPal.mockResolvedValue({
    subscriptionId: 'SUB-123',
    approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=SUB-123',
  });
  mockProcessWebhook.mockReturnValue({ handled: true });

  const paymentRoutes = (await import('../routes/payment.routes')).default;
  const { errorHandler } = await import('../middleware/errorHandler');

  app = express();
  app.use(express.json());
  app.use('/api/payment', paymentRoutes);
  app.use(errorHandler);

  const s = app.listen(0);
  server = await new Promise<ReturnType<Express['listen']>>((resolve) => {
    s.once('listening', () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
});

afterEach(() => {
  if (server && typeof server.close === 'function') server.close();
});

const authHeaders = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
const validInitiateBody = {
  tier: 'starter',
  currency: 'USD',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
};

describe('Payment routes – one-time payment', () => {
  it('POST /api/payment/initiate returns redirect_url and order_id for one-time payment', async () => {
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validInitiateBody),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; data?: { redirect_url?: string; order_id?: string; subscription_id?: string; payment?: unknown; paypal_status?: string; payments?: unknown[]; refund?: unknown; refund_status?: string }; message?: string };
    expect(data.success).toBe(true);
    expect(data.data?.redirect_url).toContain('checkoutnow');
    expect(data.data?.order_id).toBe('ORDER-123');
    expect(mockCreatePaymentPayPal).toHaveBeenCalled();
    expect(mockCreateSubscriptionPayPal).not.toHaveBeenCalled();
  });

  it('POST /api/payment/initiate returns subscription_id and redirect for recurring', async () => {
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ...validInitiateBody, recurring: true }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; data?: { redirect_url?: string; order_id?: string; subscription_id?: string; payment?: unknown; paypal_status?: string; payments?: unknown[]; refund?: unknown; refund_status?: string }; message?: string };
    expect(data.success).toBe(true);
    expect(data.data?.subscription_id).toBe('SUB-123');
    expect(data.data?.redirect_url).toContain('checkoutnow');
    expect(mockCreateSubscriptionPayPal).toHaveBeenCalled();
  });

  it('POST /api/payment/initiate rejects invalid tier', async () => {
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ...validInitiateBody, tier: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/payment/initiate rejects missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ tier: 'starter', currency: 'USD' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/payment/initiate rejects when user profile not found', async () => {
    mockGetUserProfile.mockResolvedValueOnce(null);
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(validInitiateBody),
    });
    expect(res.status).toBe(400);
  });
});

describe('Payment routes – callback and cancel', () => {
  it('GET /api/payment/callback redirects to frontend with error when token missing', async () => {
    const res = await fetch(`${baseUrl}/api/payment/callback`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('payment=error');
  });

  it('GET /api/payment/callback redirects to error when payment not found', async () => {
    mockGetPaymentByPayPalOrderId.mockResolvedValueOnce(null);
    mockGetPaymentByPayPalSubscriptionId.mockResolvedValueOnce(null);
    const res = await fetch(`${baseUrl}/api/payment/callback?token=UNKNOWN-123`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('payment=error');
  });

  it('GET /api/payment/cancel redirects to frontend with cancelled', async () => {
    const res = await fetch(`${baseUrl}/api/payment/cancel`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('payment=cancelled');
  });

  it('GET /api/payment/cancel updates payment status when token provided', async () => {
    mockGetPaymentByPayPalOrderId.mockResolvedValueOnce({
      id: 'pay-1',
      user_id: 'user-1',
      status: 'pending',
    });
    const res = await fetch(`${baseUrl}/api/payment/cancel?token=ORDER-123`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(mockUpdatePayment).toHaveBeenCalledWith('pay-1', expect.objectContaining({ status: 'cancelled' }));
  });
});

describe('Payment routes – webhook', () => {
  it('GET /api/payment/webhook returns 405', async () => {
    const res = await fetch(`${baseUrl}/api/payment/webhook`);
    expect(res.status).toBe(405);
  });

  it('POST /api/payment/webhook returns 200 and processes PAYMENT.CAPTURE.COMPLETED when verified', async () => {
    mockVerifyWebhookSignature.mockResolvedValueOnce(true);
    const res = await fetch(`${baseUrl}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
        'paypal-transmission-id': 'tid',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      body: JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        id: 'evt-1',
        resource: { id: 'CAP-123' },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; data?: Record<string, unknown>; message?: string };
    expect(data.success).toBe(true);
    expect(mockProcessWebhook).toHaveBeenCalled();
  });

  it('POST /api/payment/webhook returns 200 with success false when verification fails', async () => {
    mockVerifyWebhookSignature.mockResolvedValueOnce(false);
    const res = await fetch(`${baseUrl}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
        'paypal-transmission-id': 'tid',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      body: JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        id: 'evt-1',
        resource: { id: 'CAP-123' },
      }),
    });
    expect(res.status).toBe(403); // Gap 7: Webhook verification failures return 403 Forbidden
    const data = (await res.json()) as { success: boolean; data?: Record<string, unknown>; message?: string };
    expect(data.success).toBe(false);
    expect(data.message).toContain('verification');
  });
});

describe('Payment routes – status and history', () => {
  it('GET /api/payment/status/:orderId returns payment and paypal_status when found', async () => {
    mockGetPaymentByPayPalOrderId.mockResolvedValueOnce({
      id: 'pay-1',
      user_id: 'user-1',
      paypal_order_id: 'ORDER-123',
      status: 'pending',
      tier: 'starter',
      amount: 9,
      currency: 'USD',
    });
    mockGetPaymentDetails.mockResolvedValueOnce({
      orderId: 'ORDER-123',
      status: 'COMPLETED',
      captureId: 'CAP-123',
      amount: '9',
      currency: 'USD',
    });
    mockGetPaymentById.mockResolvedValue({
      id: 'pay-1',
      user_id: 'user-1',
      status: 'completed',
      paypal_payment_id: 'CAP-123',
    });
    const res = await fetch(`${baseUrl}/api/payment/status/ORDER-123`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; data?: { payment?: unknown; paypal_status?: string }; message?: string };
    expect(data.success).toBe(true);
    expect(data.data?.payment).toBeDefined();
    expect(data.data?.paypal_status).toBe('COMPLETED');
  });

  it('GET /api/payment/status/:orderId returns 400 when payment not found', async () => {
    mockGetPaymentByPayPalOrderId.mockResolvedValueOnce(null);
    const res = await fetch(`${baseUrl}/api/payment/status/ORDER-UNKNOWN`, { headers: authHeaders });
    expect(res.status).toBe(400);
  });

  it('GET /api/payment/history returns payments array', async () => {
    const { DatabaseService } = await import('../services/database.service');
    (DatabaseService.getUserPayments as jest.Mock).mockResolvedValueOnce([
      { id: 'pay-1', tier: 'starter', amount: 9, currency: 'USD', status: 'completed' },
    ]);
    const res = await fetch(`${baseUrl}/api/payment/history`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; data?: { payments?: unknown[] }; message?: string };
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data?.payments)).toBe(true);
  });
});

describe('Payment routes – refund', () => {
  it('POST /api/payment/refund rejects when payment not found', async () => {
    mockGetPaymentById.mockResolvedValueOnce(null);
    const res = await fetch(`${baseUrl}/api/payment/refund`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ paymentId: 'pay-unknown' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/payment/refund rejects when payment not completed', async () => {
    mockGetPaymentById.mockResolvedValueOnce({
      id: 'pay-1',
      user_id: 'user-1',
      status: 'pending',
      amount: 9,
      currency: 'USD',
    });
    const res = await fetch(`${baseUrl}/api/payment/refund`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ paymentId: 'pay-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/payment/refund succeeds and returns refund when payment completed', async () => {
    mockGetPaymentById.mockResolvedValue({
      id: 'pay-1',
      user_id: 'user-1',
      status: 'completed',
      amount: 9,
      currency: 'USD',
      paypal_payment_id: 'CAP-123',
    });
    mockRefundPayment.mockResolvedValueOnce({ refundId: 'REF-123', status: 'COMPLETED' });
    mockCreateRefund.mockResolvedValueOnce({
      id: 'ref-1',
      payment_id: 'pay-1',
      amount: 9,
      currency: 'USD',
      status: 'completed',
    });
    const res = await fetch(`${baseUrl}/api/payment/refund`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ paymentId: 'pay-1' }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; data?: { refund?: unknown; refund_status?: string }; message?: string };
    expect(data.success).toBe(true);
    expect(data.data?.refund).toBeDefined();
    expect(data.data?.refund_status).toBe('COMPLETED');
    expect(mockRefundPayment).toHaveBeenCalledWith(
      expect.objectContaining({ captureId: 'CAP-123', amount: 9, currency: 'USD' })
    );
  });
});
