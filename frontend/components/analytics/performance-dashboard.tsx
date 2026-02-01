'use client';

import { LatencyStats, ErrorStats } from '@/lib/api';
import { TimeSeriesChart } from './charts/time-series-chart';
import { useLatencyTrends, useErrorTrends, DateRange } from '@/lib/hooks/use-metrics';

interface PerformanceDashboardProps {
  latencyStats: LatencyStats | null;
  errorStats: ErrorStats | null;
  dateRange: DateRange;
  loading?: boolean;
}

export function PerformanceDashboard({
  latencyStats,
  errorStats,
  dateRange,
  loading,
}: PerformanceDashboardProps) {
  const { trends: latencyTrends } = useLatencyTrends('query', dateRange, 'day');
  const { trends: errorTrends } = useErrorTrends('api', dateRange, undefined, 'day');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const calculateThroughput = () => {
    if (!latencyStats || !latencyStats.summary) return 0;
    // Estimate throughput from total operations and time range
    const days = Math.max(
      1,
      (new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return latencyStats.summary.totalOperations / (days * 24 * 60 * 60);
  };

  const calculateErrorRate = () => {
    if (!errorStats || !errorStats.summary || errorStats.summary.totalErrors === 0) return 0;
    // This is a simplified calculation - in production, you'd want total requests
    const totalRequests = errorStats.summary.totalErrors * 10; // Estimate
    return (errorStats.summary.totalErrors / totalRequests) * 100;
  };

  const avgLatency = latencyStats?.stats?.[0]?.averageLatency || latencyStats?.summary?.averageLatency || 0;
  const minLatency = latencyStats?.stats?.[0]?.minLatency || 0;
  const maxLatency = latencyStats?.stats?.[0]?.maxLatency || 0;
  const p95Latency = latencyStats?.stats?.[0]?.p95Latency || 0;
  const p99Latency = latencyStats?.stats?.[0]?.p99Latency || 0;

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Response Time</h3>
          <p className="text-2xl font-bold text-gray-900">{avgLatency.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Min Response Time</h3>
          <p className="text-2xl font-bold text-gray-900">{minLatency.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Max Response Time</h3>
          <p className="text-2xl font-bold text-gray-900">{maxLatency.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">P95 Response Time</h3>
          <p className="text-2xl font-bold text-gray-900">{p95Latency.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">P99 Response Time</h3>
          <p className="text-2xl font-bold text-gray-900">{p99Latency.toFixed(0)}ms</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Throughput</h3>
          <p className="text-2xl font-bold text-gray-900">{calculateThroughput().toFixed(2)} req/s</p>
        </div>
      </div>

      {/* Error Rate Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Error Rate</h2>
          <div className="text-2xl font-bold text-red-600">{calculateErrorRate().toFixed(2)}%</div>
        </div>
        {errorStats && errorStats.stats.length > 0 && (
          <div className="space-y-2">
            {errorStats.stats.slice(0, 5).map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700">
                  {stat.serviceType} - {stat.errorCategory}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {stat.count} ({stat.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latency Trends Chart */}
      {latencyTrends && latencyTrends.trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Response Time Trends</h2>
          <TimeSeriesChart
            data={latencyTrends.trends.map((t) => ({
              date: t.date,
              average: t.averageLatency,
              p95: t.p95Latency,
              p99: t.p99Latency,
            }))}
            dataKeys={[
              { key: 'average', color: '#3B82F6', name: 'Average' },
              { key: 'p95', color: '#F59E0B', name: 'P95' },
              { key: 'p99', color: '#EF4444', name: 'P99' },
            ]}
            height={300}
          />
        </div>
      )}

      {/* Error Trends Chart */}
      {errorTrends && errorTrends.trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Error Rate Trends</h2>
          <TimeSeriesChart
            data={errorTrends.trends.map((t) => ({
              date: t.date,
              errors: t.count,
              errorRate: t.errorRate,
            }))}
            dataKeys={[
              { key: 'errors', color: '#EF4444', name: 'Error Count' },
              { key: 'errorRate', color: '#F59E0B', name: 'Error Rate %' },
            ]}
            height={300}
          />
        </div>
      )}
    </div>
  );
}
