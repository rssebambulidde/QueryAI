'use client';

import React from 'react';
import { ABTestMetrics } from '@/lib/api-ab-testing';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Users, BarChart3 } from 'lucide-react';

interface TestMetricsDisplayProps {
  metrics: ABTestMetrics | null;
  loading: boolean;
  onRefresh: () => void;
  autoRefresh?: boolean;
}

export const TestMetricsDisplay: React.FC<TestMetricsDisplayProps> = ({
  metrics,
  loading,
  onRefresh,
  autoRefresh = true,
}) => {
  if (loading && !metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading metrics...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Metrics Available</h3>
        <p className="text-gray-600">
          Metrics will appear here once the test starts collecting data.
        </p>
      </div>
    );
  }

  const variantA = metrics.variantA;
  const variantB = metrics.variantB;
  const significance = metrics.statisticalSignificance;

  // Calculate improvement percentage
  const getImprovement = (metricKey: string) => {
    const valueA = variantA.averageMetrics[metricKey] || 0;
    const valueB = variantB.averageMetrics[metricKey] || 0;
    if (valueA === 0) return valueB > 0 ? 100 : 0;
    return ((valueB - valueA) / valueA) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Test Metrics</h2>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="text-sm text-gray-500">Auto-refreshing every 30s</span>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sample Sizes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Variant A</h3>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
              Control
            </span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-bold text-gray-900">
              {variantA.sampleSize.toLocaleString()}
            </span>
            <span className="text-sm text-gray-600">users</span>
          </div>
          <div className="space-y-2">
            {Object.entries(variantA.averageMetrics).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-sm text-gray-600 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </span>
              </div>
            ))}
            {variantA.conversionRate !== undefined && (
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-medium text-gray-700">Conversion Rate:</span>
                <span className="text-sm font-bold text-gray-900">
                  {(variantA.conversionRate * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Variant B</h3>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
              Treatment
            </span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-bold text-gray-900">
              {variantB.sampleSize.toLocaleString()}
            </span>
            <span className="text-sm text-gray-600">users</span>
          </div>
          <div className="space-y-2">
            {Object.entries(variantB.averageMetrics).map(([key, value]) => {
              const improvement = getImprovement(key);
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {typeof value === 'number' ? value.toFixed(2) : value}
                    </span>
                    {improvement !== 0 && (
                      <span
                        className={`text-xs font-medium ${
                          improvement > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {improvement > 0 ? '+' : ''}
                        {improvement.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {variantB.conversionRate !== undefined && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium text-gray-700">Conversion Rate:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {(variantB.conversionRate * 100).toFixed(2)}%
                  </span>
                  {variantA.conversionRate !== undefined && (
                    <span
                      className={`text-xs font-medium ${
                        variantB.conversionRate > variantA.conversionRate
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {variantB.conversionRate > variantA.conversionRate ? '+' : ''}
                      {(
                        ((variantB.conversionRate - variantA.conversionRate) /
                          variantA.conversionRate) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistical Significance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistical Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">P-Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {significance.pValue.toFixed(4)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {significance.pValue < 0.05
                ? 'Statistically significant'
                : 'Not statistically significant'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Confidence Interval</p>
            <p className="text-lg font-semibold text-gray-900">
              [{significance.confidenceInterval.lower.toFixed(2)},{' '}
              {significance.confidenceInterval.upper.toFixed(2)}]
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <div className="flex items-center gap-2">
              {significance.isSignificant ? (
                <>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-lg font-semibold text-green-600">
                    Significant
                  </span>
                </>
              ) : (
                <span className="text-lg font-semibold text-gray-600">
                  Not Significant
                </span>
              )}
            </div>
            {significance.winner && (
              <p className="text-sm text-gray-600 mt-1">
                Winner: <span className="font-semibold">Variant {significance.winner}</span>
              </p>
            )}
            {significance.improvementPercentage !== undefined && (
              <p className="text-sm text-gray-600 mt-1">
                Improvement: {significance.improvementPercentage.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-gray-500 text-center">
        Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};
