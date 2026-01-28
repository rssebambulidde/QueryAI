'use client';

import React from 'react';
import { ABTestMetrics } from '@/lib/api-ab-testing';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatisticalAnalysisChartProps {
  metrics: ABTestMetrics | null;
}

export const StatisticalAnalysisChart: React.FC<StatisticalAnalysisChartProps> = ({
  metrics,
}) => {
  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600">No data available for visualization</p>
      </div>
    );
  }

  const variantA = metrics.variantA;
  const variantB = metrics.variantB;
  const significance = metrics.statisticalSignificance;

  // Get all unique metric keys
  const metricKeys = Array.from(
    new Set([
      ...Object.keys(variantA.averageMetrics),
      ...Object.keys(variantB.averageMetrics),
    ])
  );

  // Calculate improvement for each metric
  const getImprovement = (key: string) => {
    const valueA = variantA.averageMetrics[key] || 0;
    const valueB = variantB.averageMetrics[key] || 0;
    if (valueA === 0) return valueB > 0 ? 100 : 0;
    return ((valueB - valueA) / valueA) * 100;
  };

  // Get max value for scaling
  const getMaxValue = (key: string) => {
    return Math.max(
      variantA.averageMetrics[key] || 0,
      variantB.averageMetrics[key] || 0
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Variant Comparison</h3>

      <div className="space-y-6">
        {metricKeys.map((metricKey) => {
          const valueA = variantA.averageMetrics[metricKey] || 0;
          const valueB = variantB.averageMetrics[metricKey] || 0;
          const maxValue = getMaxValue(metricKey);
          const improvement = getImprovement(metricKey);
          const isSignificant = significance.isSignificant;

          return (
            <div key={metricKey} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {metricKey.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center gap-2">
                  {improvement > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : improvement < 0 ? (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  ) : (
                    <Minus className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      improvement > 0
                        ? 'text-green-600'
                        : improvement < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {improvement > 0 ? '+' : ''}
                    {improvement.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="space-y-2">
                {/* Variant A */}
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Variant A: {typeof valueA === 'number' ? valueA.toFixed(2) : valueA}</span>
                    <span>
                      {maxValue > 0
                        ? ((valueA / maxValue) * 100).toFixed(0)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: maxValue > 0 ? `${(valueA / maxValue) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>

                {/* Variant B */}
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Variant B: {typeof valueB === 'number' ? valueB.toFixed(2) : valueB}</span>
                    <span>
                      {maxValue > 0
                        ? ((valueB / maxValue) * 100).toFixed(0)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-300 ${
                        improvement > 0 ? 'bg-green-600' : 'bg-orange-600'
                      }`}
                      style={{
                        width: maxValue > 0 ? `${(valueB / maxValue) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner Indicator */}
      {significance.winner && (
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="font-semibold text-gray-900">
              Winner: Variant {significance.winner}
            </span>
            {significance.improvementPercentage !== undefined && (
              <span className="text-sm text-gray-600 ml-2">
                ({significance.improvementPercentage.toFixed(1)}% improvement)
              </span>
            )}
          </div>
          {isSignificant && (
            <p className="text-sm text-gray-600 mt-2">
              This result is statistically significant (p-value:{' '}
              {significance.pValue.toFixed(4)})
            </p>
          )}
        </div>
      )}

      {/* Significance Indicator */}
      {!significance.winner && isSignificant && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Note:</span> The test shows statistical
            significance, but no clear winner has been determined yet. Continue monitoring
            the test.
          </p>
        </div>
      )}

      {!isSignificant && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Note:</span> The test is not yet statistically
            significant (p-value: {significance.pValue.toFixed(4)}). Continue collecting data
            or consider increasing the sample size.
          </p>
        </div>
      )}
    </div>
  );
};
