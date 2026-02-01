'use client';

import { RetrievalMetricsSummary } from '@/lib/api';

interface MetricsCardsProps {
  summary: RetrievalMetricsSummary | null;
  previousPeriod?: RetrievalMetricsSummary | null;
  loading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  format?: (value: number) => string;
}

function MetricCard({ title, value, subtitle, trend, trendValue, format }: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number' && format) {
      return format(val);
    }
    return typeof val === 'number' ? val.toFixed(3) : val;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
        {trend && trend !== 'neutral' && (
          <span
            className={`text-xs font-medium flex items-center gap-1 ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'}
            {trendValue && <span>{trendValue}</span>}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

function calculateTrend(current: number, previous: number): { trend: 'up' | 'down' | 'neutral'; value: string } {
  if (previous === 0) {
    return { trend: 'neutral', value: '' };
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.1) {
    return { trend: 'neutral', value: '' };
  }
  return {
    trend: change > 0 ? 'up' : 'down',
    value: `${Math.abs(change).toFixed(1)}%`,
  };
}

export function MetricsCards({ summary, previousPeriod, loading }: MetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-8 text-gray-500">
        No metrics data available
      </div>
    );
  }

  const precisionTrend = previousPeriod
    ? calculateTrend(summary.averagePrecision, previousPeriod.averagePrecision)
    : { trend: 'neutral' as const, value: '' };
  const recallTrend = previousPeriod
    ? calculateTrend(summary.averageRecall, previousPeriod.averageRecall)
    : { trend: 'neutral' as const, value: '' };
  const f1Trend = previousPeriod
    ? calculateTrend(summary.averageF1Score, previousPeriod.averageF1Score)
    : { trend: 'neutral' as const, value: '' };
  const mrrTrend = previousPeriod
    ? calculateTrend(summary.averageMRR, previousPeriod.averageMRR)
    : { trend: 'neutral' as const, value: '' };
  const apTrend = previousPeriod
    ? calculateTrend(summary.averageAP, previousPeriod.averageAP)
    : { trend: 'neutral' as const, value: '' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <MetricCard
        title="Precision"
        value={summary.averagePrecision}
        subtitle="Average precision across all queries"
        trend={precisionTrend.trend}
        trendValue={precisionTrend.value}
        format={(v) => v.toFixed(3)}
      />
      <MetricCard
        title="Recall"
        value={summary.averageRecall}
        subtitle="Average recall across all queries"
        trend={recallTrend.trend}
        trendValue={recallTrend.value}
        format={(v) => v.toFixed(3)}
      />
      <MetricCard
        title="F1 Score"
        value={summary.averageF1Score}
        subtitle="Harmonic mean of precision and recall"
        trend={f1Trend.trend}
        trendValue={f1Trend.value}
        format={(v) => v.toFixed(3)}
      />
      <MetricCard
        title="MRR"
        value={summary.averageMRR}
        subtitle="Mean Reciprocal Rank"
        trend={mrrTrend.trend}
        trendValue={mrrTrend.value}
        format={(v) => v.toFixed(3)}
      />
      <MetricCard
        title="Average Precision"
        value={summary.averageAP}
        subtitle="Average precision at relevant positions"
        trend={apTrend.trend}
        trendValue={apTrend.value}
        format={(v) => v.toFixed(3)}
      />
    </div>
  );
}
