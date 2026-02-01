'use client';

import { useState, useEffect } from 'react';
import { DateRangePicker, DateRange } from '@/components/analytics/date-range-picker';
import { MetricsCards } from '@/components/analytics/metrics-cards';
import { PerformanceDashboard } from '@/components/analytics/performance-dashboard';
import { QualityMetrics } from '@/components/analytics/quality-metrics';
import { CostDashboard } from '@/components/analytics/cost-dashboard';
import { ExportReportsDialog } from '@/components/analytics/export-reports-dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useMetrics } from '@/lib/hooks/use-metrics';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [previousPeriod, setPreviousPeriod] = useState<DateRange | null>(null);

  const { retrievalMetrics, retrievalSummary, latencyStats, errorStats, qualityStats, loading, error } = useMetrics(dateRange);

  useEffect(() => {
    // Calculate previous period for comparison
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start);
    prevEnd.setTime(prevEnd.getTime() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setTime(prevStart.getTime() - diff);
    
    setPreviousPeriod({
      startDate: prevStart.toISOString().split('T')[0],
      endDate: prevEnd.toISOString().split('T')[0],
    });
  }, [dateRange]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Analytics & Metrics Dashboard</h3>
          <p className="text-sm text-gray-600 mt-1">Platform-wide analytics and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            Export Report
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg shadow p-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Retrieval Quality Metrics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">Retrieval Quality Metrics</h4>
        <MetricsCards
          summary={retrievalSummary}
          previousPeriod={previousPeriod ? retrievalSummary : null}
          loading={loading}
        />
      </div>

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

      {/* Quality Metrics */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">Quality Metrics</h4>
        <QualityMetrics
          qualityStats={qualityStats}
          dateRange={dateRange}
          loading={loading}
        />
      </div>

      {/* Cost Dashboard */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">Cost Dashboard</h4>
        <CostDashboard />
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportReportsDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          dateRange={dateRange}
          metricsData={{
            retrieval: retrievalSummary,
            performance: {
              avg: latencyStats?.summary?.averageLatency || 0,
              min: latencyStats?.stats?.[0]?.minLatency || 0,
              max: latencyStats?.stats?.[0]?.maxLatency || 0,
              p95: latencyStats?.stats?.[0]?.p95Latency || 0,
              p99: latencyStats?.stats?.[0]?.p99Latency || 0,
              throughput: 0,
              errorRate: errorStats ? (errorStats.summary.totalErrors / (errorStats.summary.totalErrors * 10)) * 100 : 0,
            },
            quality: {
              answerQuality: qualityStats?.stats?.find(s => s.metricType === 'answer_quality')?.averageScore || 0,
              citationAccuracy: qualityStats?.stats?.find(s => s.metricType === 'citation_accuracy')?.averageScore || 0,
              relevance: qualityStats?.stats?.find(s => s.metricType === 'relevance')?.averageScore || 0,
            },
          }}
        />
      )}
    </div>
  );
}
