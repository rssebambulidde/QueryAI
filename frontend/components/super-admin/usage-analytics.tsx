'use client';

import { useState } from 'react';
import { DateRangePicker, DateRange } from '@/components/analytics/date-range-picker';
import { PerformanceDashboard } from '@/components/analytics/performance-dashboard';
import { Alert } from '@/components/ui/alert';
import { useMetrics } from '@/lib/hooks/use-metrics';

export default function UsageAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  });

  const { latencyStats, errorStats, loading, error } = useMetrics(dateRange);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">Usage Analytics</h3>
        <p className="text-sm text-gray-600 mt-1">Platform-wide usage and performance metrics</p>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg shadow p-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold mb-1">Error</h3>
            <p>{error}</p>
          </div>
        </Alert>
      )}

      {/* Performance Metrics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">Performance Metrics</h4>
        <PerformanceDashboard
          latencyStats={latencyStats}
          errorStats={errorStats}
          dateRange={dateRange}
          loading={loading}
        />
      </div>
    </div>
  );
}
