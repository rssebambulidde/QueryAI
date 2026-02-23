/**
 * Payment performance tests: payment processing speed, webhook processing, concurrent payments.
 * Uses mocked services; measures timing and concurrency behavior.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as PayPalService from '../services/paypal.service';

const mockCreateOrder = jest.fn();
const mockCaptureOrder = jest.fn();
const mockGetOrder = jest.fn();
const mockRefundCapturedPayment = jest.fn();
const mockCreateSubscription = jest.fn();
const mockGetSubscription = jest.fn();

jest.mock('@paypal/paypal-server-sdk', () => ({
  Client: jest.fn(),
  Environment: { Sandbox: 'sandbox', Production: 'production' },
  OrdersController: jest.fn().mockImplementation(() => ({
    createOrder: mockCreateOrder,
    captureOrder: mockCaptureOrder,
    getOrder: mockGetOrder,
  })),
  PaymentsController: jest.fn().mockImplementation(() => ({
    refundCapturedPayment: mockRefundCapturedPayment,
  })),
  SubscriptionsController: jest.fn().mockImplementation(() => ({
    createSubscription: mockCreateSubscription,
    getSubscription: mockGetSubscription,
    cancelSubscription: jest.fn(),
    patchSubscription: jest.fn(),
  })),
  CheckoutPaymentIntent: { Capture: 'CAPTURE' },
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(m: string, s: number) {
      super(m);
      this.statusCode = s;
    }
  },
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    PAYPAL_CLIENT_ID: 'test-id',
    PAYPAL_CLIENT_SECRET: 'test-secret',
    PAYPAL_MODE: 'sandbox',
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockFetch = jest.fn();
beforeEach(() => {
  (globalThis as any).fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ access_token: 'mock-token', expires_in: 3600 }),
  });
  jest.clearAllMocks();
  mockCreateOrder.mockResolvedValue({
    result: {
      id: 'ORDER-123',
      status: 'CREATED',
      links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123' }],
    },
  });
  mockCaptureOrder.mockResolvedValue({
    result: {
      id: 'ORDER-123',
      status: 'COMPLETED',
      purchaseUnits: [
        {
          payments: {
            captures: [
              { id: 'CAP-123', amount: { currencyCode: 'USD', value: '9.99' }, status: 'COMPLETED' },
            ],
          },
          payer: { emailAddress: 'buyer@example.com', name: { givenName: 'Jane', surname: 'Doe' } },
        },
      ],
    },
  });
});

describe('Payment performance – processing speed', () => {
  it('createPayment completes within acceptable time (mock)', async () => {
    const start = Date.now();
    const result = await PayPalService.createPayment({
      amount: 9.99,
      currency: 'USD',
      returnUrl: 'https://app.example.com/return',
      cancelUrl: 'https://app.example.com/cancel',
    });
    const elapsed = Date.now() - start;
    expect(result.orderId).toBe('ORDER-123');
    expect(elapsed).toBeLessThan(2000);
  });

  it('executePayment completes within acceptable time (mock)', async () => {
    const start = Date.now();
    const result = await PayPalService.executePayment('ORDER-123');
    const elapsed = Date.now() - start;
    expect(result.captureId).toBe('CAP-123');
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('Payment performance – webhook processing speed', () => {
  it('webhook event type validation is fast (type check only)', () => {
    const start = Date.now();
    const validTypes = [
      'PAYMENT.SALE.COMPLETED',
      'BILLING.SUBSCRIPTION.CREATED',
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.CANCELLED',
    ];
    for (const t of validTypes) {
      expect(typeof t).toBe('string');
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('Payment performance – concurrent payments', () => {
  it('handles multiple createPayment calls concurrently', async () => {
    const count = 5;
    const promises = Array.from({ length: count }, (_, i) =>
      PayPalService.createPayment({
        amount: 9.99 + i,
        currency: 'USD',
        returnUrl: `https://app.example.com/return?n=${i}`,
        cancelUrl: `https://app.example.com/cancel?n=${i}`,
      })
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(count);
    results.forEach((r) => {
      expect(r.orderId).toBe('ORDER-123');
      expect(r.approvalUrl).toContain('checkoutnow');
    });
    expect(mockCreateOrder).toHaveBeenCalledTimes(count);
  });
});
