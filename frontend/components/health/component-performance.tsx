'use client';

import React from 'react';
import { ComponentPerformance as ComponentPerformanceType } from '@/lib/api-health';
import { Activity, AlertTriangle } from 'lucide-react';

interface ComponentPerformanceProps {
  performance: ComponentPerformanceType[];
  loading: boolean;
}

export const ComponentPerformance: React.FC<ComponentPerformanceProps> = ({
  performance,
  loading,
}) => {
  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-600';
    if (latency < 500) return 'text-yellow-600';
    if (latency < 1000) return 'text-orange-600';
    return 'text-red-600';
  };

  const getErrorRateColor = (rate: number) => {
    if (rate < 1) return 'text-green-600';
    if (rate < 5) return 'text-yellow-600';
    if (rate < 10) return 'text-orange-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (performance.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600 text-center py-8">No component performance data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-900">Component Performance</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Component
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Latency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                P50
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                P95
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                P99
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Throughput
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {performance.map((comp) => (
              <tr key={comp.component} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900 capitalize">
                      {comp.component.replace(/_/g, ' ')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`font-semibold ${getLatencyColor(comp.averageLatency)}`}>
                    {comp.averageLatency.toFixed(0)}ms
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {comp.p50Latency.toFixed(0)}ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {comp.p95Latency.toFixed(0)}ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {comp.p99Latency.toFixed(0)}ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`font-semibold ${getErrorRateColor(comp.errorRate)}`}>
                    {comp.errorRate.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {comp.throughput.toFixed(2)} req/s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
