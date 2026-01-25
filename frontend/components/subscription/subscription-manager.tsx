'use client';

import { useEffect, useState } from 'react';
import { subscriptionApi, SubscriptionData, UsageLimit } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Check, X, Zap, FileText, Folder, BarChart3, Key, Sparkles } from 'lucide-react';
import { PaymentDialog } from '@/components/payment/payment-dialog';

export function SubscriptionManager() {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'premium' | 'pro' | null>(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionApi.get();
      if (response.success && response.data) {
        setSubscriptionData(response.data);
      } else {
        setError(response.error?.message || 'Failed to load subscription data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (tier: 'premium' | 'pro') => {
    setSelectedTier(tier);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentDialog(false);
    setSelectedTier(null);
    // Reload subscription data after payment
    await loadSubscriptionData();
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the current period.')) {
      return;
    }

    try {
      setError(null);
      const response = await subscriptionApi.cancel();
      if (response.success) {
        await loadSubscriptionData();
      } else {
        setError(response.error?.message || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    }
  };

  const handleReactivate = async () => {
    try {
      setError(null);
      const response = await subscriptionApi.reactivate();
      if (response.success) {
        await loadSubscriptionData();
      } else {
        setError(response.error?.message || 'Failed to reactivate subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reactivate subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  if (error && !subscriptionData) {
    return (
      <div className="p-4">
        <Alert variant="error">{error}</Alert>
        <Button onClick={loadSubscriptionData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className="p-4">
        <Alert variant="error">No subscription data available</Alert>
      </div>
    );
  }

  const { subscription, limits, usage } = subscriptionData;
  const tier = subscription.tier;

  const formatLimit = (limit: UsageLimit) => {
    if (limit.limit === null) {
      return 'Unlimited';
    }
    return `${limit.used} / ${limit.limit}`;
  };

  const getProgressPercentage = (limit: UsageLimit) => {
    if (limit.limit === null) return 0;
    return Math.min((limit.used / limit.limit) * 100, 100);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'from-purple-500 to-pink-500';
      case 'premium':
        return 'from-blue-500 to-indigo-500';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'Pro';
      case 'premium':
        return 'Premium';
      default:
        return 'Free';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {/* Current Subscription Card */}
      <div className={`bg-gradient-to-r ${getTierColor(tier)} rounded-lg p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Current Plan: {getTierName(tier)}</h2>
            {subscription.current_period_end && (
              <p className="text-white/80">
                {subscription.cancel_at_period_end
                  ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
              </p>
            )}
          </div>
          {subscription.cancel_at_period_end && (
            <Button
              onClick={handleReactivate}
              variant="outline"
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Usage This Month</h3>
        <div className="space-y-4">
          {/* Queries */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Queries</span>
              </div>
              <span className="text-sm text-gray-600">{formatLimit(usage.queries)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  usage.queries.remaining === 0 ? 'bg-red-500' : usage.queries.remaining! < usage.queries.limit! * 0.2 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${getProgressPercentage(usage.queries)}%` }}
              />
            </div>
            {usage.queries.remaining === 0 && (
              <p className="text-sm text-red-600 mt-1">Limit reached. Upgrade to continue.</p>
            )}
          </div>

          {/* Document Uploads */}
          {limits.features.documentUpload && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Document Uploads</span>
                </div>
                <span className="text-sm text-gray-600">{formatLimit(usage.documentUploads)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usage.documentUploads.remaining === 0 ? 'bg-red-500' : usage.documentUploads.remaining! < usage.documentUploads.limit! * 0.2 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${getProgressPercentage(usage.documentUploads)}%` }}
                />
              </div>
            </div>
          )}

          {/* Topics */}
          {limits.features.documentUpload && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-600" />
                  <span className="font-medium">Topics</span>
                </div>
                <span className="text-sm text-gray-600">{formatLimit(usage.topics)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    usage.topics.remaining === 0 ? 'bg-red-500' : usage.topics.remaining! < usage.topics.limit! * 0.2 ? 'bg-yellow-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${getProgressPercentage(usage.topics)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureItem
            icon={<FileText className="w-5 h-5" />}
            name="Document Upload"
            enabled={limits.features.documentUpload}
          />
          <FeatureItem
            icon={<Sparkles className="w-5 h-5" />}
            name="Embedding"
            enabled={limits.features.embedding}
          />
          <FeatureItem
            icon={<BarChart3 className="w-5 h-5" />}
            name="Analytics Dashboard"
            enabled={limits.features.analytics}
          />
          <FeatureItem
            icon={<Key className="w-5 h-5" />}
            name="API Access"
            enabled={limits.features.apiAccess}
          />
        </div>
      </div>

      {/* Upgrade Options */}
      {tier !== 'pro' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upgrade Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tier === 'free' && (
              <div className="border-2 border-blue-500 rounded-lg p-4">
                <h4 className="font-semibold text-lg mb-2">Premium</h4>
                <p className="text-gray-600 text-sm mb-4">
                  500 queries/month, 10 documents, 3 topics, analytics
                </p>
                <div className="space-y-2">
                  <Button
                    onClick={() => handleUpgrade('premium')}
                    disabled={upgrading}
                    className="w-full"
                  >
                    Upgrade to Premium - UGX 50,000 / USD 15
                  </Button>
                </div>
              </div>
            )}
            <div className={`border-2 ${tier === 'premium' ? 'border-purple-500' : 'border-gray-300'} rounded-lg p-4`}>
              <h4 className="font-semibold text-lg mb-2">Pro</h4>
              <p className="text-gray-600 text-sm mb-4">
                Unlimited queries, unlimited documents, unlimited topics, API access
              </p>
              <Button
                onClick={() => handleUpgrade('pro')}
                disabled={upgrading}
                variant={tier === 'premium' ? 'default' : 'outline'}
                className="w-full"
              >
                Upgrade to Pro - UGX 150,000 / USD 45
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription */}
      {tier !== 'free' && !subscription.cancel_at_period_end && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h3>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="border-red-500 text-red-600 hover:bg-red-50"
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* Payment Dialog */}
      {showPaymentDialog && selectedTier && (
        <PaymentDialog
          tier={selectedTier}
          onClose={() => {
            setShowPaymentDialog(false);
            setSelectedTier(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function FeatureItem({ icon, name, enabled }: { icon: React.ReactNode; name: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
      <div className={enabled ? 'text-green-600' : 'text-gray-400'}>{icon}</div>
      <span className="flex-1">{name}</span>
      {enabled ? (
        <Check className="w-5 h-5 text-green-600" />
      ) : (
        <X className="w-5 h-5 text-gray-400" />
      )}
    </div>
  );
}
