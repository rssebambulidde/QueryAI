'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { DateRangePicker, DateRange } from '@/components/analytics/date-range-picker';
import { MetricsCards } from '@/components/analytics/metrics-cards';
import { PerformanceDashboard } from '@/components/analytics/performance-dashboard';
import { QualityMetrics } from '@/components/analytics/quality-metrics';
import { ExportReportsDialog } from '@/components/analytics/export-reports-dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useMetrics } from '@/lib/hooks/use-metrics';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
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

  // Check if user is admin/internal (pro tier or admin role)
  const isAdmin = user?.subscriptionTier === 'pro' || user?.email?.includes('@admin') || user?.email?.includes('@internal');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, isAdmin, router]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics & Metrics Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Admin & Internal Users Only</p>
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
          <h2 className="text-xl font-semibold text-gray-900">Retrieval Quality Metrics</h2>
          <MetricsCards
            summary={retrievalSummary}
            previousPeriod={previousPeriod ? retrievalSummary : null}
            loading={loading}
          />
        </div>

        {/* Performance Metrics */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Performance Metrics</h2>
          <PerformanceDashboard
            latencyStats={latencyStats}
            errorStats={errorStats}
            dateRange={dateRange}
            loading={loading}
          />
        </div>

        {/* Quality Metrics */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Quality Metrics</h2>
          <QualityMetrics
            qualityStats={qualityStats}
            dateRange={dateRange}
            loading={loading}
          />
        </div>
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
              throughput: 0, // Calculate from data
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
