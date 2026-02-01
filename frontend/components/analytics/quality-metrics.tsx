'use client';

import { QualityStats } from '@/lib/api';
import { TimeSeriesChart } from './charts/time-series-chart';
import { PieChart } from './charts/pie-chart';
import { useQualityTrends, DateRange } from '@/lib/hooks/use-metrics';

interface QualityMetricsProps {
  qualityStats: QualityStats | null;
  dateRange: DateRange;
  loading?: boolean;
}

export function QualityMetrics({ qualityStats, dateRange, loading }: QualityMetricsProps) {
  const { trends: answerQualityTrends } = useQualityTrends('answer_quality', dateRange, 'day');
  const { trends: citationTrends } = useQualityTrends('citation_accuracy', dateRange, 'day');
  const { trends: relevanceTrends } = useQualityTrends('relevance', dateRange, 'day');

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

  if (!qualityStats) {
    return (
      <div className="text-center py-8 text-gray-500">
        No quality metrics data available
      </div>
    );
  }

  // Group stats by metric type for breakdown
  const statsByType = qualityStats.stats.reduce((acc, stat) => {
    if (!acc[stat.metricType]) {
      acc[stat.metricType] = [];
    }
    acc[stat.metricType].push(stat);
    return acc;
  }, {} as Record<string, typeof qualityStats.stats>);

  const pieData = Object.entries(statsByType).map(([type, stats]) => ({
    name: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value: stats.reduce((sum, s) => sum + s.averageScore, 0) / stats.length,
  }));

  return (
    <div className="space-y-6">
      {/* Quality Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Answer Quality</h3>
          <p className="text-2xl font-bold text-gray-900">
            {qualityStats.stats
              .filter((s) => s.metricType === 'answer_quality')
              .reduce((sum, s) => sum + s.averageScore, 0) /
              Math.max(
                1,
                qualityStats.stats.filter((s) => s.metricType === 'answer_quality').length
              ) || 0}
            /10
          </p>
          <p className="text-xs text-gray-500 mt-2">Average answer quality score</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Citation Accuracy</h3>
          <p className="text-2xl font-bold text-gray-900">
            {(
              (qualityStats.stats
                .filter((s) => s.metricType === 'citation_accuracy')
                .reduce((sum, s) => sum + s.averageScore, 0) /
                Math.max(
                  1,
                  qualityStats.stats.filter((s) => s.metricType === 'citation_accuracy').length
                )) *
              100
            ).toFixed(1) || 0}
            %
          </p>
          <p className="text-xs text-gray-500 mt-2">Average citation accuracy</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Relevance Score</h3>
          <p className="text-2xl font-bold text-gray-900">
            {qualityStats.stats
              .filter((s) => s.metricType === 'relevance')
              .reduce((sum, s) => sum + s.averageScore, 0) /
              Math.max(
                1,
                qualityStats.stats.filter((s) => s.metricType === 'relevance').length
              ) || 0}
            /10
          </p>
          <p className="text-xs text-gray-500 mt-2">Average relevance score</p>
        </div>
      </div>

      {/* Quality Breakdown by Source Type */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quality Breakdown by Metric Type
          </h2>
          <PieChart data={pieData} height={300} />
        </div>
      )}

      {/* Answer Quality Trends */}
      {answerQualityTrends && answerQualityTrends.trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Answer Quality Trends</h2>
          <TimeSeriesChart
            data={answerQualityTrends.trends.map((t) => ({
              date: t.date,
              score: t.averageScore,
            }))}
            dataKeys={[{ key: 'score', color: '#10B981', name: 'Quality Score' }]}
            height={300}
          />
        </div>
      )}

      {/* Citation Accuracy Trends */}
      {citationTrends && citationTrends.trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Citation Accuracy Trends</h2>
          <TimeSeriesChart
            data={citationTrends.trends.map((t) => ({
              date: t.date,
              accuracy: t.averageScore * 100,
            }))}
            dataKeys={[{ key: 'accuracy', color: '#3B82F6', name: 'Accuracy %' }]}
            height={300}
          />
        </div>
      )}

      {/* Relevance Trends */}
      {relevanceTrends && relevanceTrends.trends.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Relevance Score Trends</h2>
          <TimeSeriesChart
            data={relevanceTrends.trends.map((t) => ({
              date: t.date,
              relevance: t.averageScore,
            }))}
            dataKeys={[{ key: 'relevance', color: '#8B5CF6', name: 'Relevance Score' }]}
            height={300}
          />
        </div>
      )}
    </div>
  );
}
