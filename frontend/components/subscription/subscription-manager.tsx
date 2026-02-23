'use client';

import { useEffect, useState } from 'react';
import { subscriptionApi, usageApi, paymentApi, SubscriptionData, UsageLimit, Payment, BillingHistory, UsageStats, UsageWarnings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { Check, X, Zap, Folder, Download, ChevronDown, ChevronUp, AlertCircle, ArrowUp, Search, CreditCard, ExternalLink, RefreshCw, Pause, Play } from 'lucide-react';
import { PaymentDialog } from '@/components/payment/payment-dialog';
import { UsageDisplay } from '@/components/usage/usage-display';
import { usePricing } from '@/lib/hooks/use-pricing';
import { useTierLimits } from '@/lib/hooks/useTierLimits';
import type { BillingPeriod, Tier } from '@/lib/pricing';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { getPaymentErrorMessage } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function SubscriptionManager() {
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const { getPricing, getAnnualSavings, formatPrice, isEnterpriseTier } = usePricing();
  const { getLimits: getDynamicLimits } = useTierLimits();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingBilling, setSyncingBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'pro' | 'enterprise' | null>(null);
  const [paymentDialogInitialBilling, setPaymentDialogInitialBilling] = useState<BillingPeriod | undefined>();
  const [paymentDialogInitialRecurring, setPaymentDialogInitialRecurring] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistory | null>(null);
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [showDowngradeOptions, setShowDowngradeOptions] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [downgradeTargetTier, setDowngradeTargetTier] = useState<'free' | 'pro' | null>(null);
  const [downgradeImmediate, setDowngradeImmediate] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [usageWarnings, setUsageWarnings] = useState<UsageWarnings | null>(null);
  const [paypalStatus, setPaypalStatus] = useState<{ status: string; next_billing_time?: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [previousPaymentStatuses, setPreviousPaymentStatuses] = useState<Map<string, string>>(new Map());
  const [gracePeriodTimeRemaining, setGracePeriodTimeRemaining] = useState<string>('');
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [pauseDays, setPauseDays] = useState(14);
  const [pauseReason, setPauseReason] = useState('');
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
    loadBillingHistory();
    loadUsageStats();
    loadUsageWarnings();
    // Auto-sync disabled - user can manually sync using the "Sync billing status" button
    // paymentApi.syncSubscription().then((r) => {
    //   if (r.success && r.data?.synced) {
    //     loadSubscriptionData();
    //     loadBillingHistory();
    //   }
    // }).catch(() => {});
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
        // Detect status changes and show notifications
        const newStatuses = new Map<string, string>();
        let hasCompletedPayment = false;
        
        response.data.payments.forEach((payment: Payment) => {
          newStatuses.set(payment.id, payment.status);
          
          // Check if status changed
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
      setLastSyncTime(new Date()); // Track last sync time
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

  // Auto-retry sync for pending payments after 5 minutes - DISABLED
  // useEffect(() => {
  //   const pendingPayments = billingHistory?.payments.filter((p) => p.status === 'pending');
  //   if (!pendingPayments || pendingPayments.length === 0) return;
  //   if (syncingBilling) return; // Don't auto-sync if already syncing

  //   // Check if any pending payment is older than 5 minutes
  //   const now = Date.now();
  //   const hasOldPendingPayment = pendingPayments.some((payment) => {
  //     const paymentAge = now - new Date(payment.created_at).getTime();
  //     return paymentAge > 5 * 60 * 1000; // 5 minutes
  //   });

  //   if (!hasOldPendingPayment) return;

  //   // Auto-retry sync if last sync was more than 5 minutes ago or never synced
  //   const shouldAutoSync = !lastSyncTime || (now - lastSyncTime.getTime() > 5 * 60 * 1000);

  //   if (shouldAutoSync) {
  //     const autoSyncTimer = setTimeout(async () => {
  //       try {
  //         setSyncingBilling(true);
  //         const r = await paymentApi.syncSubscription();
  //         setLastSyncTime(new Date());
  //         if (r.success && r.data?.synced) {
  //           await loadSubscriptionData();
  //           await loadBillingHistory();
  //         }
  //       } catch (err) {
  //         // Silently fail for auto-sync
  //       } finally {
  //         setSyncingBilling(false);
  //       }
  //     }, 1000); // Wait 1 second to avoid immediate sync on mount

  //     return () => clearTimeout(autoSyncTimer);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [billingHistory, lastSyncTime, syncingBilling]);

  // Real-time polling for pending payments (every 30 seconds) - DISABLED
  // useEffect(() => {
  //   const pendingPayments = billingHistory?.payments.filter((p) => p.status === 'pending');
  //   if (!pendingPayments || pendingPayments.length === 0) {
  //     // No pending payments, stop polling
  //     return;
  //   }

  //   // Poll every 30 seconds
  //   const interval = setInterval(async () => {
  //     try {
  //       // Refresh billing history (will auto-refresh subscription data if payment completed)
  //       const hadCompletedPayment = await loadBillingHistory();
  //       // Always refresh subscription data to ensure it's up to date
  //       await loadSubscriptionData();
  //     } catch (err) {
  //       // Silently fail for polling - don't spam errors
  //       console.debug('Payment status polling error:', err);
  //     }
  //   }, 30000); // Poll every 30 seconds

  //   return () => clearInterval(interval);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [billingHistory]);

  // Grace period countdown timer - must be before early returns
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
    const interval = setInterval(updateTimer, 60000); // Update every minute
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

  const handleUpgrade = (tier: 'pro' | 'enterprise') => {
    setSelectedTier(tier);
    setPaymentDialogInitialBilling(undefined);
    setPaymentDialogInitialRecurring(false);
    setShowPaymentDialog(true);
  };

  const handleSwitchBillingPeriod = (targetPeriod: BillingPeriod) => {
    if (tier === 'free' || !['pro', 'enterprise'].includes(tier)) return;
    setSelectedTier(tier as 'pro' | 'enterprise');
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

  const handleDowngradeClick = (targetTier: 'free' | 'pro', immediate: boolean = false) => {
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

  const handlePauseSubscription = async () => {
    try {
      setPausing(true);
      setError(null);
      const response = await subscriptionApi.pause(pauseDays, pauseReason || undefined);
      if (response.success) {
        toast({
          title: 'Subscription paused',
          description: `Your subscription has been paused for ${pauseDays} days.`,
        });
        await loadSubscriptionData();
        setShowPauseConfirm(false);
        setPauseReason('');
      } else {
        setError(response.error?.message || 'Failed to pause subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to pause subscription');
    } finally {
      setPausing(false);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      setResuming(true);
      setError(null);
      const response = await subscriptionApi.resume();
      if (response.success) {
        toast({
          title: 'Subscription resumed',
          description: 'Your subscription is now active again.',
        });
        await loadSubscriptionData();
      } else {
        setError(response.error?.message || 'Failed to resume subscription');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resume subscription');
    } finally {
      setResuming(false);
    }
  };

  const handleUpdatePaymentMethod = () => {
    // Open payment dialog to update payment method
    // For recurring subscriptions, this will allow updating the payment method
    if (subscriptionData?.subscription && subscriptionData.subscription.tier !== 'free') {
      const sub = subscriptionData.subscription;
      setSelectedTier(sub.tier as 'pro' | 'enterprise');
      setPaymentDialogInitialBilling(sub.billing_period || 'monthly');
      setPaymentDialogInitialRecurring(!!sub.paypal_subscription_id);
      setShowPaymentDialog(true);
    }
  };

  const handleRetryPayment = (paymentId: string) => {
    // Find the failed payment and pre-fill payment dialog with its details
    const payment = billingHistory?.payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== 'failed') return;

    // Pre-fill payment dialog with failed payment details
    setSelectedTier(payment.tier as 'pro' | 'enterprise');
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
  const tier = subscription.tier as Tier;
  const billingPeriod = (subscription.billing_period ?? 'monthly') as BillingPeriod;
  const annualSavings = tier !== 'free' ? getAnnualSavings(tier) : null;

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
      default:
        return 'Free';
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
                  title={syncingBilling ? 'Syncing subscription...' : 'Sync subscription status'}
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
                Reactivate your subscription to regain access to Pro features.
              </p>
              <div className="flex gap-2 flex-wrap">
                {(() => {
                  // Find the last paid tier from billing history
                  const lastPaidPayment = billingHistory?.payments
                    .filter((p) => p.status === 'completed' && p.tier !== 'free')
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                  
                  const previousTier = lastPaidPayment?.tier || 'pro';
                  
                  return (
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade(previousTier as 'pro' | 'enterprise')}
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
                <th className="text-center p-3 font-semibold bg-purple-50">Pro</th>
                <th className="text-center p-3 font-semibold bg-indigo-50">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-3">Queries per month</td>
                <td className="p-3 text-center">{getDynamicLimits('free').queriesPerMonth === null ? 'Unlimited' : getDynamicLimits('free').queriesPerMonth?.toLocaleString()}</td>
                <td className="p-3 text-center bg-purple-50">{getDynamicLimits('pro').queriesPerMonth === null ? 'Unlimited' : getDynamicLimits('pro').queriesPerMonth?.toLocaleString()}</td>
                <td className="p-3 text-center bg-indigo-50">{getDynamicLimits('enterprise').queriesPerMonth === null ? 'Unlimited' : getDynamicLimits('enterprise').queriesPerMonth?.toLocaleString()}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Chat modes</td>
                <td className="p-3 text-center">{getDynamicLimits('free').allowResearchMode ? 'Both modes' : 'Express Chat only'}</td>
                <td className="p-3 text-center bg-purple-50">{getDynamicLimits('pro').allowResearchMode ? 'Both modes' : 'Express Chat only'}</td>
                <td className="p-3 text-center bg-indigo-50">{getDynamicLimits('enterprise').allowResearchMode ? 'Both modes' : 'Express Chat only'}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Collections</td>
                <td className="p-3 text-center">{getDynamicLimits('free').maxCollections === null ? 'Unlimited' : getDynamicLimits('free').maxCollections}</td>
                <td className="p-3 text-center bg-purple-50">{getDynamicLimits('pro').maxCollections === null ? 'Unlimited' : getDynamicLimits('pro').maxCollections}</td>
                <td className="p-3 text-center bg-indigo-50">{getDynamicLimits('enterprise').maxCollections === null ? 'Unlimited' : getDynamicLimits('enterprise').maxCollections}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3">Web searches</td>
                <td className="p-3 text-center">{getDynamicLimits('free').tavilySearchesPerMonth === null ? 'Unlimited' : getDynamicLimits('free').tavilySearchesPerMonth?.toLocaleString()}</td>
                <td className="p-3 text-center bg-purple-50">{getDynamicLimits('pro').tavilySearchesPerMonth === null ? 'Unlimited' : getDynamicLimits('pro').tavilySearchesPerMonth?.toLocaleString()}</td>
                <td className="p-3 text-center bg-indigo-50">{getDynamicLimits('enterprise').tavilySearchesPerMonth === null ? 'Unlimited' : getDynamicLimits('enterprise').tavilySearchesPerMonth?.toLocaleString()}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 font-semibold">Price (monthly)</td>
                <td className="p-3 text-center font-semibold">Free</td>
                <td className="p-3 text-center font-semibold bg-purple-50">{formatPrice(getPricing('pro', 'monthly'))}</td>
                <td className="p-3 text-center font-semibold bg-indigo-50">{formatPrice(getPricing('enterprise', 'monthly'))}</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Price (annual)</td>
                <td className="p-3 text-center font-semibold">—</td>
                <td className="p-3 text-center font-semibold bg-purple-50">{formatPrice(getPricing('pro', 'annual'))}<br /><span className="text-green-600 text-xs font-normal">Save {getAnnualSavings('pro').savingsPercentage}%</span></td>
                <td className="p-3 text-center font-semibold bg-indigo-50">{formatPrice(getPricing('enterprise', 'annual'))}<br /><span className="text-green-600 text-xs font-normal">Save {getAnnualSavings('enterprise').savingsPercentage}%</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        {tier === 'free' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => handleUpgrade('pro')}
              className="flex-1 min-w-[120px]"
            >
              Upgrade to Pro
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
        {tier === 'pro' && (
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
                      handleUpgrade('pro');
                    }}
                    className="mt-2 w-full"
                  >
                    <ArrowUp className="h-3 w-3 mr-1" />
                    Upgrade Now
                  </Button>
                </div>
              )}
            </div>

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
                      onClick={() => handleUpgrade('pro')}
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
            icon={<Zap className="w-5 h-5" />}
            name="Research Mode"
            enabled={getDynamicLimits(tier as any).allowResearchMode}
          />
          <FeatureItem
            icon={<Search className="w-5 h-5" />}
            name="Web Search"
            enabled={true}
          />
          <FeatureItem
            icon={<Folder className="w-5 h-5" />}
            name="Collections"
            enabled={true}
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
            {/* Free tier: Show Pro and Enterprise */}
            {tier === 'free' && (
              <>
                <div className="border-2 border-purple-500 rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-2">Pro</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Unlimited queries, both chat modes, unlimited collections, 200 web searches
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
                    Upgrade to Pro - {formatPrice(getPricing('pro', 'monthly'))}/mo
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
                    Upgrade to Enterprise - {formatPrice(getPricing('enterprise', 'monthly'))}/mo
                  </Button>
                </div>
              </>
            )}
            {/* Pro tier: Show Enterprise only */}
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
                    Upgrade to Enterprise - {formatPrice(getPricing('enterprise', 'monthly'))}/mo
                  </Button>
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
                    onClick={() => handleDowngradeClick('pro', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Pro (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngradeClick('pro', true)}
                    variant="outline"
                    className="w-full border-orange-500 text-orange-600"
                  >
                    Downgrade to Pro (immediate)
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
                </>
              )}
              {(tier === 'pro' || tier === 'enterprise') && (
                <>
                  <div className="border-t my-3"></div>
                  <Button
                    onClick={() => handleDowngradeClick('free', false)}
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade to Free (at period end)
                  </Button>
                  <Button
                    onClick={() => handleDowngradeClick('free', true)}
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

      {/* Subscription Paused Banner */}
      {subscription.status === 'suspended' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-3">
            <Pause className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-amber-700">Subscription Paused</h3>
          </div>
          <p className="text-sm text-amber-700 mb-1">
            Your <strong>{tier.toUpperCase()}</strong> subscription is currently paused.
            {subscription.pause_expires_at && (
              <> It will automatically revert to Free on{' '}
              <strong>
                {new Date(subscription.pause_expires_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </strong>.
              </>
            )}
          </p>
          {subscription.pause_reason && (
            <p className="text-xs text-amber-600 mb-3">Reason: {subscription.pause_reason}</p>
          )}
          <Button
            onClick={handleResumeSubscription}
            disabled={resuming}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            {resuming ? 'Resuming...' : 'Resume Subscription'}
          </Button>
        </div>
      )}

      {/* Pause Subscription */}
      {tier !== 'free' && subscription.status === 'active' && !subscription.cancel_at_period_end && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-amber-600">Pause Subscription</h3>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Need a break? Pause your subscription for up to 30 days. You keep your tier until the pause expires.
          </p>
          {!showPauseConfirm ? (
            <Button
              onClick={() => setShowPauseConfirm(true)}
              variant="outline"
              className="border-amber-400 text-amber-600 hover:bg-amber-50"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause Subscription
            </Button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Pause duration (days)</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={pauseDays}
                  onChange={(e) => setPauseDays(Math.min(30, Math.max(1, Number(e.target.value))))}
                  className="mt-1 w-32"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
                <Input
                  type="text"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g. Going on vacation"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handlePauseSubscription}
                  disabled={pausing}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {pausing ? 'Pausing...' : `Pause for ${pauseDays} days`}
                </Button>
                <Button
                  onClick={() => { setShowPauseConfirm(false); setPauseReason(''); }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
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
                onClick={() => handleCancelClick(false)}
                variant="outline"
                className="w-full border-red-500 text-red-600 hover:bg-red-50"
              >
                Cancel at Period End
              </Button>
              <Button
                onClick={() => handleCancelClick(true)}
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
                className={`flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 ${
                  syncingBilling ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                title={syncingBilling ? 'Syncing subscription with PayPal...' : 'Sync billing status with PayPal'}
              >
                <RefreshCw className={`w-4 h-4 ${syncingBilling ? 'animate-spin' : ''}`} />
                {syncingBilling ? 'Syncing subscription...' : 'Sync billing status'}
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
              <>
                <Alert variant="info" className="mb-4">
                  Pending recurring payments detected. If you completed payment on PayPal, click &quot;Sync billing status&quot; above to update your plan.
                  {lastSyncTime && (
                    <span className="block mt-1 text-xs">
                      Last synced: {Math.floor((Date.now() - lastSyncTime.getTime()) / 60000)} minutes ago
                    </span>
                  )}
                </Alert>
                {billingHistory.payments
                  .filter((p) => p.status === 'pending')
                  .map((payment) => {
                    const timeSincePayment = payment.created_at
                      ? Math.floor((Date.now() - new Date(payment.created_at).getTime()) / 60000)
                      : 0;
                    
                    if (timeSincePayment > 5) {
                      return (
                        <Alert key={payment.id} variant="warning" className="mb-4">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm">
                                Payment has been pending for {timeSincePayment} minutes.
                                {timeSincePayment > 10 && ' This may indicate a payment issue.'}
                              </p>
                              <Button
                                size="sm"
                                onClick={handleSyncBillingStatus}
                                disabled={syncingBilling}
                                className={`flex items-center gap-1 mt-2 bg-amber-600 hover:bg-amber-700 text-white ${
                                  syncingBilling ? 'opacity-75 cursor-not-allowed' : ''
                                }`}
                                title={syncingBilling ? 'Syncing subscription...' : 'Retry syncing subscription status'}
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingBilling ? 'animate-spin' : ''}`} />
                                {syncingBilling ? 'Syncing...' : 'Sync Again'}
                              </Button>
                            </div>
                          </div>
                        </Alert>
                      );
                    }
                    return null;
                  })}
              </>
            )}
            {billingHistory && billingHistory.payments.length > 0 ? (
              <div className="space-y-3">
                {!isMobile && (
                  <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2">
                    <div className="col-span-4">Description</div>
                    <div className="col-span-2">Provider</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Invoice</div>
                  </div>
                )}
                {billingHistory.payments.map((payment: Payment) => {
                  // Determine payment method and details
                  const isPayPal = payment.payment_provider === 'paypal' ||
                    payment.paypal_order_id ||
                    payment.paypal_payment_id ||
                    payment.paypal_subscription_id ||
                    payment.payment_method === 'paypal';
                  
                  const paypalEmail = payment.callback_data?.payerEmail || payment.callback_data?.payer_email;
                  const cardLast4 = payment.callback_data?.last4 || payment.callback_data?.last_4;
                  const cardBrand = payment.callback_data?.card_brand || payment.callback_data?.cardBrand;
                  
                  // Build payment method display
                  let paymentMethodDisplay = '—';
                  if (isPayPal) {
                    paymentMethodDisplay = paypalEmail ? `PayPal • ${paypalEmail}` : 'PayPal';
                  } else if (cardLast4) {
                    const brand = cardBrand ? `${cardBrand} ` : '';
                    paymentMethodDisplay = `Card • ${brand}•••• ${cardLast4}`;
                  } else if (payment.payment_method) {
                    paymentMethodDisplay = payment.payment_method;
                  }
                  
                  // Calculate time since payment creation
                  const timeSincePayment = payment.created_at
                    ? Math.floor((Date.now() - new Date(payment.created_at).getTime()) / 60000)
                    : 0;
                  
                  if (isMobile) {
                    // Mobile: Card Layout
                    return (
                      <div
                        key={payment.id}
                        className="border rounded-lg p-4 space-y-3 hover:bg-gray-50/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {payment.tier.toUpperCase()} — {payment.currency} {payment.amount.toLocaleString()}
                            </div>
                            {payment.payment_description && (
                              <div className="text-xs text-gray-500 mt-1 break-words">{payment.payment_description}</div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <span
                              className={cn(
                                "text-xs font-medium px-2 py-1 rounded",
                                payment.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : payment.status === 'failed' || payment.status === 'cancelled'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                              )}
                            >
                              {payment.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Provider:</span>
                            {isPayPal ? (
                              <>
                                <span className="text-orange-600 font-semibold">PayPal</span>
                                {paypalEmail && (
                                  <span className="text-gray-500 truncate" title={paypalEmail}>
                                    • {paypalEmail}
                                  </span>
                                )}
                              </>
                            ) : cardLast4 ? (
                              <>
                                <CreditCard className="w-3 h-3 text-gray-500" />
                                <span>
                                  {cardBrand && <span className="capitalize">{cardBrand} </span>}
                                  •••• {cardLast4}
                                </span>
                              </>
                            ) : (
                              <span>{paymentMethodDisplay}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Date:</span>
                            <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                            {payment.status === 'pending' && (
                              <span className="text-gray-500">
                                {new Date(payment.created_at).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {payment.status === 'pending' && timeSincePayment > 0 && (
                            <div className="text-amber-600">
                              Pending for {timeSincePayment} {timeSincePayment === 1 ? 'minute' : 'minutes'}
                            </div>
                          )}
                          {payment.status === 'pending' && lastSyncTime && (
                            <div className="text-gray-500">
                              Last synced: {Math.floor((Date.now() - lastSyncTime.getTime()) / 60000)}m ago
                            </div>
                          )}
                        </div>
                        
                        {payment.status === 'failed' && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            {getPaymentErrorMessage(
                              payment.callback_data?.failure_reason || payment.callback_data?.failed_payment_reason || 'Payment failed',
                              payment
                            )}
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                          {payment.status === 'completed' && (
                            <Button
                              onClick={() => handleDownloadInvoice(payment.id)}
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px] touch-manipulation min-h-[44px] text-xs"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Invoice
                            </Button>
                          )}
                          {payment.status === 'failed' && (
                            <Button
                              onClick={() => handleRetryPayment(payment.id)}
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px] border-orange-500 text-orange-600 hover:bg-orange-50 touch-manipulation min-h-[44px] text-xs"
                            >
                              Retry Payment
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  // Desktop: Table Layout
                  return (
                    <div
                      key={payment.id}
                      className="grid grid-cols-12 gap-2 items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50"
                    >
                      <div className="col-span-4 min-w-0">
                        <div className="font-medium">
                          {payment.tier.toUpperCase()} — {payment.currency} {payment.amount.toLocaleString()}
                        </div>
                        {payment.payment_description && (
                          <div className="text-xs text-gray-500 truncate">{payment.payment_description}</div>
                        )}
                        {payment.status === 'failed' && (
                          <div className="text-xs text-red-600 mt-1">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            {getPaymentErrorMessage(
                              payment.callback_data?.failure_reason || payment.callback_data?.failed_payment_reason || 'Payment failed',
                              payment
                            )}
                          </div>
                        )}
                        {payment.status === 'pending' && timeSincePayment > 0 && (
                          <div className="text-xs text-amber-600 mt-1">
                            Pending for {timeSincePayment} {timeSincePayment === 1 ? 'minute' : 'minutes'}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          {isPayPal ? (
                            <>
                              <span className="text-orange-600 font-semibold text-xs">PayPal</span>
                              {paypalEmail && (
                                <span className="text-gray-500 text-xs truncate" title={paypalEmail}>
                                  • {paypalEmail}
                                </span>
                              )}
                            </>
                          ) : cardLast4 ? (
                            <>
                              <CreditCard className="w-4 h-4 text-gray-500" />
                              <span className="text-xs">
                                {cardBrand && <span className="capitalize">{cardBrand} </span>}
                                •••• {cardLast4}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs">{paymentMethodDisplay}</span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        {new Date(payment.created_at).toLocaleDateString()}
                        {payment.status === 'pending' && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(payment.created_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-sm">
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
                        {payment.status === 'pending' && lastSyncTime && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Last synced: {Math.floor((Date.now() - lastSyncTime.getTime()) / 60000)}m ago
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
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
                        {payment.status === 'failed' && (
                          <div className="flex flex-col gap-2 items-end">
                            <Button
                              onClick={() => handleRetryPayment(payment.id)}
                              variant="outline"
                              size="sm"
                              className="border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                              Retry Payment
                            </Button>
                            {(payment.callback_data?.failure_reason || payment.callback_data?.failed_payment_reason) && (
                              <span className="text-xs text-red-600 max-w-[200px] text-right">
                                {getPaymentErrorMessage(
                                  payment.callback_data?.failure_reason || payment.callback_data?.failed_payment_reason || 'Payment failed',
                                  payment
                                )}
                              </span>
                            )}
                          </div>
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

      {/* Cancel Subscription Confirmation Modal */}
      <ConfirmationModal
        open={showCancelConfirm}
        title="Cancel Subscription"
        message={
          cancelImmediate
            ? 'Are you sure you want to cancel your subscription immediately? You will lose access to Pro features right away and be downgraded to the free tier.'
            : 'Are you sure you want to cancel your subscription? It will remain active until the end of the current period, and then you will be downgraded to the free tier.'
        }
        confirmText={cancelImmediate ? 'Cancel Immediately' : 'Cancel at Period End'}
        cancelText="Keep Subscription"
        onConfirm={handleCancel}
        onCancel={() => setShowCancelConfirm(false)}
        variant="danger"
        isLoading={cancelling}
      />

      {/* Downgrade Confirmation Modal */}
      <ConfirmationModal
        open={showDowngradeConfirm && downgradeTargetTier !== null}
        title={`Downgrade to ${downgradeTargetTier ? getTierName(downgradeTargetTier) : ''}`}
        message={
          downgradeTargetTier && downgradeImmediate
            ? `Are you sure you want to downgrade to ${getTierName(downgradeTargetTier)} immediately? You will lose access to current tier features right away.`
            : downgradeTargetTier
              ? `Are you sure you want to downgrade to ${getTierName(downgradeTargetTier)}? The change will take effect at the end of the current period.`
              : ''
        }
        confirmText={downgradeImmediate ? 'Downgrade Immediately' : 'Downgrade at Period End'}
        cancelText="Keep Current Plan"
        onConfirm={handleDowngrade}
        onCancel={() => {
          setShowDowngradeConfirm(false);
          setDowngradeTargetTier(null);
        }}
        variant="warning"
        isLoading={downgrading}
      />
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
