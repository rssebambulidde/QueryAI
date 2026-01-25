'use client';

import { useState } from 'react';
import { paymentApi, PaymentInitiateRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface PaymentDialogProps {
  tier: 'premium' | 'pro';
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaymentDialog({ tier, onClose, onSuccess }: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'UGX' | 'USD'>('UGX');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });

  const tierPricing: Record<'premium' | 'pro', Record<'UGX' | 'USD', number>> = {
    premium: { UGX: 50000, USD: 15 },
    pro: { UGX: 150000, USD: 45 },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await paymentApi.initiate({
        tier,
        currency,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber || undefined,
      });

      if (response.success && response.data) {
        // Redirect to Pesapal payment page
        window.location.href = response.data.redirect_url;
      } else {
        setError(response.error?.message || 'Failed to initiate payment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">
          Upgrade to {tier === 'premium' ? 'Premium' : 'Pro'}
        </h2>
        <p className="text-gray-600 mb-4">
          You will be redirected to Pesapal to complete your payment of{' '}
          <span className="font-semibold">{currency} {tierPricing[tier][currency].toLocaleString()}</span>
        </p>

        {/* Currency Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Currency <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCurrency('UGX')}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                currency === 'UGX'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
              disabled={loading}
            >
              UGX (Ugandan Shilling)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                currency === 'USD'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
              disabled={loading}
            >
              USD (US Dollar)
            </button>
          </div>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ${currency} ${tierPricing[tier][currency].toLocaleString()}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
