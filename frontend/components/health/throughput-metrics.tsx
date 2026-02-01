'use client';

import React from 'react';
import { ThroughputMetric } from '@/lib/api-health';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface ThroughputMetricsProps {
  throughput: {
    current: number;
    average: number;
    concurrent: number;
    trend: ThroughputMetric[];
  };
  loading: boolean;
}

export const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({
  throughput,
  loading,
}) => {
  // Calculate trend
  const getTrend = () => {
    if (throughput.trend.length < 2) return null;
    const recent = throughput.trend.slice(-5);
    const older = throughput.trend.slice(-10, -5);
    if (older.length === 0) return null;

    const recentAvg = recent.reduce((sum, m) => sum + m.requestsPerSecond, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.requestsPerSecond, 0) / older.length;

    if (recentAvg > olderAvg * 1.1) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else if (recentAvg < olderAvg * 0.9) {
      return <TrendingDown className="w-4 h-4 text-yellow-600" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Throughput Metrics
        </h3>
        {getTrend()}
      </div>

      <div className="space-y-4">
        {/* Requests Per Second */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Requests Per Second</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">
              {throughput.current.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">req/s</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Average: {throughput.average.toFixed(2)} req/s
          </p>
        </div>

        {/* Concurrent Requests */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Concurrent Requests</p>
          <p className="text-2xl font-bold text-gray-900">{throughput.concurrent}</p>
        </div>

        {/* Throughput Chart Placeholder */}
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">Throughput Trend</p>
          <div className="h-32 bg-gray-50 rounded flex items-center justify-center">
            <p className="text-sm text-gray-500">
              Chart visualization would be displayed here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
