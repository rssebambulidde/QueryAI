'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { PayPalButton } from '@/components/payment/paypal-button';
import { getPricing, getAnnualSavings, formatPrice } from '@/lib/pricing';
import type { BillingPeriod } from '@/lib/pricing';

interface PaymentDialogProps {
  tier: 'starter' | 'premium' | 'pro';
  onClose: () => void;
  onSuccess?: () => void;
  /** When opening for "switch billing period", preselect monthly or annual. */
  initialBillingPeriod?: BillingPeriod;
  /** When true, preselect "Subscribe (recurring billing)" and use for subscription flows. */
  initialRecurring?: boolean;
}

export function PaymentDialog({ tier, onClose, onSuccess, initialBillingPeriod, initialRecurring }: PaymentDialogProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'UGX' | 'USD'>('USD');
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

  const amount = getPricing(tier, currency, billingPeriod);
  const annualSavings = getAnnualSavings(tier, currency);

  const handlePayPalError = (message: string) => {
    setError(message);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold mb-2">
            Upgrade to {tier === 'starter' ? 'Starter' : tier === 'premium' ? 'Premium' : 'Pro'}
          </h2>
          <p className="text-gray-600 text-sm">
            Pay with PayPal or Visa —{' '}
            <span className="font-semibold text-orange-600">{formatPrice(amount, currency)}</span>
            {billingPeriod === 'annual' && ' /year'}
            {recurring && ' (recurring)'}
          </p>
          {billingPeriod === 'annual' && annualSavings.savingsPercentage > 0 && (
            <p className="text-green-600 text-sm mt-1">
              Save {annualSavings.savingsPercentage}% with annual billing
            </p>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Currency Selection */}
          <div className="mb-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Currency <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCurrency('UGX')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  currency === 'UGX'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
                disabled={loading}
              >
                UGX
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  currency === 'USD'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
                disabled={loading}
              >
                USD
              </button>
            </div>

            {/* Billing period selector */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Billing period</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    billingPeriod === 'monthly'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  disabled={loading}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('annual')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    billingPeriod === 'annual'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  disabled={loading}
                >
                  Annual
                  {annualSavings.savingsPercentage > 0 && (
                    <span className="ml-1 text-xs font-normal text-green-600">
                      (Save {annualSavings.savingsPercentage}%)
                    </span>
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                disabled={loading}
                className="rounded border-gray-300"
              />
              Subscribe (recurring billing)
            </label>
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
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
              placeholder={currency === 'UGX' ? '+256712345678' : '+12125551234'}
            />
          </div>

          </form>
        </div>

        {/* Footer with buttons - Fixed */}
        <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50 space-y-3">
          <p className="text-sm text-gray-600 text-center mb-1">Pay with PayPal or use your Visa card via PayPal.</p>
          <PayPalButton
            tier={tier}
            currency={currency}
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
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
