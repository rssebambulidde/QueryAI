'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import {
  DollarSign,
  TrendingDown,
  Users,
  BarChart3,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart } from '@/components/analytics/charts/line-chart';
import { BarChart } from '@/components/analytics/charts/bar-chart';

// ── Types ────────────────────────────────────────────────────────

interface MRRBreakdown {
  total: number;
  byTier: { tier: string; mrr: number; count: number }[];
}

interface ChurnMetrics {
  churnRate: number;
  churnedCount: number;
  totalPaidStart: number;
}

interface ARPUMetrics {
  arpu: number;
  totalRevenue: number;
  paidUsers: number;
}

interface RevenueByTier {
  tier: string;
  revenue: number;
  count: number;
}

interface ConversionFunnel {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  enterpriseUsers: number;
  conversionRate: number;
  trialConversionRate: number;
}

interface FailedPaymentPoint {
  date: string;
  failed: number;
  completed: number;
  failRate: number;
}

interface RevenueTimePoint {
  date: string;
  revenue: number;
  count: number;
}

interface DashboardData {
  mrr: MRRBreakdown;
  churn: ChurnMetrics;
  arpu: ARPUMetrics;
  revenueByTier: RevenueByTier[];
  conversionFunnel: ConversionFunnel;
  failedPaymentTrends: FailedPaymentPoint[];
  revenueTrend: RevenueTimePoint[];
}

type DayOption = 7 | 30 | 90;

// ── Helpers ──────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function tierLabel(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const TIER_COLORS: Record<string, string> = {
  pro: '#f97316',       // orange-500
  enterprise: '#6366f1', // indigo-500
  free: '#9ca3af',       // gray-400
  unknown: '#d1d5db',    // gray-300
};

// ── Sub-components ───────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
  iconColor = 'text-gray-500',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  iconColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className={cn('w-4 h-4', iconColor)} />
        {label}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-600" />}
        {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-500" />}
      </div>
      {subtext && <span className="text-xs text-gray-400">{subtext}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-5 py-3 border-b border-gray-100">
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function PaymentAnalyticsDashboard() {
  const [days, setDays] = useState<DayOption>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/admin/payment-analytics', { params: { days: d } });
      setData(res.data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const handleDays = (d: DayOption) => setDays(d);

  // ── Loading / Error ────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  // ── Derived chart data (memoized to prevent re-render flicker) ──

  const revenueTrendChart = useMemo(() => data.revenueTrend.map((p) => ({
    name: shortDate(p.date),
    Revenue: p.revenue,
    Payments: p.count,
  })), [data.revenueTrend]);

  const failedTrendChart = useMemo(() => data.failedPaymentTrends.map((p) => ({
    name: shortDate(p.date),
    Failed: p.failed,
    Completed: p.completed,
  })), [data.failedPaymentTrends]);

  const revenueByTierChart = useMemo(() => data.revenueByTier.map((r) => ({
    name: tierLabel(r.tier),
    Revenue: r.revenue,
  })), [data.revenueByTier]);

  const funnelChart = useMemo(() => [
    { name: 'Free', Users: data.conversionFunnel.freeUsers },
    { name: 'Pro', Users: data.conversionFunnel.proUsers },
    { name: 'Enterprise', Users: data.conversionFunnel.enterpriseUsers },
  ], [data.conversionFunnel]);

  // Stable dataKeys references (constant, so memoize with empty deps)
  const revenueTrendKeys = useMemo(() => [
    { key: 'Revenue', color: '#16a34a', name: 'Revenue ($)' },
  ], []);

  const revenueByTierKeys = useMemo(() => [
    { key: 'Revenue', color: '#f97316', name: 'Revenue ($)' },
  ], []);

  const failedTrendKeys = useMemo(() => [
    { key: 'Completed', color: '#16a34a', name: 'Completed' },
    { key: 'Failed', color: '#ef4444', name: 'Failed' },
  ], []);

  const funnelKeys = useMemo(() => [
    { key: 'Users', color: '#6366f1', name: 'Users' },
  ], []);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header row: title + controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Payment Analytics</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Day selector */}
          {([7, 30, 90] as DayOption[]).map((d) => (
            <button
              key={d}
              onClick={() => handleDays(d)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                days === d
                  ? 'bg-orange-100 border-orange-300 text-orange-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {d}d
            </button>
          ))}

          <button
            onClick={() => fetchData(days)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner (when we already have stale data) */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={DollarSign}
          iconColor="text-green-600"
          label="MRR"
          value={fmt$(data.mrr.total)}
          subtext={data.mrr.byTier.map((t) => `${tierLabel(t.tier)}: ${fmt$(t.mrr)}`).join(' · ')}
        />
        <SummaryCard
          icon={TrendingDown}
          iconColor="text-red-500"
          label={`Churn Rate (${days}d)`}
          value={fmtPct(data.churn.churnRate)}
          subtext={`${data.churn.churnedCount} of ${data.churn.totalPaidStart} paid`}
          trend={data.churn.churnRate > 5 ? 'down' : 'neutral'}
        />
        <SummaryCard
          icon={Users}
          iconColor="text-blue-600"
          label={`ARPU (${days}d)`}
          value={fmt$(data.arpu.arpu)}
          subtext={`${fmt$(data.arpu.totalRevenue)} from ${data.arpu.paidUsers} users`}
        />
        <SummaryCard
          icon={AlertTriangle}
          iconColor="text-amber-500"
          label="Conversion Rate"
          value={fmtPct(data.conversionFunnel.conversionRate)}
          subtext={`Trial → Paid: ${fmtPct(data.conversionFunnel.trialConversionRate)}`}
        />
      </div>

      {/* Charts row 1: Revenue trend + Revenue by tier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Section title="Revenue Trend">
            {revenueTrendChart.length > 0 ? (
              <LineChart
                data={revenueTrendChart}
                dataKeys={revenueTrendKeys}
                height={280}
              />
            ) : (
              <p className="text-center text-sm text-gray-400 py-10">No revenue data for this period</p>
            )}
          </Section>
        </div>

        <Section title="Revenue by Tier">
          {revenueByTierChart.length > 0 ? (
            <BarChart
              data={revenueByTierChart}
              dataKeys={revenueByTierKeys}
              height={280}
            />
          ) : (
            <p className="text-center text-sm text-gray-400 py-10">No data</p>
          )}
        </Section>
      </div>

      {/* Charts row 2: Failed payments + Conversion funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Failed Payment Trends">
          {failedTrendChart.length > 0 ? (
            <BarChart
              data={failedTrendChart}
              dataKeys={failedTrendKeys}
              height={260}
            />
          ) : (
            <p className="text-center text-sm text-gray-400 py-10">No payment data for this period</p>
          )}
        </Section>

        <Section title="Conversion Funnel">
          <BarChart
            data={funnelChart}
            dataKeys={funnelKeys}
            height={260}
          />
          {/* Summary below chart */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <div className="text-lg font-bold text-gray-900">
                {data.conversionFunnel.totalUsers}
              </div>
              <div className="text-gray-500">Total Users</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">
                {fmtPct(data.conversionFunnel.conversionRate)}
              </div>
              <div className="text-gray-500">Free → Paid</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-600">
                {fmtPct(data.conversionFunnel.trialConversionRate)}
              </div>
              <div className="text-gray-500">Trial → Paid</div>
            </div>
          </div>
        </Section>
      </div>

      {/* MRR breakdown table */}
      {data.mrr.byTier.length > 0 && (
        <Section title="MRR Breakdown">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Tier</th>
                <th className="pb-2 font-medium text-right">Active Subs</th>
                <th className="pb-2 font-medium text-right">MRR</th>
                <th className="pb-2 font-medium text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.mrr.byTier.map((t) => (
                <tr key={t.tier} className="hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-900 flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: TIER_COLORS[t.tier] || TIER_COLORS.unknown }}
                    />
                    {tierLabel(t.tier)}
                  </td>
                  <td className="py-2.5 text-right text-gray-600">{t.count}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{fmt$(t.mrr)}</td>
                  <td className="py-2.5 text-right text-gray-500">
                    {data.mrr.total > 0 ? fmtPct((t.mrr / data.mrr.total) * 100) : '0%'}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="py-2.5 text-gray-900">Total</td>
                <td className="py-2.5 text-right text-gray-700">
                  {data.mrr.byTier.reduce((s, t) => s + t.count, 0)}
                </td>
                <td className="py-2.5 text-right text-gray-900">{fmt$(data.mrr.total)}</td>
                <td className="py-2.5 text-right text-gray-500">100%</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
