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
      // Store the current page URL to redirect back after payment
      const returnUrl = typeof window !== 'undefined' ? window.location.href : undefined;
      
      const request: PaymentInitiateRequest & { recurring?: boolean } = {
        tier,
        currency,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber?.trim() || undefined,
        billing_period: billingPeriod,
        return_url: returnUrl, // Store where user came from
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
  // For better international support, we use redirect flow which allows proper country selection
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

  // One-time: Use redirect flow for better international address support
  // PayPal's embedded card form validates ZIP/phone before country selection
  // Redirect flow ensures users select country first on PayPal's hosted checkout
  const handleOneTimeRedirect = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
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
        showError(response.error?.message || 'Failed to create order');
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
  }, [tier, currency, firstName, lastName, email, phoneNumber, billingPeriod, showError, onRedirect]);

  return (
    <div className="space-y-2 w-full">
      {error && (
        <Alert variant="error" className="text-sm">
          {error}
        </Alert>
      )}
      <button
        type="button"
        onClick={handleOneTimeRedirect}
        disabled={disabled || loading}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
        style={{ minHeight: 44 }}
      >
        {loading ? (
          <span className="animate-pulse">Redirecting to PayPal...</span>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            <span>Pay with PayPal or Card</span>
          </>
        )}
      </button>
      <p className="text-xs text-gray-500 text-center mt-2">
        You'll be redirected to PayPal's secure checkout where you can select your country and enter your billing address.
      </p>
    </div>
  );
}
