/**
 * Integration: Complete payment flow (one-time)
 * Initiate → callback (execute) → status. Uses mocked DB/PayPal.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import type { Express } from 'express';

const mockGetUserProfile = jest.fn();
const mockGetUserSubscription = jest.fn();
const mockCreatePayment = jest.fn();
const mockGetPaymentByPayPalOrderId = jest.fn();
const mockGetPaymentById = jest.fn();
const mockUpdatePayment = jest.fn();
const mockUpdateSubscription = jest.fn();

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
    getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
    getPaymentByPayPalOrderId: (...args: unknown[]) => mockGetPaymentByPayPalOrderId(...args),
    getPaymentById: (...args: unknown[]) => mockGetPaymentById(...args),
    updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
    updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
    logSubscriptionHistory: jest.fn().mockResolvedValue(true),
    getUserPayments: jest.fn().mockResolvedValue([]),
  },
}));

const mockCreatePaymentPayPal = jest.fn();
const mockExecutePayment = jest.fn();
const mockGetPaymentDetails = jest.fn();
const mockVerifyWebhookSignature = jest.fn();
const mockProcessWebhook = jest.fn();

jest.mock('../services/paypal.service', () => ({
  createPayment: (...args: unknown[]) => mockCreatePaymentPayPal(...args),
  createSubscription: jest.fn(),
  executePayment: (...args: unknown[]) => mockExecutePayment(...args),
  getSubscription: jest.fn(),
  getPaymentDetails: (...args: unknown[]) => mockGetPaymentDetails(...args),
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
  mockCreatePayment.mockImplementation((o: { user_id: string; tier: string; amount: number; currency: string; status: string; paypal_order_id?: string }) =>
    Promise.resolve({
      id: 'pay-1',
      user_id: o.user_id,
      paypal_order_id: o.paypal_order_id || 'ORDER-123',
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
  mockExecutePayment.mockResolvedValue({ captureId: 'cap-1', amount: 5, currency: 'USD' });
  mockGetPaymentByPayPalOrderId.mockResolvedValue({
    id: 'pay-1',
    user_id: 'user-1',
    paypal_order_id: 'ORDER-123',
    tier: 'pro',
    amount: 5,
    currency: 'USD',
    status: 'pending',
  });
  mockGetPaymentDetails.mockResolvedValue({
    status: 'COMPLETED',
    paypal_order_id: 'ORDER-123',
    captureId: 'cap-1',
    payments: { captures: [{ id: 'cap-1', amount: { value: '5', currency_code: 'USD' } }] },
  });
  mockUpdatePayment.mockResolvedValue({});
  const paymentObj = {
    id: 'pay-1',
    user_id: 'user-1',
    paypal_order_id: 'ORDER-123',
    tier: 'pro',
    amount: 5,
    currency: 'USD',
    status: 'completed',
  };
  mockGetPaymentById.mockResolvedValue(paymentObj);

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

describe('Integration: Complete payment flow (one-time)', () => {
  it('initiate → callback → status returns completed payment', async () => {
    const initiateRes = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tier: 'pro',
        currency: 'USD',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      }),
    });
    expect(initiateRes.status).toBe(200);
    const initiateData = (await initiateRes.json()) as { success?: boolean; data?: { order_id?: string } };
    expect(initiateData.success).toBe(true);
    expect(initiateData.data?.order_id).toBe('ORDER-123');
    expect(mockCreatePayment).toHaveBeenCalled();
    expect(mockCreatePaymentPayPal).toHaveBeenCalled();

    const callbackRes = await fetch(
      `${baseUrl}/api/payment/callback?token=ORDER-123`,
      { redirect: 'manual' }
    );
    expect([200, 302]).toContain(callbackRes.status);
    expect(mockGetPaymentByPayPalOrderId).toHaveBeenCalled();
    expect(mockExecutePayment).toHaveBeenCalled();
    expect(mockUpdatePayment).toHaveBeenCalled();

    const statusRes = await fetch(`${baseUrl}/api/payment/status/ORDER-123`, {
      headers: authHeaders,
    });
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as { success?: boolean; data?: { paypal_status?: string } };
    expect(statusData.success).toBe(true);
    expect(statusData.data?.paypal_status).toBeDefined();
  });
});
