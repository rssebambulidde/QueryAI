/**
 * Integration: Webhook processing
 * Verification, PAYMENT.CAPTURE.COMPLETED, BILLING.SUBSCRIPTION.*, failure cases.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import type { Express } from 'express';

const mockGetPaymentByPayPalOrderId = jest.fn();
const mockUpdatePayment = jest.fn();
const mockUpdateSubscription = jest.fn();

jest.mock('../services/database.service', () => ({
  DatabaseService: {
    getPaymentByPayPalOrderId: (...args: unknown[]) => mockGetPaymentByPayPalOrderId(...args),
    updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
    updateSubscription: (...args: unknown[]) => mockUpdateSubscription(...args),
    getUserPayments: jest.fn().mockResolvedValue([]),
  },
}));

const mockVerifyWebhookSignature = jest.fn();
const mockProcessWebhook = jest.fn();

jest.mock('../services/paypal.service', () => ({
  createPayment: jest.fn(),
  createSubscription: jest.fn(),
  executePayment: jest.fn(),
  getSubscription: jest.fn(),
  getPaymentDetails: jest.fn(),
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
  processWebhook: (...args: unknown[]) => mockProcessWebhook(...args),
  refundPayment: jest.fn(),
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000',
    PAYPAL_WEBHOOK_ID: 'test',
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

describe('Integration: Webhook processing', () => {
  it('POST /webhook returns 200 and processes PAYMENT.CAPTURE.COMPLETED when verified', async () => {
    mockGetPaymentByPayPalOrderId.mockResolvedValue({
      id: 'pay-1',
      user_id: 'user-1',
      paypal_order_id: 'ORDER-1',
      status: 'pending',
      tier: 'pro',
      amount: 5,
      currency: 'USD',
    });
    const body = JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'cap-1',
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'cap-1' }] } }],
      },
    });
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
      body,
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success?: boolean };
    expect(data.success).toBe(true);
    expect(mockVerifyWebhookSignature).toHaveBeenCalled();
    expect(mockProcessWebhook).toHaveBeenCalledWith('PAYMENT.CAPTURE.COMPLETED', expect.any(Object));
  });

  it('POST /webhook returns 200 with success false when verification fails', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(false);
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
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'cap-1' },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success?: boolean };
    expect(data.success).toBe(false);
    expect(mockProcessWebhook).not.toHaveBeenCalled();
  });

  it('GET /webhook returns 405', async () => {
    const res = await fetch(`${baseUrl}/api/payment/webhook`, { method: 'GET' });
    expect(res.status).toBe(405);
  });
});
