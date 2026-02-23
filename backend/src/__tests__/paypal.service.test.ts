/**
 * PayPal service tests.
 * Mocks @paypal/paypal-server-sdk (v2) controllers and config.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';

const mockCreateOrder = jest.fn<(arg?: unknown) => Promise<{ result: unknown }>>();
const mockCaptureOrder = jest.fn<(arg?: unknown) => Promise<{ result: unknown }>>();
const mockGetOrder = jest.fn<(arg?: unknown) => Promise<{ result: unknown }>>();
const mockRefundCapturedPayment = jest.fn<(arg?: unknown) => Promise<{ result: unknown }>>();

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
    createSubscription: jest.fn(),
    getSubscription: jest.fn(),
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

// PayPal credentials come from setup.ts (process.env) so real config is used.

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  (globalThis as any).fetch = mockFetch;
  mockCreateOrder.mockReset();
  mockCaptureOrder.mockReset();
  mockGetOrder.mockReset();
  mockRefundCapturedPayment.mockReset();
  mockFetch.mockReset();
});
afterAll(() => {
  (globalThis as any).fetch = originalFetch;
});

describe('PayPal processWebhook', () => {
  it('handles known event types', async () => {
    const { processWebhook } = await import('../services/paypal.service');
    expect(processWebhook('PAYMENT.SALE.COMPLETED', { id: '1' })).toEqual({
      handled: true,
    });
    expect(processWebhook('BILLING.SUBSCRIPTION.CREATED', { id: '2' })).toEqual({
      handled: true,
    });
    expect(processWebhook('BILLING.SUBSCRIPTION.CANCELLED', { id: '3' })).toEqual({
      handled: true,
    });
    expect(processWebhook('PAYMENT.CAPTURE.REFUNDED', { id: '4' })).toEqual({
      handled: true,
    });
  });

  it('returns handled: false for unknown event type', async () => {
    const { processWebhook } = await import('../services/paypal.service');
    expect(processWebhook('UNKNOWN.EVENT', { id: '1' })).toEqual({
      handled: false,
    });
  });
});

describe('PayPal createPayment', () => {
  it('returns orderId and approvalUrl on success', async () => {
    mockCreateOrder.mockResolvedValueOnce({
      result: {
        id: 'ORDER-123',
        status: 'CREATED',
        links: [
          { rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123' },
        ],
      },
    });

    const { createPayment } = await import('../services/paypal.service');
    const res = await createPayment({
      amount: 9.99,
      currency: 'USD',
      returnUrl: 'https://app.example.com/return',
      cancelUrl: 'https://app.example.com/cancel',
    });

    expect(res.orderId).toBe('ORDER-123');
    expect(res.approvalUrl).toContain('checkoutnow');
    expect(res.status).toBe('CREATED');
  });

  it('throws when approve link is missing', async () => {
    mockCreateOrder.mockResolvedValueOnce({
      result: {
        id: 'ORDER-456',
        status: 'CREATED',
        links: [{ rel: 'self', href: 'https://api.paypal.com/orders/ORDER-456' }],
      },
    });

    const { createPayment } = await import('../services/paypal.service');
    await expect(
      createPayment({
        amount: 9.99,
        currency: 'USD',
        returnUrl: 'https://app.example.com/return',
        cancelUrl: 'https://app.example.com/cancel',
      })
    ).rejects.toThrow(/approval URL/);
  });
});

describe('PayPal executePayment', () => {
  it('returns captureId and amount on success', async () => {
    mockCaptureOrder.mockResolvedValueOnce({
      result: {
        id: 'ORDER-123',
        status: 'COMPLETED',
        purchaseUnits: [
          {
            payments: {
              captures: [
                {
                  id: 'CAP-123',
                  amount: { currencyCode: 'USD', value: '9.99' },
                  status: 'COMPLETED',
                },
              ],
            },
          },
        ],
        payer: {
          emailAddress: 'buyer@example.com',
          name: { givenName: 'Jane', surname: 'Doe' },
        },
      },
    });

    const { executePayment } = await import('../services/paypal.service');
    const res = await executePayment('ORDER-123');

    expect(res.orderId).toBe('ORDER-123');
    expect(res.captureId).toBe('CAP-123');
    expect(res.amount).toBe('9.99');
    expect(res.currency).toBe('USD');
    expect(res.payerEmail).toBe('buyer@example.com');
    expect(res.payerName).toContain('Jane');
  });
});

describe('PayPal getPaymentDetails', () => {
  it('returns order details', async () => {
    mockGetOrder.mockResolvedValueOnce({
      result: {
        id: 'ORDER-123',
        status: 'COMPLETED',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T00:01:00Z',
        purchaseUnits: [
          {
            payments: {
              captures: [
                { id: 'CAP-123', amount: { currencyCode: 'USD', value: '9.99' } },
              ],
            },
          },
        ],
      },
    });

    const { getPaymentDetails } = await import('../services/paypal.service');
    const res = await getPaymentDetails('ORDER-123');

    expect(res.orderId).toBe('ORDER-123');
    expect(res.status).toBe('COMPLETED');
    expect(res.captureId).toBe('CAP-123');
    expect(res.amount).toBe('9.99');
    expect(res.currency).toBe('USD');
  });
});

describe('PayPal refundPayment', () => {
  it('uses PaymentsController and returns refundId', async () => {
    mockRefundCapturedPayment.mockResolvedValueOnce({
      result: { id: 'REF-123', status: 'COMPLETED' },
    });

    const { refundPayment } = await import('../services/paypal.service');
    const res = await refundPayment({ captureId: 'CAP-123' });

    expect(res.refundId).toBe('REF-123');
    expect(res.status).toBe('COMPLETED');
    expect(mockRefundCapturedPayment).toHaveBeenCalledWith(
      expect.objectContaining({ captureId: 'CAP-123' })
    );
  });
});

describe('PayPalService class', () => {
  it('exposes static methods', async () => {
    const { PayPalService } = await import('../services/paypal.service');
    expect(typeof PayPalService.createPayment).toBe('function');
    expect(typeof PayPalService.executePayment).toBe('function');
    expect(typeof PayPalService.getPaymentDetails).toBe('function');
    expect(typeof PayPalService.refundPayment).toBe('function');
    expect(typeof PayPalService.createSubscription).toBe('function');
    expect(typeof PayPalService.getSubscription).toBe('function');
    expect(typeof PayPalService.cancelSubscription).toBe('function');
    expect(typeof PayPalService.updateSubscription).toBe('function');
    expect(typeof PayPalService.verifyWebhookSignature).toBe('function');
    // 9.6.6 Dynamic plan management
    expect(typeof PayPalService.createProduct).toBe('function');
    expect(typeof PayPalService.createPlan).toBe('function');
    expect(typeof PayPalService.createPlansForPricing).toBe('function');
    expect(typeof PayPalService.getDynamicPlanIds).toBe('function');
    expect(typeof PayPalService.refreshDynamicPlanIdCache).toBe('function');
  });
});

describe('PayPal verifyWebhookSignature', () => {
  it('returns true when PayPal API returns verification_status SUCCESS', async () => {
    (mockFetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
      });
    const { verifyWebhookSignature } = await import('../services/paypal.service');
    const result = await verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'tid',
      transmissionSig: 'sig',
      transmissionTime: '2024-01-01T00:00:00Z',
      webhookId: 'test-webhook-id',
      webhookEvent: { id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
    });
    expect(result).toBe(true);
  });

  it('returns false when PayPal API returns non-SUCCESS', async () => {
    (mockFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'token', expires_in: 3600 }),
    });
    (mockFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ verification_status: 'FAILURE' }),
    });
    const { verifyWebhookSignature } = await import('../services/paypal.service');
    const result = await verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'tid',
      transmissionSig: 'sig',
      transmissionTime: '2024-01-01T00:00:00Z',
      webhookId: 'test-webhook-id',
      webhookEvent: { id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
    });
    expect(result).toBe(false);
  });

  it('returns false when verify request returns !ok', async () => {
    (mockFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'token', expires_in: 3600 }),
    });
    (mockFetch as any).mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Bad Request') });
    const { verifyWebhookSignature } = await import('../services/paypal.service');
    const result = await verifyWebhookSignature({
      authAlgo: 'SHA256withRSA',
      certUrl: 'https://api.sandbox.paypal.com/cert',
      transmissionId: 'tid',
      transmissionSig: 'sig',
      transmissionTime: '2024-01-01T00:00:00Z',
      webhookId: 'test-webhook-id',
      webhookEvent: { id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
    });
    expect(result).toBe(false);
  });
});
