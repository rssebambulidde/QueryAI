'use client';

import React from 'react';
import { ValidationRun, ValidationTestResult } from '@/lib/api-validation';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonChartsProps {
  run: ValidationRun;
  results: ValidationTestResult[];
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ run, results }) => {
  // Calculate average scores by category
  const calculateAverages = () => {
    const retrievalScores = results
      .filter((r) => r.scores.retrieval)
      .map((r) => r.scores.retrieval!.f1Score * 100);
    const answerScores = results
      .filter((r) => r.scores.answer)
      .map((r) => r.scores.answer!.overall * 100);
    const citationScores = results
      .filter((r) => r.scores.citation)
      .map((r) => r.scores.citation!.overall * 100);

    return {
      retrieval: retrievalScores.length > 0
        ? retrievalScores.reduce((a, b) => a + b, 0) / retrievalScores.length
        : 0,
      answer: answerScores.length > 0
        ? answerScores.reduce((a, b) => a + b, 0) / answerScores.length
        : 0,
      citation: citationScores.length > 0
        ? citationScores.reduce((a, b) => a + b, 0) / citationScores.length
        : 0,
    };
  };

  const averages = calculateAverages();

  // Status distribution
  const statusDistribution = {
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    error: results.filter((r) => r.status === 'error').length,
  };

  const total = statusDistribution.passed + statusDistribution.failed + statusDistribution.error;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Metrics Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Metrics Comparison</h3>
        <div className="space-y-4">
          {[
            { label: 'Retrieval Quality', value: averages.retrieval, color: 'green' },
            { label: 'Answer Quality', value: averages.answer, color: 'purple' },
            { label: 'Citation Accuracy', value: averages.citation, color: 'orange' },
          ].map((metric) => {
            const Icon =
              metric.value >= 80 ? TrendingUp : metric.value >= 60 ? Minus : TrendingDown;
            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-4 h-4 ${
                        metric.value >= 80
                          ? 'text-green-600'
                          : metric.value >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        metric.value >= 80
                          ? 'text-green-600'
                          : metric.value >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {metric.value.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      metric.value >= 80
                        ? 'bg-green-600'
                        : metric.value >= 60
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Status Distribution</h3>
        <div className="space-y-4">
          {[
            { label: 'Passed', value: statusDistribution.passed, color: 'green' },
            { label: 'Failed', value: statusDistribution.failed, color: 'red' },
            { label: 'Errors', value: statusDistribution.error, color: 'yellow' },
          ].map((status) => {
            const percentage = total > 0 ? (status.value / total) * 100 : 0;
            return (
              <div key={status.label} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{status.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{status.value}</span>
                    <span className="text-sm text-gray-500">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      status.color === 'green'
                        ? 'bg-green-600'
                        : status.color === 'red'
                        ? 'bg-red-600'
                        : 'bg-yellow-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Distribution */}
      <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'High (≥80%)', range: [80, 100], color: 'green' },
            { label: 'Medium (60-79%)', range: [60, 79], color: 'yellow' },
            { label: 'Low (<60%)', range: [0, 59], color: 'red' },
          ].map((category) => {
            const count = results.filter((r) => {
              const score =
                (r.scores.answer?.overall || r.scores.retrieval?.f1Score || 0) * 100;
              return score >= category.range[0] && score <= category.range[1];
            }).length;

            return (
              <div
                key={category.label}
                className={`p-4 rounded-lg border-2 ${
                  category.color === 'green'
                    ? 'bg-green-50 border-green-200'
                    : category.color === 'yellow'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <p className="text-sm font-medium text-gray-700 mb-1">{category.label}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {results.length > 0 ? ((count / results.length) * 100).toFixed(1) : 0}% of tests
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
