'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CreditCard,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { getPaymentErrorMessage, cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import type { Payment, BillingHistory as BillingHistoryData } from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────

const INITIAL_VISIBLE = 10;

type StatusFilter = 'all' | 'completed' | 'pending' | 'failed';

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function minutesAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

/** Derive payment-method display from payment data. */
function getPaymentMethod(payment: Payment) {
  const isPayPal =
    payment.payment_provider === 'paypal' ||
    !!payment.paypal_order_id ||
    !!payment.paypal_payment_id ||
    !!payment.paypal_subscription_id ||
    payment.payment_method === 'paypal';

  const paypalEmail =
    payment.callback_data?.payerEmail || payment.callback_data?.payer_email;
  const cardLast4 =
    payment.callback_data?.last4 || payment.callback_data?.last_4;
  const cardBrand =
    payment.callback_data?.card_brand || payment.callback_data?.cardBrand;

  let label = '—';
  if (isPayPal) {
    label = paypalEmail ? `PayPal • ${paypalEmail}` : 'PayPal';
  } else if (cardLast4) {
    const brand = cardBrand ? `${cardBrand} ` : '';
    label = `Card • ${brand}•••• ${cardLast4}`;
  } else if (payment.payment_method) {
    label = payment.payment_method;
  }

  return { isPayPal, paypalEmail, cardLast4, cardBrand, label };
}

// ── Status badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: Payment['status'] }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={cn(
        'text-xs font-medium px-2 py-1 rounded capitalize',
        styles[status] ?? 'bg-gray-100 text-gray-700'
      )}
    >
      {status}
    </span>
  );
}

// ── Filter tabs ──────────────────────────────────────────────────

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: StatusFilter;
  counts: Record<StatusFilter, number>;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {FILTER_OPTIONS.map((opt) => {
        const count = counts[opt.value];
        if (opt.value !== 'all' && count === 0) return null;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-colors',
              active === opt.value
                ? 'bg-orange-100 border-orange-300 text-orange-700 font-medium'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            {opt.label}
            {count > 0 && (
              <span className="ml-1 text-[10px] opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Payment Row (Desktop) ────────────────────────────────────────

function PaymentRow({
  payment,
  onDownloadInvoice,
  onRetryPayment,
  lastSyncTime,
}: {
  payment: Payment;
  onDownloadInvoice: (id: string) => void;
  onRetryPayment: (id: string) => void;
  lastSyncTime: Date | null;
}) {
  const pm = getPaymentMethod(payment);
  const age = payment.created_at ? minutesAgo(new Date(payment.created_at)) : 0;

  return (
    <div className="grid grid-cols-12 gap-2 items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50">
      {/* Description + amount */}
      <div className="col-span-4 min-w-0">
        <div className="font-medium">
          {payment.tier.toUpperCase()} — {formatCurrency(payment.amount, payment.currency)}
        </div>
        {payment.payment_description && (
          <div className="text-xs text-gray-500 truncate">
            {payment.payment_description}
          </div>
        )}
        {payment.status === 'pending' && age > 0 && (
          <div className="text-xs text-amber-600 mt-1">
            Pending for {age} {age === 1 ? 'minute' : 'minutes'}
          </div>
        )}
      </div>

      {/* Provider */}
      <div className="col-span-2 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          {pm.isPayPal ? (
            <>
              <span className="text-orange-600 font-semibold text-xs">PayPal</span>
              {pm.paypalEmail && (
                <span className="text-gray-500 text-xs truncate" title={pm.paypalEmail}>
                  • {pm.paypalEmail}
                </span>
              )}
            </>
          ) : pm.cardLast4 ? (
            <>
              <CreditCard className="w-4 h-4 text-gray-500" />
              <span className="text-xs">
                {pm.cardBrand && (
                  <span className="capitalize">{pm.cardBrand} </span>
                )}
                •••• {pm.cardLast4}
              </span>
            </>
          ) : (
            <span className="text-xs">{pm.label}</span>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="col-span-2 text-sm text-gray-600">
        {new Date(payment.created_at).toLocaleDateString()}
        {payment.status === 'pending' && (
          <div className="text-xs text-gray-500 mt-0.5">
            {new Date(payment.created_at).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="col-span-2 text-sm">
        <StatusBadge status={payment.status} />
        {payment.status === 'pending' && lastSyncTime && (
          <div className="text-xs text-gray-500 mt-1">
            Synced {minutesAgo(lastSyncTime)}m ago
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="col-span-2 text-right">
        {payment.status === 'completed' && (
          <Button
            onClick={() => onDownloadInvoice(payment.id)}
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
              onClick={() => onRetryPayment(payment.id)}
              variant="outline"
              size="sm"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
            >
              Retry Payment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Payment Card (Mobile) ────────────────────────────────────────

function PaymentCard({
  payment,
  onDownloadInvoice,
  onRetryPayment,
  lastSyncTime,
}: {
  payment: Payment;
  onDownloadInvoice: (id: string) => void;
  onRetryPayment: (id: string) => void;
  lastSyncTime: Date | null;
}) {
  const pm = getPaymentMethod(payment);
  const age = payment.created_at ? minutesAgo(new Date(payment.created_at)) : 0;

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:bg-gray-50/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">
            {payment.tier.toUpperCase()} — {formatCurrency(payment.amount, payment.currency)}
          </div>
          {payment.payment_description && (
            <div className="text-xs text-gray-500 mt-1 break-words">
              {payment.payment_description}
            </div>
          )}
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">Provider:</span>
          {pm.isPayPal ? (
            <>
              <span className="text-orange-600 font-semibold">PayPal</span>
              {pm.paypalEmail && (
                <span className="text-gray-500 truncate" title={pm.paypalEmail}>
                  • {pm.paypalEmail}
                </span>
              )}
            </>
          ) : pm.cardLast4 ? (
            <>
              <CreditCard className="w-3 h-3 text-gray-500" />
              <span>
                {pm.cardBrand && (
                  <span className="capitalize">{pm.cardBrand} </span>
                )}
                •••• {pm.cardLast4}
              </span>
            </>
          ) : (
            <span>{pm.label}</span>
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
        {payment.status === 'pending' && age > 0 && (
          <div className="text-amber-600">
            Pending for {age} {age === 1 ? 'minute' : 'minutes'}
          </div>
        )}
        {payment.status === 'pending' && lastSyncTime && (
          <div className="text-gray-500">Synced {minutesAgo(lastSyncTime)}m ago</div>
        )}
      </div>

      {payment.status === 'failed' && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-3 h-3 inline mr-1" />
          {getPaymentErrorMessage(
            payment.callback_data?.failure_reason ||
              payment.callback_data?.failed_payment_reason ||
              'Payment failed',
            payment
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
        {payment.status === 'completed' && (
          <Button
            onClick={() => onDownloadInvoice(payment.id)}
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
            onClick={() => onRetryPayment(payment.id)}
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

// ── Pending-payment alerts ───────────────────────────────────────

function PendingAlerts({
  payments,
  syncingBilling,
  lastSyncTime,
  onSync,
}: {
  payments: Payment[];
  syncingBilling: boolean;
  lastSyncTime: Date | null;
  onSync: () => void;
}) {
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  if (pendingPayments.length === 0) return null;

  return (
    <>
      <Alert variant="info" className="mb-4">
        Pending recurring payments detected. If you completed payment on PayPal,
        click &quot;Sync billing status&quot; above to update your plan.
        {lastSyncTime && (
          <span className="block mt-1 text-xs">
            Last synced: {minutesAgo(lastSyncTime)} minutes ago
          </span>
        )}
      </Alert>

      {pendingPayments.map((payment) => {
        const age = payment.created_at
          ? minutesAgo(new Date(payment.created_at))
          : 0;
        if (age <= 5) return null;
        return (
          <Alert key={payment.id} variant="warning" className="mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">
                  Payment has been pending for {age} minutes.
                  {age > 10 && ' This may indicate a payment issue.'}
                </p>
                <Button
                  size="sm"
                  onClick={onSync}
                  disabled={syncingBilling}
                  className={cn(
                    'flex items-center gap-1 mt-2 bg-amber-600 hover:bg-amber-700 text-white',
                    syncingBilling && 'opacity-75 cursor-not-allowed'
                  )}
                >
                  <RefreshCw
                    className={cn('w-3 h-3', syncingBilling && 'animate-spin')}
                  />
                  {syncingBilling ? 'Syncing...' : 'Sync Again'}
                </Button>
              </div>
            </div>
          </Alert>
        );
      })}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────

interface BillingHistoryProps {
  billingHistory: BillingHistoryData | null;
  tier: string;
  syncingBilling: boolean;
  lastSyncTime: Date | null;
  onSync: () => void;
  onDownloadInvoice: (paymentId: string) => void;
  onRetryPayment: (paymentId: string) => void;
}

export function BillingHistory({
  billingHistory,
  tier,
  syncingBilling,
  lastSyncTime,
  onSync,
  onDownloadInvoice,
  onRetryPayment,
}: BillingHistoryProps) {
  const { isMobile } = useMobile();
  const [expanded, setExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const payments = billingHistory?.payments ?? [];
  const totalCount = payments.length;
  const hasPending = payments.some((p) => p.status === 'pending');

  // Filter & count
  const counts = useMemo<Record<StatusFilter, number>>(() => {
    const c: Record<StatusFilter, number> = {
      all: payments.length,
      completed: 0,
      pending: 0,
      failed: 0,
    };
    for (const p of payments) {
      if (p.status === 'completed') c.completed++;
      else if (p.status === 'pending') c.pending++;
      else if (p.status === 'failed' || p.status === 'cancelled') c.failed++;
    }
    return c;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    if (statusFilter === 'failed')
      return payments.filter(
        (p) => p.status === 'failed' || p.status === 'cancelled'
      );
    return payments.filter((p) => p.status === statusFilter);
  }, [payments, statusFilter]);

  const visiblePayments = filteredPayments.slice(0, visibleCount);
  const hasMore = filteredPayments.length > visibleCount;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Billing History</h3>
          {totalCount > 0 && (
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasPending && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncingBilling}
              className={cn(
                'flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50',
                syncingBilling && 'opacity-75 cursor-not-allowed'
              )}
              title={
                syncingBilling
                  ? 'Syncing subscription with PayPal...'
                  : 'Sync billing status with PayPal'
              }
            >
              <RefreshCw
                className={cn('w-4 h-4', syncingBilling && 'animate-spin')}
              />
              {syncingBilling ? 'Syncing...' : 'Sync billing status'}
            </Button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-orange-600 hover:text-orange-700"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Pending alerts */}
          <PendingAlerts
            payments={payments}
            syncingBilling={syncingBilling}
            lastSyncTime={lastSyncTime}
            onSync={onSync}
          />

          {totalCount === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {tier === 'free' ? (
                <p>
                  You&apos;re on the Free plan — billing history will appear here
                  once you subscribe to a paid tier.
                </p>
              ) : (
                <p>No billing history found.</p>
              )}
            </div>
          ) : (
            <>
              {/* Status filter tabs */}
              {totalCount > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <FilterTabs
                    active={statusFilter}
                    counts={counts}
                    onChange={(v) => {
                      setStatusFilter(v);
                      setVisibleCount(INITIAL_VISIBLE);
                    }}
                  />
                </div>
              )}

              {/* Table header (desktop) */}
              {!isMobile && (
                <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2">
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2">Provider</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
              )}

              {/* Payment list */}
              <div className="space-y-3">
                {visiblePayments.map((payment) =>
                  isMobile ? (
                    <PaymentCard
                      key={payment.id}
                      payment={payment}
                      onDownloadInvoice={onDownloadInvoice}
                      onRetryPayment={onRetryPayment}
                      lastSyncTime={lastSyncTime}
                    />
                  ) : (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                      onDownloadInvoice={onDownloadInvoice}
                      onRetryPayment={onRetryPayment}
                      lastSyncTime={lastSyncTime}
                    />
                  )
                )}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="text-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount((c) => c + INITIAL_VISIBLE)}
                    className="text-gray-600"
                  >
                    Show more ({filteredPayments.length - visibleCount} remaining)
                  </Button>
                </div>
              )}

              {/* Filtered empty state */}
              {filteredPayments.length === 0 && statusFilter !== 'all' && (
                <p className="text-gray-500 text-center py-4 text-sm">
                  No {statusFilter} payments found.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
