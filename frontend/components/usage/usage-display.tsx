'use client';

import { useEffect, useState, useCallback } from 'react';
import { usageApi, billingApi, UsageStats, UsageWarnings, OverageSummary } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Zap, ArrowUp, Search, CreditCard, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UsageDisplayProps {
  compact?: boolean;
  showWarnings?: boolean;
  /** Currency for overage display (default USD). */
  overageCurrency?: 'USD' | 'UGX';
}

export function UsageDisplay({ compact = false, showWarnings = true, overageCurrency = 'USD' }: UsageDisplayProps) {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [warnings, setWarnings] = useState<UsageWarnings | null>(null);
  const [overage, setOverage] = useState<OverageSummary | null>(null);
  const [overageLoading, setOverageLoading] = useState(false);
  const [payOverageLoading, setPayOverageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await usageApi.getCurrent();
      if (response.success && response.data) {
        setUsage(response.data.usage);
      } else {
        setError(response.error?.message || 'Failed to load usage data');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWarnings = useCallback(async () => {
    try {
      const response = await usageApi.getWarnings();
      if (response.success && response.data) setWarnings(response.data);
    } catch (err) {
      console.error('Failed to load usage warnings:', err);
    }
  }, []);

  const loadOverage = useCallback(async (periodStart: string, periodEnd: string) => {
    try {
      setOverageLoading(true);
      const res = await billingApi.getOverage({
        periodStart,
        periodEnd,
        currency: overageCurrency,
      });
      if (res.success && res.data) setOverage(res.data);
      else setOverage(null);
    } catch {
      setOverage(null);
    } finally {
      setOverageLoading(false);
    }
  }, [overageCurrency]);

  useEffect(() => {
    loadUsage();
    if (showWarnings) loadWarnings();
  }, [showWarnings, loadUsage, loadWarnings]);

  useEffect(() => {
    if (!usage?.periodStart || !usage?.periodEnd) return;
    loadOverage(usage.periodStart, usage.periodEnd);
  }, [usage?.periodStart, usage?.periodEnd, loadOverage]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </Alert>
    );
  }

  if (!usage) {
    return null;
  }

  const formatLimit = (limit: number | null): string => {
    if (limit === null) return 'Unlimited';
    return limit.toLocaleString();
  };

  const formatOverageAmount = (amount: number, currency: string): string => {
    return currency === 'USD' ? `$${amount.toFixed(2)}` : `${amount.toLocaleString('en-US')} ${currency}`;
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage === -1) return 'bg-green-500'; // Unlimited
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const handlePayOverage = async () => {
    if (!usage?.periodStart || !usage?.periodEnd || overageLoading || payOverageLoading) return;
    try {
      setPayOverageLoading(true);
      const res = await billingApi.initiateOveragePayment({
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
        currency: overageCurrency,
      });
      if (!res.success || !res.data) return;
      if ('noOverage' in res.data && res.data.noOverage) return;
      if ('redirect_url' in res.data && res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
      }
    } catch (e) {
      console.error('Failed to initiate overage payment:', e);
    } finally {
      setPayOverageLoading(false);
    }
  };

  const UsageItem = ({
    label,
    icon: Icon,
    used,
    limit,
    remaining,
    percentage,
    onUpgrade,
  }: {
    label: string;
    icon: React.ElementType;
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
    onUpgrade?: () => void;
  }) => {
    const isUnlimited = limit === null;
    const isNearLimit = percentage >= 80 && percentage !== -1;
    const isAtLimit = percentage >= 100 && percentage !== -1;
    const overageUnits = limit != null && used > limit ? used - limit : 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </div>
          <div className="text-sm text-gray-600">
            {used.toLocaleString()} / {formatLimit(limit)}
            {overageUnits > 0 && (
              <span className="ml-1 text-red-600 font-medium" title="Overage">
                (+{overageUnits.toLocaleString()} over)
              </span>
            )}
          </div>
        </div>
        {!isUnlimited && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getProgressColor(percentage)}`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {isUnlimited
                  ? 'Unlimited'
                  : overageUnits > 0
                    ? `${overageUnits.toLocaleString()} over limit`
                    : `${remaining !== null ? remaining.toLocaleString() : 0} remaining`}
              </span>
              {isNearLimit && !isAtLimit && (
                <span className="text-yellow-600 font-medium">
                  {percentage.toFixed(0)}% used
                </span>
              )}
              {isAtLimit && (
                <span className="text-red-600 font-medium">
                  {overageUnits > 0 ? 'Over limit · Overage billed' : 'Limit reached'}
                </span>
              )}
            </div>
          </div>
        )}
        {isAtLimit && onUpgrade && overageUnits === 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onUpgrade}
            className="w-full mt-2"
          >
            <ArrowUp className="h-3 w-3 mr-1" />
            Upgrade to increase limit
          </Button>
        )}
      </div>
    );
  };

  const hasOverage = overage && overage.totalCharged > 0;
  const atOrOverLimit = warnings?.warnings.some((w) => w.percentage >= 100) ?? false;

  return (
    <div className="space-y-4">
      {showWarnings && warnings?.approaching && (
        <Alert variant="warning" className="border-yellow-500 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <div className="ml-2">
            <div className="font-medium text-yellow-800">Approaching Usage Limits</div>
            <div className="text-sm text-yellow-700 mt-1">
              {warnings.warnings.map((w, i) => (
                <span key={i}>
                  {w.type === 'queries' && 'Queries'}
                  {w.type === 'tavilySearches' && 'Web searches'} ({w.percentage}% used)
                  {i < warnings.warnings.length - 1 && ', '}
                </span>
              ))}
            </div>
            {atOrOverLimit && (
              <p className="text-sm text-yellow-700 mt-1">
                Usage over your plan limit is billed as overage.
                {hasOverage && ' You have overage charges this period—pay below.'}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push('/dashboard?tab=subscription');
              }}
            >
              Upgrade Plan
            </Button>
          </div>
        </Alert>
      )}

      {!compact && hasOverage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 font-medium text-amber-900">
            <DollarSign className="h-4 w-4" />
            Overage charges this period
          </div>
          {overageLoading ? (
            <div className="h-5 bg-amber-100 rounded animate-pulse" />
          ) : (
            <>
              <div className="text-sm text-amber-800">
                <span className="font-semibold">{formatOverageAmount(overage!.totalCharged, overage!.currency)}</span>
                {overage!.records.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {overage!.records.map((r, i) => (
                      <li key={i}>
                        {r.metric_type === 'queries' && 'Queries'}
                        {r.metric_type === 'document_upload' && 'Document uploads'}
                        {r.metric_type === 'tavily_searches' && 'Web searches'}: {r.overage_units} over × {formatOverageAmount(r.unit_price, overage!.currency)} = {formatOverageAmount(r.amount_charged, overage!.currency)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                size="sm"
                onClick={handlePayOverage}
                disabled={payOverageLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                {payOverageLoading ? 'Redirecting…' : 'Pay overage'}
              </Button>
            </>
          )}
        </div>
      )}

      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        <UsageItem
          label="Queries"
          icon={Zap}
          used={usage.queries.used}
          limit={usage.queries.limit}
          remaining={usage.queries.remaining}
          percentage={usage.queries.percentage}
          onUpgrade={
            usage.queries.percentage >= 100
              ? () => {
                  router.push('/dashboard?tab=subscription');
                }
              : undefined
          }
        />

        {usage.tavilySearches && (
        <UsageItem
          label="Web Searches"
          icon={Search}
          used={usage.tavilySearches.used}
          limit={usage.tavilySearches.limit}
          remaining={usage.tavilySearches.remaining}
          percentage={usage.tavilySearches.percentage}
          onUpgrade={
            usage.tavilySearches.percentage >= 100
              ? () => router.push('/dashboard?tab=subscription')
              : undefined
          }
        />
        )}
      </div>

      {!compact && (
        <div className="text-xs text-gray-500 pt-2 border-t">
          Current period: {new Date(usage.periodStart).toLocaleDateString()} -{' '}
          {new Date(usage.periodEnd).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
