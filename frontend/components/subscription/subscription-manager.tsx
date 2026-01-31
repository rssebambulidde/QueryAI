'use client';

import { useEffect, useState } from 'react';
import { subscriptionApi, usageApi, paymentApi, SubscriptionData, UsageLimit, Payment, BillingHistory, UsageStats, UsageWarnings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Check, X, Zap, FileText, Folder, Download, ChevronDown, ChevronUp, AlertCircle, ArrowUp, Search, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { PaymentDialog } from '@/components/payment/payment-dialog';
import { UsageDisplay } from '@/components/usage/usage-display';
import { getAnnualSavings, getPricing, formatPrice, isEnterpriseTier } from '@/lib/pricing';
import type { BillingPeriod } from '@/lib/pricing';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';

export function SubscriptionManager() {
  const { toast } = useToast();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingBilling, setSyncingBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'premium' | 'pro' | 'enterprise' | null>(null);
  const [paymentDialogInitialBilling, setPaymentDialogInitialBilling] = useState<BillingPeriod | undefined>();
  const [paymentDialogInitialRecurring, setPaymentDialogInitialRecurring] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistory | null>(null);
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [showDowngradeOptions, setShowDowngradeOptions] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [usageWarnings, setUsageWarnings] = useState<UsageWarnings | null>(null);
  const [paypalStatus, setPaypalStatus] = useState<{ status: string; next_billing_time?: string } | null>(null);

  useEffect(() => {
    loadSubscriptionData();
    loadBillingHistory();
    loadUsageStats();
    loadUsageWarnings();
    // Sync pending recurring payments from PayPal (callback may not run when Auto return OFF)
    paymentApi.syncSubscription().then((r) => {
      if (r.success && r.data?.synced) {
        loadSubscriptionData();
        loadBillingHistory();
      }
    }).catch(() => {});
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionApi.get();
      if (response.success && response.data) {
        setSubscriptionData(response.data);
        if (response.data.subscription?.paypal_subscription_id) {
          const paypalRes = await subscriptionApi.getPayPalStatus();
          if (paypalRes.success && paypalRes.data?.paypalStatus) {
            setPaypalStatus({
              status: paypalRes.data.paypalStatus.status,
              next_billing_time: paypalRes.data.paypalStatus.next_billing_time,
            });
          } else {
            setPaypalStatus(null);
          }
        } else {
          setPaypalStatus(null);
        }
      } else {
        setError(response.error?.message || 'Failed to load subscription data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const loadBillingHistory = async () => {
    try {
      const response = await subscriptionApi.getBillingHistory();
      if (response.success && response.data) {
        setBillingHistory(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load billing history:', err);
    }
  };

  const handleSyncBillingStatus = async () => {
    try {
      setSyncingBilling(true);
      const r = await paymentApi.syncSubscription();
      if (r.success && r.data?.synced) {
        toast.success('Subscription synced. Your plan has been updated.');
        await loadSubscriptionData();
        await loadBillingHistory();
      } else {
        toast.info(r.data?.message || 'No pending payments to sync.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync billing status');
    } finally {
      setSyncingBilling(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      const response = await usageApi.getCurrent();
      if (response.success && response.data) {
        setUsageStats(response.data.usage);
      }
    } catch (err: any) {
      console.error('Failed to load usage stats:', err);
    }
  };

  const loadUsageWarnings = async () => {
    try {
      const response = await usageApi.getWarnings();
      if (response.success && response.data) {
        setUsageWarnings(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load usage warnings:', err);
    }
  };

  const handleUpgrade = (tier: 'starter' | 'premium' | 'pro' | 'enterprise') => {
    setSelectedTier(tier);
    setPaymentDialogInitialBilling(undefined);
    setPaymentDialogInitialRecurring(false);
    setShowPaymentDialog(true);
  };

  const handleSwitchBillingPeriod = (targetPeriod: BillingPeriod) => {
    if (tier === 'free' || !['starter', 'premium', 'pro', 'enterprise'].includes(tier)) return;
    setSelectedTier(tier as 'starter' | 'premium' | 'pro' | 'enterprise');
    setPaymentDialogInitialBilling(targetPeriod);
    setPaymentDialogInitialRecurring(true);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentDialog(false);
    setSelectedTier(null);
    setPaymentDialogInitialBilling(undefined);
    setPaymentDialogInitialRecurring(false);
    await loadSubscriptionData();
    await loadBillingHistory();
  };

  const handleCancel = async (immediate: boolean = false) => {
    const message = immediate
      ? 'Are you sure you want to cancel your subscription immediately? You will lose access to premium features right away.'
      : 'Are you sure you want to cancel your subscription? It will remain active until the end of the current period.';
    
    if (!confirm(message)) {
      return;
    }

    try {
      setError(null);
      const response = await subscriptionApi.cancel(immediate);
      if (response.success) {
        await loadSubscriptionData();
        setShowCancelOptions(false);
      } else {
        setError(response.error?.message || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    }
  };

  const handleDowngrade = async (targetTier: 'free' | 'starter' | 'premium' | 'pro', immediate: boolean = false) => {
    const message = immediate
      ? `Are you sure you want to downgrade to ${targetTier} immediately? You will lose access to current tier features right away.`
      : `Are you sure you want to downgrade to ${targetTier}? The change will take effect at the end of the current period.`;
    
    if (!confirm(message)) {
      return;
    }

    try {
      setError(null);
      const response = await subscriptionApi.downgrade(targetTier, immediate);
      if (response.success) {
        await loadSubscriptionData();
        setShowDowngradeOptions(false);
      } else {
        setError(response.error?.message || 'Failed to downgrade subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to downgrade subscription');
    }
  };

  const handleDownloadInvoice = async (paymentId: string) => {
    try {
      const blob = await subscriptionApi.downloadInvoice(paymentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${paymentId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to download invoice');
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
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
  const billingPeriod = (subscription.billing_period ?? 'monthly') as BillingPeriod;
  const annualSavings = tier !== 'free' ? getAnnualSavings(tier, 'USD') : null;

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
      case 'enterprise':
        return 'from-indigo-600 to-slate-700';
      case 'pro':
        return 'from-purple-500 to-pink-500';
      case 'premium':
        return 'from-orange-500 to-orange-600';
      case 'starter':
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'Enterprise';
      case 'pro':
        return 'Pro';
      case 'premium':
        return 'Premium';
      case 'starter':
        return 'Starter';
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
            {tier !== 'free' && (
              <p className="text-white/80 text-sm mt-1">
                Billing: {billingPeriod === 'annual' ? 'Annual' : 'Monthly'}
                {paypalStatus && ` · Payment: PayPal`}
                {paypalStatus?.next_billing_time && ` · Next: ${new Date(paypalStatus.next_billing_time).toLocaleDateString()}`}
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

      {/* Payment method */}
      {tier !== 'free' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-600" />
            Payment method
          </h3>
          {(subscription.paypal_subscription_id || paypalStatus) ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">PayPal</p>
                  <p className="text-sm text-gray-600">
                    Billing: {billingPeriod === 'annual' ? 'Annual' : 'Monthly'}. Managed through PayPal.
                  </p>
                </div>
                <a
                  href="https://www.paypal.com/myaccount/autopay/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium text-sm"
                >
                  Manage in PayPal
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {(billingPeriod === 'monthly' && annualSavings && annualSavings.savingsPercentage > 0) || billingPeriod === 'annual' ? (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                  {billingPeriod === 'monthly' && annualSavings && annualSavings.savingsPercentage > 0 ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Switch to annual and save <span className="font-semibold text-green-600">{annualSavings.savingsPercentage}%</span>.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSwitchBillingPeriod('annual')}
                      >
                        Switch to annual
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwitchBillingPeriod('monthly')}
                    >
                      Switch to monthly
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Payment method not linked. Upgrade or renew via PayPal to set billing.</p>
          )}
        </div>
      )}

      {/* Tier Comparison Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Compare Plans</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">Feature</th>
                <th className="text-center p-3 font-semibold">Free</th>
                <th className="text-center p-3 font-semibold bg-blue-50">Starter</th>
                <th className="text-center p-3 font-semibold">Premium</th>
                <th className="text-center p-3 font-semibold">Pro</th>
                <th className="text-center p-3 font-semibold bg-indigo-50">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">Queries per month</td>
                <td className="p-3 text-center">50</td>
                <td className="p-3 text-center bg-blue-50">100</td>
                <td className="p-3 text-center">500</td>
                <td className="p-3 text-center">Unlimited</td>
                <td className="p-3 text-center bg-indigo-50">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Document uploads</td>
                <td className="p-3 text-center">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center bg-blue-50">3</td>
                <td className="p-3 text-center">10</td>
                <td className="p-3 text-center">Unlimited</td>
                <td className="p-3 text-center bg-indigo-50">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Topics</td>
                <td className="p-3 text-center">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center bg-blue-50">1</td>
                <td className="p-3 text-center">3</td>
                <td className="p-3 text-center">Unlimited</td>
                <td className="p-3 text-center bg-indigo-50">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Web searches</td>
                <td className="p-3 text-center">5</td>
                <td className="p-3 text-center bg-blue-50">10</td>
                <td className="p-3 text-center">50</td>
                <td className="p-3 text-center">200</td>
                <td className="p-3 text-center bg-indigo-50">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Team collaboration</td>
                <td className="p-3 text-center">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center bg-blue-50">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center bg-indigo-50">
                  <Check className="w-4 h-4 text-green-600 mx-auto" />
                </td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-semibold">Price (monthly)</td>
                <td className="p-3 text-center font-semibold">Free</td>
                <td className="p-3 text-center font-semibold bg-blue-50">{formatPrice(27000, 'UGX')}<br />{formatPrice(9, 'USD')}</td>
                <td className="p-3 text-center font-semibold">{formatPrice(50000, 'UGX')}<br />{formatPrice(15, 'USD')}</td>
                <td className="p-3 text-center font-semibold">{formatPrice(150000, 'UGX')}<br />{formatPrice(45, 'USD')}</td>
                <td className="p-3 text-center font-semibold bg-indigo-50">{formatPrice(getPricing('enterprise', 'UGX', 'monthly'), 'UGX')}<br />{formatPrice(getPricing('enterprise', 'USD', 'monthly'), 'USD')}</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Price (annual)</td>
                <td className="p-3 text-center font-semibold">—</td>
                <td className="p-3 text-center font-semibold bg-blue-50">{formatPrice(getPricing('starter', 'UGX', 'annual'), 'UGX')}<br />{formatPrice(getPricing('starter', 'USD', 'annual'), 'USD')}<br /><span className="text-green-600 text-xs font-normal">Save {getAnnualSavings('starter', 'USD').savingsPercentage}%</span></td>
                <td className="p-3 text-center font-semibold">{formatPrice(getPricing('premium', 'UGX', 'annual'), 'UGX')}<br />{formatPrice(getPricing('premium', 'USD', 'annual'), 'USD')}<br /><span className="text-green-600 text-xs font-normal">Save {getAnnualSavings('premium', 'USD').savingsPercentage}%</span></td>
                <td className="p-3 text-center font-semibold">{formatPrice(getPricing('pro', 'UGX', 'annual'), 'UGX')}<br />{formatPrice(getPricing('pro', 'USD', 'annual'), 'USD')}<br /><span className="text-green-600 text-xs font-normal">Save {getAnnualSavings('pro', 'USD').savingsPercentage}%</span></td>
                <td className="p-3 text-center font-semibold bg-indigo-50">{formatPrice(getPricing('enterprise', 'UGX', 'annual'), 'UGX')}<br />{formatPrice(getPricing('enterprise', 'USD', 'annual'), 'USD')}<br /><span className="text-green-600 text-xs font-normal">Save {getAnnualSavings('enterprise', 'USD').savingsPercentage}%</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        {tier === 'free' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => handleUpgrade('starter')}
              variant="outline"
              className="flex-1 min-w-[120px]"
            >
              Start with Starter
            </Button>
            <Button
              onClick={() => handleUpgrade('premium')}
              className="flex-1 min-w-[120px]"
            >
              Go Premium
            </Button>
            <Button
              onClick={() => handleUpgrade('enterprise')}
              variant="outline"
              className="flex-1 min-w-[120px] border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              Get Enterprise
            </Button>
          </div>
        )}
        {tier !== 'free' && !isEnterpriseTier(tier as 'free' | 'starter' | 'premium' | 'pro' | 'enterprise') && (
          <div className="mt-4">
            <Button
              onClick={() => handleUpgrade('enterprise')}
              variant="outline"
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              Upgrade to Enterprise
            </Button>
          </div>
        )}
      </div>


      {/* Usage Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Usage This Month</h3>
        {usageStats ? (
          <UsageDisplay compact={false} showWarnings={true} />
        ) : (
          <div className="space-y-4">
            {/* Fallback to old usage display if new API not available */}
            {/* Queries */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-600" />
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
                <div className="mt-2">
                  <Alert variant="error" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="ml-2">Query limit reached. Upgrade to continue using QueryAI.</span>
                  </Alert>
                  <Button
                    size="sm"
                    onClick={() => {
                      const upgradeTier = tier === 'free' ? 'starter' : tier === 'starter' ? 'premium' : 'premium';
                      handleUpgrade(upgradeTier);
                    }}
                    className="mt-2 w-full"
                  >
                    <ArrowUp className="h-3 w-3 mr-1" />
                    Upgrade Now
                  </Button>
                </div>
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
                {usage.documentUploads.remaining === 0 && (
                  <div className="mt-2">
                    <Alert variant="error" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="ml-2">Document upload limit reached. Upgrade for more uploads.</span>
                    </Alert>
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade('premium')}
                      className="mt-2 w-full"
                    >
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Upgrade Now
                    </Button>
                  </div>
                )}
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
                {usage.topics.remaining === 0 && (
                  <div className="mt-2">
                    <Alert variant="error" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="ml-2">Topic limit reached. Upgrade to create more topics.</span>
                    </Alert>
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade('premium')}
                      className="mt-2 w-full"
                    >
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Upgrade Now
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Web Searches */}
            {usage.tavilySearches && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Web Searches</span>
                  </div>
                  <span className="text-sm text-gray-600">{formatLimit(usage.tavilySearches)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      usage.tavilySearches.remaining === 0 ? 'bg-red-500' : usage.tavilySearches.remaining! < usage.tavilySearches.limit! * 0.2 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${getProgressPercentage(usage.tavilySearches)}%` }}
                  />
                </div>
                {usage.tavilySearches.remaining === 0 && (
                  <div className="mt-2">
                    <Alert variant="error" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="ml-2">Web search limit reached. Upgrade for more searches.</span>
                    </Alert>
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade('premium')}
                      className="mt-2 w-full"
                    >
                      <ArrowUp className="h-3 w-3 mr-1" />
                      Upgrade Now
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
            icon={<Search className="w-5 h-5" />}
            name="Web Search"
            enabled={true}
          />
          <FeatureItem
            icon={<Folder className="w-5 h-5" />}
            name="Topics"
            enabled={limits.features.documentUpload}
          />
          <FeatureItem
            icon={<Download className="w-5 h-5" />}
            name="Export to PDF"
            enabled={true}
          />
        </div>
      </div>

      {/* Upgrade Options - Always show exactly 3 upgrade options based on current tier */}
      {tier !== 'enterprise' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upgrade Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free tier: Show Starter, Premium, Pro */}
            {tier === 'free' && (
              <>
                <div className="border-2 border-blue-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Starter</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    100 queries/month, 3 documents, 1 topic, 10 web searches
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('starter');
                    }}
                    disabled={upgrading}
                    className="w-full"
                  >
                    Upgrade to Starter - UGX 27,000 / USD 9
                  </Button>
                </div>
                <div className="border-2 border-orange-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Premium</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    500 queries/month, 10 documents, 3 topics, 50 web searches
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('premium');
                    }}
                    disabled={upgrading}
                    className="w-full"
                  >
                    Upgrade to Premium - UGX 50,000 / USD 15
                  </Button>
                </div>
                <div className="border-2 border-purple-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Pro</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited queries, unlimited documents, unlimited topics, 200 web searches
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('pro');
                    }}
                    disabled={upgrading}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Pro - UGX 150,000 / USD 45
                  </Button>
                </div>
              </>
            )}
            {/* Starter tier: Show Premium, Pro, Enterprise */}
            {tier === 'starter' && (
              <>
                <div className="border-2 border-orange-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Premium</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    500 queries/month, 10 documents, 3 topics, 50 web searches
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('premium');
                    }}
                    disabled={upgrading}
                    className="w-full"
                  >
                    Upgrade to Premium - UGX 50,000 / USD 15
                  </Button>
                </div>
                <div className="border-2 border-purple-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Pro</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited queries, unlimited documents, unlimited topics, 200 web searches
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('pro');
                    }}
                    disabled={upgrading}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Pro - UGX 150,000 / USD 45
                  </Button>
                </div>
                <div className="border-2 border-gray-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Enterprise</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited everything, team collaboration, priority support
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('enterprise');
                    }}
                    disabled={upgrading}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Enterprise - UGX 300,000 / USD 99
                  </Button>
                </div>
              </>
            )}
            {/* Premium tier: Show Pro, Enterprise (only 2 higher tiers, add placeholder or show 3 with Pro highlighted) */}
            {tier === 'premium' && (
              <>
                <div className="border-2 border-purple-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Pro</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited queries, unlimited documents, unlimited topics, 200 web searches
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('pro');
                    }}
                    disabled={upgrading}
                    className="w-full"
                  >
                    Upgrade to Pro - UGX 150,000 / USD 45
                  </Button>
                </div>
                <div className="border-2 border-gray-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Enterprise</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited everything, team collaboration, priority support
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('enterprise');
                    }}
                    disabled={upgrading}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Enterprise - UGX 300,000 / USD 99
                  </Button>
                </div>
                {/* Empty placeholder to maintain 3-column grid */}
                <div className="border-2 border-transparent rounded-lg p-4 opacity-0 pointer-events-none">
                  <h4 className="font-semibold text-lg mb-2">Placeholder</h4>
                  <p className="text-gray-600 text-sm mb-4">Placeholder</p>
                  <Button disabled className="w-full">Placeholder</Button>
                </div>
              </>
            )}
            {/* Pro tier: Show Enterprise only (add 2 placeholders to maintain 3-column grid) */}
            {tier === 'pro' && (
              <>
                <div className="border-2 border-gray-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Enterprise</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited everything, team collaboration, priority support
                  </p>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUpgrade('enterprise');
                    }}
                    disabled={upgrading}
                    className="w-full"
                  >
                    Upgrade to Enterprise - UGX 300,000 / USD 99
                  </Button>
                </div>
                {/* Empty placeholders to maintain 3-column grid */}
                <div className="border-2 border-transparent rounded-lg p-4 opacity-0 pointer-events-none">
                  <h4 className="font-semibold text-lg mb-2">Placeholder</h4>
                  <p className="text-gray-600 text-sm mb-4">Placeholder</p>
                  <Button disabled className="w-full">Placeholder</Button>
                </div>
                <div className="border-2 border-transparent rounded-lg p-4 opacity-0 pointer-events-none">
                  <h4 className="font-semibold text-lg mb-2">Placeholder</h4>
                  <p className="text-gray-600 text-sm mb-4">Placeholder</p>
                  <Button disabled className="w-full">Placeholder</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Downgrade Options */}
      {tier !== 'free' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Change Plan</h3>
            <button
              onClick={() => setShowDowngradeOptions(!showDowngradeOptions)}
              className="text-orange-600 hover:text-orange-700"
            >
              {showDowngradeOptions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          {showDowngradeOptions && (
            <div className="space-y-3 mt-4">
              {tier === 'enterprise' && (
                <>
                  <Button
                    onClick={() => handleUpgrade('pro')}
                    variant="outline"
                    className="w-full"
                  >
                    Change to Pro
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('pro', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Pro (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('premium', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Premium (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('starter', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Starter (at period end)
                  </Button>
                </>
              )}
              {tier === 'pro' && (
                <>
                  <Button
                    onClick={() => handleUpgrade('enterprise')}
                    variant="outline"
                    className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    Upgrade to Enterprise
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('premium', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Premium (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('premium', true)}
                    variant="outline"
                    className="w-full border-orange-500 text-orange-600"
                  >
                    Downgrade to Premium (immediate)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('starter', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Starter (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('starter', true)}
                    variant="outline"
                    className="w-full border-blue-500 text-blue-600"
                  >
                    Downgrade to Starter (immediate)
                  </Button>
                </>
              )}
              {tier === 'premium' && (
                <>
                  <Button
                    onClick={() => handleUpgrade('pro')}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Pro
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('enterprise')}
                    variant="outline"
                    className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    Upgrade to Enterprise
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('starter', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Starter (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('starter', true)}
                    variant="outline"
                    className="w-full border-blue-500 text-blue-600"
                  >
                    Downgrade to Starter (immediate)
                  </Button>
                </>
              )}
              {tier === 'starter' && (
                <>
                  <Button
                    onClick={() => handleUpgrade('premium')}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Premium
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('pro')}
                    variant="outline"
                    className="w-full"
                  >
                    Upgrade to Pro
                  </Button>
                  <Button
                    onClick={() => handleUpgrade('enterprise')}
                    variant="outline"
                    className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    Upgrade to Enterprise
                  </Button>
                </>
              )}
              {(tier === 'pro' || tier === 'premium' || tier === 'starter' || tier === 'enterprise') && (
                <>
                  <div className="border-t my-3"></div>
                  <Button
                    onClick={() => handleDowngrade('free', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Free (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngrade('free', true)}
                    variant="outline"
                    className="w-full border-red-500 text-red-600 hover:bg-red-50"
                  >
                    Downgrade to Free (immediate)
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancel Subscription */}
      {tier !== 'free' && !subscription.cancel_at_period_end && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-red-600">Cancel Subscription</h3>
            <button
              onClick={() => setShowCancelOptions(!showCancelOptions)}
              className="text-red-600 hover:text-red-700"
            >
              {showCancelOptions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          {showCancelOptions && (
            <div className="space-y-3 mt-4">
              <Button
                onClick={() => handleCancel(false)}
                variant="outline"
                className="w-full border-red-500 text-red-600 hover:bg-red-50"
              >
                Cancel at Period End
              </Button>
              <Button
                onClick={() => handleCancel(true)}
                variant="outline"
                className="w-full border-red-600 bg-red-50 text-red-700 hover:bg-red-100"
              >
                Cancel Immediately
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Billing History */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Billing History</h3>
          <div className="flex items-center gap-2">
            {billingHistory?.payments.some((p) => p.status === 'pending') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncBillingStatus}
                disabled={syncingBilling}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncingBilling ? 'animate-spin' : ''}`} />
                {syncingBilling ? 'Syncing...' : 'Sync billing status'}
              </Button>
            )}
            <button
              onClick={() => setShowBillingHistory(!showBillingHistory)}
              className="text-orange-600 hover:text-orange-700"
            >
              {showBillingHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {showBillingHistory && (
          <div className="mt-4">
            {billingHistory?.payments.some((p) => p.status === 'pending') && (
              <Alert variant="info" className="mb-4">
                Pending recurring payments detected. If you completed payment on PayPal, click &quot;Sync billing status&quot; above to update your plan.
              </Alert>
            )}
            {billingHistory && billingHistory.payments.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2">
                  <div className="md:col-span-4">Description</div>
                  <div className="md:col-span-2">Provider</div>
                  <div className="md:col-span-2">Date</div>
                  <div className="md:col-span-2">Status</div>
                  <div className="md:col-span-2 text-right">Invoice</div>
                </div>
                {billingHistory.payments.map((payment: Payment) => {
                  const providerLabel =
                    payment.payment_provider === 'paypal' ||
                    payment.paypal_order_id ||
                    payment.paypal_payment_id ||
                    payment.paypal_subscription_id
                      ? 'PayPal'
                      : payment.payment_method || '—';
                  return (
                    <div
                      key={payment.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50"
                    >
                      <div className="md:col-span-4 min-w-0">
                        <div className="font-medium">
                          {payment.tier.toUpperCase()} — {payment.currency} {payment.amount.toLocaleString()}
                        </div>
                        {payment.payment_description && (
                          <div className="text-xs text-gray-500 truncate">{payment.payment_description}</div>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 md:col-span-2">{providerLabel}</div>
                      <div className="text-sm text-gray-600 md:col-span-2">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm md:col-span-2">
                        <span
                          className={
                            payment.status === 'completed'
                              ? 'text-green-600'
                              : payment.status === 'failed' || payment.status === 'cancelled'
                                ? 'text-red-600'
                                : 'text-amber-600'
                          }
                        >
                          {payment.status}
                        </span>
                      </div>
                      <div className="md:col-span-2 md:text-right">
                        {payment.status === 'completed' && (
                          <Button
                            onClick={() => handleDownloadInvoice(payment.id)}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Invoice
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">No billing history found</p>
            )}
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      {showPaymentDialog && selectedTier && (
        <PaymentDialog
          tier={selectedTier}
          onClose={() => {
            setShowPaymentDialog(false);
            setSelectedTier(null);
            setPaymentDialogInitialBilling(undefined);
            setPaymentDialogInitialRecurring(false);
          }}
          onSuccess={handlePaymentSuccess}
          initialBillingPeriod={paymentDialogInitialBilling}
          initialRecurring={paymentDialogInitialRecurring}
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
