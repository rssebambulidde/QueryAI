'use client';

import React from 'react';
import { ErrorRateMetric } from '@/lib/api-health';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface ErrorRateDisplayProps {
  errorRate: {
    current: number;
    average: number;
    trend: ErrorRateMetric[];
    breakdown: Record<string, number>;
  };
  loading: boolean;
}

export const ErrorRateDisplay: React.FC<ErrorRateDisplayProps> = ({
  errorRate,
  loading,
}) => {
  const getErrorRateColor = (rate: number) => {
    if (rate < 1) return 'text-green-600';
    if (rate < 5) return 'text-yellow-600';
    if (rate < 10) return 'text-orange-600';
    return 'text-red-600';
  };

  const getErrorRateBgColor = (rate: number) => {
    if (rate < 1) return 'bg-green-50 border-green-200';
    if (rate < 5) return 'bg-yellow-50 border-yellow-200';
    if (rate < 10) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  // Calculate trend
  const getTrend = () => {
    if (errorRate.trend.length < 2) return null;
    const recent = errorRate.trend.slice(-5);
    const older = errorRate.trend.slice(-10, -5);
    if (older.length === 0) return null;

    const recentAvg = recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.errorRate, 0) / older.length;

    if (recentAvg > olderAvg * 1.1) {
      return <TrendingUp className="w-4 h-4 text-red-600" />;
    } else if (recentAvg < olderAvg * 0.9) {
      return <TrendingDown className="w-4 h-4 text-green-600" />;
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
    <div className={`bg-white rounded-lg shadow p-6 border-2 ${getErrorRateBgColor(errorRate.current)}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Error Rate
        </h3>
        {getTrend()}
      </div>

      <div className="space-y-4">
        {/* Current Error Rate */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Current Error Rate</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${getErrorRateColor(errorRate.current)}`}>
              {errorRate.current.toFixed(2)}%
            </span>
            <span className="text-sm text-gray-500">/ 100%</span>
          </div>
        </div>

        {/* Average Error Rate */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Average Error Rate</p>
          <p className="text-xl font-semibold text-gray-900">
            {errorRate.average.toFixed(2)}%
          </p>
        </div>

        {/* Error Breakdown */}
        {Object.keys(errorRate.breakdown).length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">Error Breakdown</p>
            <div className="space-y-2">
              {Object.entries(errorRate.breakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                errorRate.current < 1
                  ? 'bg-green-600'
                  : errorRate.current < 5
                  ? 'bg-yellow-600'
                  : errorRate.current < 10
                  ? 'bg-orange-600'
                  : 'bg-red-600'
              }`}
              style={{ width: `${Math.min(errorRate.current, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
