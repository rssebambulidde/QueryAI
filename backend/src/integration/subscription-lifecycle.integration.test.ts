/**
 * Integration: Subscription lifecycle
 * Recurring initiate → webhook (subscription activated) → cancel webhook.
 * Uses mocked DB/PayPal.
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

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
    getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
    getPaymentByPayPalOrderId: (...args: unknown[]) => mockGetPaymentByPayPalOrderId(...args),
    getPaymentByPayPalSubscriptionId: (...args: unknown[]) => mockGetPaymentByPayPalSubscriptionId(...args),
    updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
    updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
    getUserPayments: jest.fn().mockResolvedValue([]),
  },
}));

const mockCreateSubscriptionPayPal = jest.fn();
const mockGetSubscription = jest.fn();
const mockVerifyWebhookSignature = jest.fn();
const mockProcessWebhook = jest.fn();

jest.mock('../services/paypal.service', () => ({
  createPayment: jest.fn(),
  createSubscription: (...args: unknown[]) => mockCreateSubscriptionPayPal(...args),
  executePayment: jest.fn(),
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  getPaymentDetails: jest.fn(),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  processWebhook: (...args: unknown[]) => mockProcessWebhook(...args),
  refundPayment: jest.fn(),
}));

jest.mock('../services/auth.service', () => ({
  AuthService: { verifyToken: (...args: unknown[]) => mockVerifyToken(...args) },
}));
const mockVerifyToken = jest.fn();

jest.mock('../config/env', () => ({
  __esModule: true,
  default: { API_BASE_URL: 'http://localhost:3001', FRONTEND_URL: 'http://localhost:3000', PAYPAL_WEBHOOK_ID: 'test', NODE_ENV: 'test' },
}));

const mockFrom = jest.fn();
jest.mock('../config/database', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

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
  mockCreatePayment.mockImplementation((o: { user_id: string; tier: string; amount: number; currency: string; status: string; paypal_subscription_id?: string }) =>
    Promise.resolve({
      id: 'pay-1',
      user_id: o.user_id,
      paypal_subscription_id: o.paypal_subscription_id || 'SUB-123',
      tier: o.tier,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
    })
  );
  mockCreateSubscriptionPayPal.mockResolvedValue({
    subscriptionId: 'SUB-123',
    approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=SUB-123',
  });
  mockGetSubscription.mockResolvedValue({
    status: 'ACTIVE',
    start_time: new Date().toISOString(),
    next_billing_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  mockVerifyWebhookSignature.mockResolvedValue(true);
  mockProcessWebhook.mockReturnValue({ handled: true });
  mockUpdatePayment.mockResolvedValue({});
  mockUpdateSubscription.mockResolvedValue({});

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

describe('Integration: Subscription lifecycle', () => {
  it('recurring initiate creates payment with subscription ID', async () => {
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tier: 'starter',
        currency: 'USD',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        recurring: true,
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success?: boolean; data?: { subscription_id?: string } };
    expect(data.success).toBe(true);
    expect(data.data?.subscription_id).toBe('SUB-123');
    expect(mockCreateSubscriptionPayPal).toHaveBeenCalled();
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        tier: 'starter',
        paypal_subscription_id: 'SUB-123',
        status: 'pending',
      })
    );
  });

  it('webhook BILLING.SUBSCRIPTION.CANCELLED is accepted when verified', async () => {
    mockProcessWebhook.mockReturnValue({ handled: true });
    const res = await fetch(`${baseUrl}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': 't1',
        'paypal-transmission-time': '2020-01-01T00:00:00Z',
        'paypal-transmission-sig': 'sig',
        'paypal-auth-algo': 'SHA256',
        'paypal-cert-url': 'https://api.paypal.com/v1/certs',
      },
      body: JSON.stringify({
        event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
        resource: { id: 'SUB-123' },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success?: boolean };
    expect(data.success).toBe(true);
    expect(mockVerifyWebhookSignature).toHaveBeenCalled();
    expect(mockProcessWebhook).toHaveBeenCalledWith('BILLING.SUBSCRIPTION.CANCELLED', expect.any(Object));
  });
});
