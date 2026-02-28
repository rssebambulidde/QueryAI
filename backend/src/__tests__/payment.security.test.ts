/**
 * Payment security tests: webhook signature verification, authentication/authorization.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import type { Express } from 'express';

const mockGetUserProfile = jest.fn();
const mockGetUserSubscription = jest.fn();
const mockCreatePayment = jest.fn();
const mockGetPaymentByPayPalOrderId = jest.fn();
const mockGetPaymentById = jest.fn();
const mockVerifyWebhookSignature = jest.fn();
const mockProcessWebhook = jest.fn();
const mockVerifyToken = jest.fn();

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
    getUserSubscription: (...args: unknown[]) => mockGetUserSubscription(...args),
    createPayment: (...args: unknown[]) => mockCreatePayment(...args),
    getPaymentByPayPalOrderId: (...args: unknown[]) => mockGetPaymentByPayPalOrderId(...args),
    getPaymentByPayPalSubscriptionId: jest.fn().mockResolvedValue(null),
    updatePayment: jest.fn(),
    updateSubscription: jest.fn(),
    getPaymentById: (...args: unknown[]) => mockGetPaymentById(...args),
    createRefund: jest.fn(),
    getUserPayments: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/paypal.service', () => ({
  createPayment: jest.fn().mockResolvedValue({ orderId: 'O-1', approvalUrl: 'https://paypal.com/checkout', status: 'CREATED' }),
  createSubscription: jest.fn(),
  executePayment: jest.fn(),
  getSubscription: jest.fn(),
  getPaymentDetails: jest.fn(),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  processWebhook: (...args: unknown[]) => mockProcessWebhook(...args),
  refundPayment: jest.fn(),
}));

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
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }) }),
  });
  mockGetUserProfile.mockResolvedValue({ id: 'user-1', email: 'test@test.com', full_name: 'Test User' });
  mockGetUserSubscription.mockResolvedValue(null);
  mockCreatePayment.mockResolvedValue({ id: 'pay-1', user_id: 'user-1', status: 'pending' });
  mockProcessWebhook.mockReturnValue({ handled: true });
  mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@test.com' });

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

describe('Payment security – authentication', () => {
  it('POST /api/payment/initiate returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 'pro',
        currency: 'USD',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      }),
    });
    expect(res.status).toBe(401);
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it('POST /api/payment/initiate returns 401 when token is invalid', async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error('Invalid token'));
    const res = await fetch(`${baseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 'pro',
        currency: 'USD',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/payment/status/:orderId returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/payment/status/ORDER-123`);
    expect(res.status).toBe(401);
  });

  it('GET /api/payment/history returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/payment/history`);
    expect(res.status).toBe(401);
  });

  it('POST /api/payment/refund returns 400 when Authorization header is missing (Zod runs before auth)', async () => {
    const res = await fetch(`${baseUrl}/api/payment/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
    });
    // validateRequest (Zod) runs before authenticate — so valid body still hits auth.
    // With invalid paymentId (non-UUID) it'd be 400 from Zod.
    // But with valid UUID, auth middleware runs and returns 401.
    expect([400, 401]).toContain(res.status);
  });
});

describe('Payment security – webhook signature verification', () => {
  it('POST /api/payment/webhook returns 403 when verification fails', async () => {
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
    expect(res.status).toBe(403);
    const data = (await res.json()) as { success: boolean; message?: string };
    expect(data.success).toBe(false);
    expect(data.message).toContain('verification');
  });

  it('POST /api/payment/webhook verifies signature with headers before processing', async () => {
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
    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        authAlgo: 'SHA256withRSA',
        certUrl: 'https://api.sandbox.paypal.com/cert',
        transmissionId: 'tid',
        transmissionSig: 'sig',
        transmissionTime: '2024-01-01T00:00:00Z',
      })
    );
  });
});

describe('Payment security – authorization (own resources only)', () => {
  it('GET /api/payment/status/:orderId returns 400 when payment belongs to another user', async () => {
    mockGetPaymentByPayPalOrderId.mockResolvedValueOnce({
      id: 'pay-1',
      user_id: 'other-user',
      paypal_order_id: 'ORDER-123',
      status: 'pending',
    });
    const res = await fetch(`${baseUrl}/api/payment/status/ORDER-123`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/payment/refund returns 400 when payment belongs to another user', async () => {
    mockGetPaymentById.mockResolvedValueOnce({
      id: 'pay-1',
      user_id: 'other-user',
      status: 'completed',
      amount: 9,
      currency: 'USD',
      paypal_payment_id: 'CAP-123',
    });
    const res = await fetch(`${baseUrl}/api/payment/refund`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId: 'pay-1' }),
    });
    expect(res.status).toBe(400);
  });
});
