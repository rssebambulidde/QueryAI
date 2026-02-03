'use client';
import { useEffect, useState } from 'react';
import { subscriptionApi, usageApi, paymentApi, SubscriptionData, UsageLimit, Payment, BillingHistory, UsageStats, UsageWarnings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Check, X, Zap, FileText, Folder, Download, ChevronDown, ChevronUp, AlertCircle, ArrowUp, Search, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { PaymentDialog } from '@/components/payment/payment-dialog';
import { UsageDisplay } from '@/components/usage/usage-display';
import { getAnnualSavings, getPricing, formatPrice, isEnterpriseTier } from '@/lib/pricing';
import type { BillingPeriod } from '@/lib/pricing';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { getPaymentErrorMessage } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function SubscriptionManager() {
  const { toast } = useToast();
  const { isMobile } = useMobile();
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [downgradeTargetTier, setDowngradeTargetTier] = useState<'free' | 'starter' | 'premium' | 'pro' | null>(null);
  const [downgradeImmediate, setDowngradeImmediate] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [usageWarnings, setUsageWarnings] = useState<UsageWarnings | null>(null);
  const [paypalStatus, setPaypalStatus] = useState<{ status: string; next_billing_time?: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [previousPaymentStatuses, setPreviousPaymentStatuses] = useState<Map<string, string>>(new Map());
  const [gracePeriodTimeRemaining, setGracePeriodTimeRemaining] = useState<string>('');

  useEffect(() => {
    loadSubscriptionData();
    loadBillingHistory();
    loadUsageStats();
    loadUsageWarnings();
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

  const loadBillingHistory = async (showNotifications: boolean = true): Promise<boolean> => {
    try {
      const response = await subscriptionApi.getBillingHistory();
      if (response.success && response.data) {
        const newStatuses = new Map<string, string>();
        let hasCompletedPayment = false;
        
        response.data.payments.forEach((payment: Payment) => {
          newStatuses.set(payment.id, payment.status);
          const previousStatus = previousPaymentStatuses.get(payment.id);
          if (previousStatus && previousStatus !== payment.status && showNotifications) {
            if (previousStatus === 'pending' && payment.status === 'completed') {
              toast.success(`Payment completed! Your ${payment.tier} subscription is now active.`);
              hasCompletedPayment = true;
            } else if (previousStatus === 'pending' && payment.status === 'failed') {
              const errorMessage = getPaymentErrorMessage(
                payment.callback_data?.failure_reason || payment.callback_data?.failed_payment_reason || 'Payment failed',
                payment
              );
              toast.error(errorMessage);
            }
          }
        });
        
        setPreviousPaymentStatuses(newStatuses);
        setBillingHistory(response.data);
        return hasCompletedPayment;
      }
      return false;
    } catch (err: any) {
      console.error('Failed to load billing history:', err);
      return false;
    }
  };

  const handleSyncBillingStatus = async () => {
    try {
      setSyncingBilling(true);
      const r = await paymentApi.syncSubscription();
      setLastSyncTime(new Date()); 
      if (r.success && r.data?.synced) {
        toast.success('Subscription synced successfully. Your plan has been updated.');
        await loadSubscriptionData();
        await loadBillingHistory();
      } else {
        toast.info(r.data?.message || 'No pending payments to sync. Your subscription is up to date.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sync billing status';
      toast.error(`Sync failed: ${errorMessage}. Please try again.`);
    } finally {
      setSyncingBilling(false);
    }
  };

  useEffect(() => {
    if (!subscriptionData?.subscription?.grace_period_end) {
      setGracePeriodTimeRemaining('');
      return;
    }
    const updateTimer = () => {
      const now = new Date();
      const end = new Date(subscriptionData.subscription.grace_period_end!);
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) {
        setGracePeriodTimeRemaining('Expired');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) {
        setGracePeriodTimeRemaining(`${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''} remaining`);
      } else if (hours > 0) {
        setGracePeriodTimeRemaining(`${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`);
      } else {
        setGracePeriodTimeRemaining(`${minutes} minute${minutes !== 1 ? 's' : ''} remaining`);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 60000); 
    return () => clearInterval(interval);
  }, [subscriptionData?.subscription?.grace_period_end]);

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

  const handleCancelClick = (immediate: boolean) => {
    setCancelImmediate(immediate);
    setShowCancelConfirm(true);
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);
      setError(null);
      const response = await subscriptionApi.cancel(cancelImmediate);
      if (response.success) {
        toast.success(
          cancelImmediate
            ? 'Subscription cancelled immediately. You have been downgraded to the free tier.'
            : 'Subscription will be cancelled at the end of the current period.'
        );
        await loadSubscriptionData();
        setShowCancelOptions(false);
        setShowCancelConfirm(false);
      } else {
        setError(response.error?.message || 'Failed to cancel subscription');
        setShowCancelConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
      setShowCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  const handleDowngradeClick = (targetTier: 'free' | 'starter' | 'premium' | 'pro', immediate: boolean = false) => {
    setDowngradeTargetTier(targetTier);
    setDowngradeImmediate(immediate);
    setShowDowngradeConfirm(true);
  };

  const handleDowngrade = async () => {
    if (!downgradeTargetTier) return;
    try {
      setDowngrading(true);
      setError(null);
      const response = await subscriptionApi.downgrade(downgradeTargetTier, downgradeImmediate);
      if (response.success) {
        toast.success(
          downgradeImmediate
            ? `Downgraded to ${downgradeTargetTier} tier immediately.`
            : `Downgrade to ${downgradeTargetTier} tier scheduled for end of current period.`
        );
        await loadSubscriptionData();
        setShowDowngradeOptions(false);
        setShowDowngradeConfirm(false);
      } else {
        setError(response.error?.message || 'Failed to downgrade subscription');
        setShowDowngradeConfirm(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to downgrade subscription');
      setShowDowngradeConfirm(false);
    } finally {
      setDowngrading(false);
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

  const handleUpdatePaymentMethod = () => {
    if (subscriptionData?.subscription && subscriptionData.subscription.tier !== 'free') {
      const sub = subscriptionData.subscription;
      setSelectedTier(sub.tier as 'starter' | 'premium' | 'pro' | 'enterprise');
      setPaymentDialogInitialBilling(sub.billing_period || 'monthly');
      setPaymentDialogInitialRecurring(!!sub.paypal_subscription_id);
      setShowPaymentDialog(true);
    }
  };

  const handleRetryPayment = (paymentId: string) => {
    const payment = billingHistory?.payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== 'failed') return;
    setSelectedTier(payment.tier as 'starter' | 'premium' | 'pro' | 'enterprise');
    setPaymentDialogInitialBilling(
      (payment.callback_data?.billing_period as BillingPeriod) || 'monthly'
    );
    setPaymentDialogInitialRecurring(!!payment.paypal_subscription_id);
    setShowPaymentDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          {/* INCREASED CONTRAST HERE */}
          <p className="mt-4 text-gray-700 font-medium">Loading subscription data...</p>
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

  // UPDATED: Darker gradients for better white text contrast
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'from-indigo-700 to-slate-900'; // Darker
      case 'pro':
        return 'from-purple-600 to-pink-700'; // Darker
      case 'premium':
        return 'from-orange-600 to-orange-800'; // Darker
      case 'starter':
        return 'from-blue-600 to-blue-800'; // Darker
      default:
        // CHANGED: from gray-400 (too light) to gray-800 (readable with white text)
        return 'from-gray-700 to-gray-900'; 
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'Enterprise';
      case 'pro': return 'Pro';
      case 'premium': return 'Premium';
      case 'starter': return 'Starter';
      default: return 'Free';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}
      
      {/* Grace Period Banner */}
      {subscription.grace_period_end && (
        <Alert variant="warning" className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900 mb-1">
                Payment Failed — Grace Period Active
              </div>
              <p className="text-sm text-amber-800 mb-3">
                Your payment failed and your subscription will expire{' '}
                {gracePeriodTimeRemaining ? `in ${gracePeriodTimeRemaining}` : `on ${new Date(subscription.grace_period_end).toLocaleDateString()}`}.
                Please update your payment method to avoid service interruption.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleUpdatePaymentMethod}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Update Payment Method
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncBillingStatus}
                  disabled={syncingBilling}
                  className={`flex items-center gap-1 border-amber-300 text-amber-800 hover:bg-amber-100 ${
                    syncingBilling ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${syncingBilling ? 'animate-spin' : ''}`} />
                  {syncingBilling ? 'Syncing...' : 'Sync Status'}
                </Button>
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Expired Subscription Banner */}
      {subscription.status === 'expired' && (
        <Alert variant="error" className="border-red-300 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-red-900 mb-1">
                Subscription Expired
              </div>
              <p className="text-sm text-red-800 mb-3">
                Your subscription has expired and you've been downgraded to the free tier. 
                Reactivate your subscription to regain access to premium features.
              </p>
              <div className="flex gap-2 flex-wrap">
                {(() => {
                  const lastPaidPayment = billingHistory?.payments
                    .filter((p) => p.status === 'completed' && p.tier !== 'free')
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                  
                  const previousTier = lastPaidPayment?.tier || 'starter';
                  
                  return (
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade(previousTier as 'starter' | 'premium' | 'pro' | 'enterprise')}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Reactivate {getTierName(previousTier)} Plan
                    </Button>
                  );
                })()}
              </div>
              <p className="text-xs text-red-700 mt-2">
                Or choose a different plan from the upgrade options below.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Current Subscription Card - FIXED CONTRAST */}
      <div className={`bg-gradient-to-r ${getTierColor(tier)} rounded-lg p-6 text-white shadow-md`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-white">Current Plan: {getTierName(tier)}</h2>
            {subscription.current_period_end && (
              // REMOVED opacity /80, now fully opaque or very light gray
              <p className="text-gray-50 font-medium">
                {subscription.cancel_at_period_end
                  ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
              </p>
            )}
            {tier !== 'free' && (
              <p className="text-gray-100 text-sm mt-1 font-medium">
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
              className="bg-white text-gray-900 hover:bg-gray-100 border-none font-semibold"
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Payment method */}
      {tier !== 'free' && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
            <CreditCard className="w-5 h-5 text-gray-700" />
            Payment method
          </h3>
          {(subscription.paypal_subscription_id || paypalStatus) ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">PayPal</p>
                  {/* Darkened text color */}
                  <p className="text-sm text-gray-700">
                    Billing: {billingPeriod === 'annual' ? 'Annual' : 'Monthly'}. Managed through PayPal.
                  </p>
                </div>
                <a
                  href="https://www.paypal.com/myaccount/autopay/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-orange-700 hover:text-orange-800 font-medium text-sm"
                >
                  Manage in PayPal
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {(billingPeriod === 'monthly' && annualSavings && annualSavings.savingsPercentage > 0) || billingPeriod === 'annual' ? (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200 mt-2">
                  {billingPeriod === 'monthly' && annualSavings && annualSavings.savingsPercentage > 0 ? (
                    <>
                      <p className="text-sm text-gray-700">
                        Switch to annual and save <span className="font-bold text-green-700">{annualSavings.savingsPercentage}%</span>.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSwitchBillingPeriod('annual')}
                        className="text-gray-800 border-gray-300"
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
                      className="text-gray-800 border-gray-300"
                    >
                      Switch to monthly
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-gray-700 text-sm">Payment method not linked. Upgrade or renew via PayPal to set billing.</p>
          )}
        </div>
      )}

      {/* Tier Comparison Table - FIXED TEXT COLORS */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
        <h3 className="text-lg font-bold mb-4 text-gray-900">Compare Plans</h3>
        <div className="overflow-x-auto">
          {/* Removed text-sm to increase size, added text-gray-900 */}
          <table className="w-full text-sm text-gray-900">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3 font-bold text-gray-900">Feature</th>
                <th className="text-center p-3 font-bold text-gray-900">Free</th>
                <th className="text-center p-3 font-bold bg-blue-50 text-blue-900">Starter</th>
                <th className="text-center p-3 font-bold text-gray-900">Premium</th>
                <th className="text-center p-3 font-bold text-gray-900">Pro</th>
                <th className="text-center p-3 font-bold bg-indigo-50 text-indigo-900">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="p-3 font-medium">Queries per month</td>
                <td className="p-3 text-center">50</td>
                <td className="p-3 text-center bg-blue-50 font-medium text-blue-900">100</td>
                <td className="p-3 text-center">500</td>
                <td className="p-3 text-center">Unlimited</td>
                <td className="p-3 text-center bg-indigo-50 font-medium text-indigo-900">Unlimited</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="p-3 font-medium">Document uploads</td>
                <td className="p-3 text-center">
                  <X className="w-4 h-4 text-gray-400 mx-auto" />
                </td>
                <td className="p-3 text-center bg-blue-50 font-medium text-blue-900">3</td>
                <td className="p-3 text-center">10</td>
                <td className="p-3 text-center">Unlimited</td>
                <td className="p-3 text-center bg-indigo-50 font-medium text-indigo-900">Unlimited</td>
              </tr>
              {/* ... Additional rows follow same pattern ... */}
              <tr className="border-b border-gray-100">
                <td className="p-3 font-medium">Web searches</td>
                <td className="p-3 text-center">5</td>
                <td className="p-3 text-center bg-blue-50 font-medium text-blue-900">10</td>
                <td className="p-3 text-center">50</td>
                <td className="p-3 text-center">200</td>
                <td className="p-3 text-center bg-indigo-50 font-medium text-indigo-900">Unlimited</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="p-3 font-bold">Price (monthly)</td>
                <td className="p-3 text-center font-bold">Free</td>
                <td className="p-3 text-center font-bold bg-blue-50 text-blue-900">{formatPrice(27000, 'UGX')}<br />{formatPrice(9, 'USD')}</td>
                <td className="p-3 text-center font-bold">{formatPrice(50000, 'UGX')}<br />{formatPrice(15, 'USD')}</td>
                <td className="p-3 text-center font-bold">{formatPrice(150000, 'UGX')}<br />{formatPrice(45, 'USD')}</td>
                <td className="p-3 text-center font-bold bg-indigo-50 text-indigo-900">{formatPrice(getPricing('enterprise', 'UGX', 'monthly'), 'UGX')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        defaultTier={selectedTier || 'starter'}
        defaultBillingPeriod={paymentDialogInitialBilling}
        isRecurringUpgrade={paymentDialogInitialRecurring}
        onSuccess={handlePaymentSuccess}
      />
      
      {/* Cancellation Confirmation */}
      <ConfirmationModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title={cancelImmediate ? "Cancel Immediately?" : "Cancel at Period End?"}
        description={
          cancelImmediate
            ? "You will lose access to premium features immediately. This action cannot be undone."
            : "You will retain access until the end of your current billing period. You can reactivate anytime."
        }
        confirmText={cancelling ? "Cancelling..." : "Confirm Cancellation"}
        variant="destructive"
      />

      {/* Downgrade Confirmation */}
      <ConfirmationModal
        isOpen={showDowngradeConfirm}
        onClose={() => setShowDowngradeConfirm(false)}
        onConfirm={handleDowngrade}
        title={`Downgrade to ${downgradeTargetTier}?`}
        description={
          downgradeImmediate
            ? "Changes will apply immediately."
            : "Changes will apply at the end of your current billing cycle."
        }
        confirmText={downgrading ? "Processing..." : "Confirm Downgrade"}
      />
    </div>
  );
}
