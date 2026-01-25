'use client';

import { useEffect, useState } from 'react';
import { analyticsApi, AnalyticsOverview, QueryStatistics, TopQuery, APIUsageMetrics } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await analyticsApi.getOverview(days);
      if (response.success && response.data) {
        setOverview(response.data);
      } else {
        setError(response.error?.message || 'Failed to load analytics');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Analytics dashboard is only available for Premium and Pro subscribers');
      } else {
        setError(err.response?.data?.error?.message || 'Failed to load analytics');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="error">
          <div>
            <h3 className="font-semibold mb-1">Error</h3>
            <p>{error}</p>
          </div>
        </Alert>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <Alert variant="info">
          <div>
            <h3 className="font-semibold mb-1">No Data</h3>
            <p>No analytics data available yet.</p>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Track your usage and query statistics</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={days === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(7)}
          >
            7 Days
          </Button>
          <Button
            variant={days === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(30)}
          >
            30 Days
          </Button>
          <Button
            variant={days === 90 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(90)}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Query Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Queries"
          value={overview.queryStatistics.totalQueries.toLocaleString()}
          subtitle="All time"
        />
        <StatCard
          title="This Month"
          value={overview.queryStatistics.queriesThisMonth.toLocaleString()}
          subtitle={`Last month: ${overview.queryStatistics.queriesLastMonth.toLocaleString()}`}
          trend={
            overview.queryStatistics.queriesThisMonth > overview.queryStatistics.queriesLastMonth
              ? 'up'
              : 'down'
          }
        />
        <StatCard
          title="This Week"
          value={overview.queryStatistics.queriesThisWeek.toLocaleString()}
          subtitle={`Avg/day: ${overview.queryStatistics.averagePerDay.toFixed(1)}`}
        />
        <StatCard
          title="Peak Day"
          value={overview.queryStatistics.peakDay.count.toLocaleString()}
          subtitle={new Date(overview.queryStatistics.peakDay.date).toLocaleDateString()}
        />
      </div>

      {/* Top Queries */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Queries</h2>
        {overview.topQueries.length > 0 ? (
          <div className="space-y-3">
            {overview.topQueries.map((query, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className="text-sm font-semibold text-gray-900">{query.count}x</span>
                  </div>
                  <p className="text-sm text-gray-700">{query.query}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last asked: {new Date(query.lastAsked).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No queries yet</p>
        )}
      </div>

      {/* API Usage Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">API Usage</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total API Calls</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.apiUsageMetrics.totalApiCalls.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">This Month</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.apiUsageMetrics.apiCallsThisMonth.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">This Week</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.apiUsageMetrics.apiCallsThisWeek.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average per Day</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.apiUsageMetrics.averagePerDay.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Uploads</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Uploads</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.documentUploads.total.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">This Month</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.documentUploads.thisMonth.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Month</span>
              <span className="text-lg font-semibold text-gray-900">
                {overview.documentUploads.lastMonth.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* API Usage by Endpoint */}
      {overview.apiUsageMetrics.byEndpoint.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">API Usage by Endpoint</h2>
          <div className="space-y-2">
            {overview.apiUsageMetrics.byEndpoint.map((endpoint, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700 font-mono">{endpoint.endpoint}</span>
                <span className="text-sm font-semibold text-gray-900">{endpoint.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Chart (Simple) */}
      {overview.usageByDate.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Over Time</h2>
          <div className="space-y-2">
            {overview.usageByDate.slice(-14).map((usage, index) => {
              const maxQueries = Math.max(
                ...overview.usageByDate.map((u) => u.queries),
                1
              );
              const maxApiCalls = Math.max(
                ...overview.usageByDate.map((u) => u.apiCalls),
                1
              );
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>{new Date(usage.date).toLocaleDateString()}</span>
                    <span>
                      {usage.queries} queries, {usage.apiCalls} API calls
                    </span>
                  </div>
                  <div className="flex gap-2 h-4">
                    <div
                      className="bg-orange-500 rounded"
                      style={{
                        width: `${(usage.queries / maxQueries) * 100}%`,
                      }}
                      title={`${usage.queries} queries`}
                    />
                    <div
                      className="bg-green-500 rounded"
                      style={{
                        width: `${(usage.apiCalls / maxApiCalls) * 100}%`,
                      }}
                      title={`${usage.apiCalls} API calls`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  );
}
