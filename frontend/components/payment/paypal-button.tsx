'use client';

import { useCallback, useState } from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { paymentApi, PaymentInitiateRequest } from '@/lib/api';
import { Alert } from '@/components/ui/alert';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

export interface PayPalButtonProps {
  tier: 'starter' | 'premium' | 'pro' | 'enterprise';
  currency: 'UGX' | 'USD';
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  recurring?: boolean;
  billingPeriod?: 'monthly' | 'annual';
  disabled?: boolean;
  onError?: (message: string) => void;
  onRedirect?: () => void;
}

/**
 * Reusable PayPal button.
 * - One-time: uses SDK PayPalButtons with createOrder (calls backend initiate) and onApprove (redirects to backend callback).
 * - Recurring: custom button that calls initiate with recurring and redirects to approval URL.
 */
export function PayPalButton({
  tier,
  currency,
  firstName,
  lastName,
  email,
  phoneNumber,
  recurring = false,
  billingPeriod = 'monthly',
  disabled = false,
  onError,
  onRedirect,
}: PayPalButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const handleInitiateRedirect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const request: PaymentInitiateRequest & { recurring?: boolean } = {
        tier,
        currency,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber?.trim() || undefined,
        billing_period: billingPeriod,
      };
      if (recurring) request.recurring = true;

      const response = await paymentApi.initiate(request);

      if (!response.success || !response.data) {
        showError(response.error?.message || 'Failed to start payment');
        return;
      }

      const data = response.data;
      const redirectUrl = data.redirect_url;
      if (!redirectUrl) {
        showError('No redirect URL from server');
        return;
      }

      onRedirect?.();
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : err instanceof Error
            ? err.message
            : 'Failed to initiate payment';
      showError(message ?? 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  }, [tier, currency, firstName, lastName, email, phoneNumber, recurring, billingPeriod, showError, onRedirect]);

  // Recurring or no client ID: redirect flow (no SDK approval popup)
  if (recurring || !PAYPAL_CLIENT_ID) {
    return (
      <div className="space-y-2">
        {error && (
          <Alert variant="error" className="text-sm">
            {error}
          </Alert>
        )}
        <button
          type="button"
          onClick={handleInitiateRedirect}
          disabled={disabled || loading}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
          style={{ minHeight: 44 }}
        >
          {loading ? (
            <span className="animate-pulse">Redirecting to PayPal...</span>
          ) : (
            <>
              <span>Pay with PayPal</span>
              {recurring && (
                <span className="text-xs opacity-90">
                  (Subscription{billingPeriod === 'annual' ? ', annual' : ''})
                </span>
              )}
            </>
          )}
        </button>
      </div>
    );
  }

  // One-time: SDK PayPalButtons (createOrder + onApprove redirect)
  return (
    <div className="space-y-2 w-full">
      {error && (
        <Alert variant="error" className="text-sm">
          {error}
        </Alert>
      )}
      <div className="w-full" style={{ minHeight: '200px' }}>
        <PayPalButtons
          style={{ layout: 'vertical', label: 'pay' }}
          disabled={disabled}
        createOrder={async () => {
          const request: PaymentInitiateRequest = {
            tier,
            currency,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phoneNumber: phoneNumber?.trim() || undefined,
            billing_period: billingPeriod,
          };
          const response = await paymentApi.initiate(request);

          if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Failed to create order');
          }

          const orderId = response.data.order_id ?? response.data.order_tracking_id;
          if (!orderId) {
            throw new Error('No order ID from server');
          }

          return orderId;
        }}
        onApprove={async (data) => {
          if (!data.orderID) return;
          onRedirect?.();
          const callbackUrl = `${API_URL.replace(/\/$/, '')}/api/payment/callback?token=${encodeURIComponent(data.orderID)}`;
          window.location.href = callbackUrl;
        }}
        onError={(err: { message?: string } | unknown) => {
          const msg = (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: string }).message === 'string')
            ? (err as { message: string }).message
            : 'PayPal error';
          setError(msg);
          onError?.(msg);
        }}
          onCancel={() => {
            setError(null);
          }}
        />
      </div>
    </div>
  );
}
