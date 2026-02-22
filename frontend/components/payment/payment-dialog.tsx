'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { PayPalButton } from '@/components/payment/paypal-button';
import { getPricing, getAnnualSavings, formatPrice } from '@/lib/pricing';
import type { BillingPeriod } from '@/lib/pricing';
import { getPaymentErrorMessage } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface PaymentDialogProps {
  tier: 'pro' | 'enterprise';
  onClose: () => void;
  onSuccess?: () => void;
  /** When opening for "switch billing period", preselect monthly or annual. */
  initialBillingPeriod?: BillingPeriod;
  /** When true, preselect "Subscribe (recurring billing)" and use for subscription flows. */
  initialRecurring?: boolean;
}

export function PaymentDialog({ tier, onClose, onSuccess, initialBillingPeriod, initialRecurring }: PaymentDialogProps) {
  const { user } = useAuthStore();
  const { isMobile } = useMobile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Default to one-time payment (false) unless explicitly set to recurring
  // This reduces friction - users can pay with card without PayPal account
  const [recurring, setRecurring] = useState(!!initialRecurring);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(initialBillingPeriod ?? 'monthly');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });

  // Pre-populate form with user data
  useEffect(() => {
    if (user) {
      const fullName = user.full_name || '';
      const nameParts = fullName.split(' ');
      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: user.email || '',
        phoneNumber: '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (initialBillingPeriod) setBillingPeriod(initialBillingPeriod);
  }, [initialBillingPeriod]);
  useEffect(() => {
    if (initialRecurring) setRecurring(true);
  }, [initialRecurring]);

  const amount = getPricing(tier, billingPeriod);
  const annualSavings = getAnnualSavings(tier);

  const handlePayPalError = (message: string) => {
    // Use enhanced error message parser
    const enhancedMessage = getPaymentErrorMessage(message);
    setError(enhancedMessage);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div
        className={cn(
          "bg-white shadow-xl flex flex-col",
          isMobile ? "w-full h-full rounded-none" : "rounded-lg max-w-md w-full max-h-[95vh]"
        )}
        style={isMobile ? {
          marginTop: 'env(safe-area-inset-top, 0)',
          marginBottom: 'env(safe-area-inset-bottom, 0)'
        } : {}}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold mb-2">
                Upgrade to {tier === 'pro' ? 'Pro' : 'Enterprise'}
              </h2>
              <p className="text-gray-600 text-xs sm:text-sm">
                Pay with Debit or Credit Card (processed via PayPal) —{' '}
                <span className="font-semibold text-orange-600">{formatPrice(amount)}</span>
                {billingPeriod === 'annual' && ' /year'}
                {recurring && ' (recurring)'}
              </p>
              {billingPeriod === 'annual' && annualSavings.savingsPercentage > 0 && (
                <p className="text-green-600 text-xs sm:text-sm mt-1">
                  Save {annualSavings.savingsPercentage}% with annual billing
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content - Includes PayPal buttons */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 pb-4 sm:pb-8">
          {/* Billing period selector */}
          <div className="mb-4 space-y-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Billing period</label>
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={cn(
                    "flex-1 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border-2 transition-colors touch-manipulation min-h-[44px] text-sm sm:text-base font-medium",
                    billingPeriod === 'monthly'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  )}
                  disabled={loading}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('annual')}
                  className={cn(
                    "flex-1 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg border-2 transition-colors touch-manipulation min-h-[44px] text-sm sm:text-base font-medium",
                    billingPeriod === 'annual'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  )}
                  disabled={loading}
                >
                  <span className="block sm:inline">Annual</span>
                  {annualSavings.savingsPercentage > 0 && (
                    <span className="block sm:inline sm:ml-1 text-xs font-normal text-green-600">
                      (Save {annualSavings.savingsPercentage}%)
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2 border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
              <label className="flex items-start gap-3 text-sm cursor-pointer group touch-manipulation">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 rounded border-gray-300 focus:ring-orange-500 focus:ring-2 w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 group-hover:text-orange-600">
                      Subscribe for automatic renewal
                    </span>
                    {recurring && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  {recurring ? (
                    <div className="space-y-2">
                      <ul className="text-xs text-gray-600 space-y-1 ml-0">
                        <li className="flex items-center gap-1.5">
                          <span className="text-green-600">✓</span>
                          <span>Never lose access - automatic renewal</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-green-600">✓</span>
                          <span>Save time - no need to remember renewal dates</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span className="text-green-600">✓</span>
                          <span>Cancel anytime from your account</span>
                        </li>
                      </ul>
                      <Alert variant="info" className="text-xs border-blue-200 bg-blue-50 mt-2">
                        <div className="flex items-start gap-2">
                          <svg className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium text-blue-900 text-xs mb-0.5">PayPal account required for automatic renewal</p>
                            <p className="text-blue-800 text-xs leading-relaxed">
                              Don't have PayPal? Uncheck this box to pay once with your card. You can set up automatic renewal anytime later.
                            </p>
                          </div>
                        </div>
                      </Alert>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <span className="text-blue-600">💳</span>
                        <span>Pay once with your card (no PayPal account needed)</span>
                      </p>
                      <p className="text-gray-500 ml-5">
                        You'll receive email reminders before your plan expires
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              <div className="text-sm">
                {error}
                <div className="mt-2 text-xs text-gray-600">
                  {(() => {
                    const errorLower = error.toLowerCase();
                    if (errorLower.includes('insufficient')) return 'Error code: INSUFFICIENT_FUNDS';
                    if (errorLower.includes('expired')) return 'Error code: EXPIRED_CARD';
                    if (errorLower.includes('declined')) return 'Error code: DECLINED';
                    if (errorLower.includes('invalid card')) return 'Error code: INVALID_CARD';
                    if (errorLower.includes('cvv') || errorLower.includes('security code')) return 'Error code: INVALID_CVV';
                    if (errorLower.includes('zip') || errorLower.includes('billing address')) return 'Error code: INVALID_BILLING_ADDRESS';
                    if (errorLower.includes('network') || errorLower.includes('timeout')) return 'Error code: NETWORK_ERROR';
                    return 'Error code: PAYMENT_ERROR';
                  })()}
                </div>
              </div>
            </Alert>
          )}

          <form className="space-y-4" id="payment-form" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              disabled={loading}
              className="min-h-[44px] text-base sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              disabled={loading}
              className="min-h-[44px] text-base sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={loading}
              className="min-h-[44px] text-base sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (optional)
            </label>
            <Input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              disabled={loading}
              placeholder="+12125551234"
              className="min-h-[44px] text-base sm:text-sm"
            />
          </div>

          </form>

          {/* Payment Section - Inside scrollable area */}
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 space-y-3 pb-4">
            <p className="text-sm font-medium text-gray-700 text-center mb-2">Complete Payment</p>
            <div className="w-full">
              <PayPalButton
                tier={tier}
                firstName={formData.firstName}
                lastName={formData.lastName}
                email={formData.email}
                phoneNumber={formData.phoneNumber || undefined}
                recurring={recurring}
                billingPeriod={billingPeriod}
                disabled={loading}
                onError={handlePayPalError}
                onRedirect={() => setLoading(true)}
              />
            </div>
          </div>
        </div>

        {/* Footer with Cancel button - Fixed */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full touch-manipulation min-h-[44px]"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
