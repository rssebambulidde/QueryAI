'use client';

import { useState, useEffect, useCallback } from 'react';
import { costApi, CostSummary, CostTrendPoint } from '@/lib/api';
import { DateRangePicker, DateRange } from '@/components/analytics/date-range-picker';
import { TimeSeriesChart } from '@/components/analytics/charts/time-series-chart';
import { BarChart } from '@/components/analytics/charts/bar-chart';

export function CostDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  });

  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [trends, setTrends] = useState<CostTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, trendsRes] = await Promise.all([
        costApi.getSummary({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        costApi.getTrends({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          interval: 'day',
        }),
      ]);
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      else setSummary(null);
      if (trendsRes.success && trendsRes.data?.trends) setTrends(trendsRes.data.trends);
      else setTrends([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cost data');
      setSummary(null);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-10 bg-gray-200 rounded w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Error loading cost data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  const s = summary ?? {
    totalCost: 0,
    totalQueries: 0,
    totalTokens: 0,
    averageCostPerQuery: 0,
    modelBreakdown: {},
  };

  const modelChartData = Object.entries(s.modelBreakdown).map(([model, v]) => ({
    name: model,
    cost: v.totalCost,
    queries: v.count,
    tokens: v.totalTokens,
  }));

  const trendChartData = trends.map((t) => ({
    date: t.date,
    totalCost: t.totalCost,
    totalQueries: t.totalQueries,
    totalTokens: t.totalTokens,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Date range</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total cost (USD)</h3>
          <p className="text-2xl font-bold text-gray-900">
            ${s.totalCost.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total queries</h3>
          <p className="text-2xl font-bold text-gray-900">{s.totalQueries.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total tokens</h3>
          <p className="text-2xl font-bold text-gray-900">{s.totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg cost / query</h3>
          <p className="text-2xl font-bold text-gray-900">
            ${s.averageCostPerQuery.toFixed(6)}
          </p>
        </div>
      </div>

      {trendChartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost over time</h2>
          <TimeSeriesChart
            data={trendChartData}
            dataKeys={[
              { key: 'totalCost', color: '#10B981', name: 'Cost (USD)' },
              { key: 'totalQueries', color: '#3B82F6', name: 'Queries' },
            ]}
            height={300}
            dateFormat={(d) => {
              const x = new Date(d);
              return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
        </div>
      )}

      {modelChartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by model</h2>
          <BarChart
            data={modelChartData}
            dataKeys={[
              { key: 'cost', color: '#8B5CF6', name: 'Cost (USD)' },
              { key: 'queries', color: '#06B6D4', name: 'Queries' },
            ]}
            xAxisKey="name"
            height={300}
          />
        </div>
      )}

      {!loading && s.totalQueries === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <p>No cost data for the selected period.</p>
          <p className="text-sm mt-1">Run some queries to see analytics here.</p>
        </div>
      )}
    </div>
  );
}
