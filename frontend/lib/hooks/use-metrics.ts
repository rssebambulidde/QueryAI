'use client';

import { useState, useEffect } from 'react';
import { metricsApi, RetrievalMetrics, RetrievalMetricsSummary, LatencyStats, LatencyTrends, ErrorStats, ErrorTrends, QualityStats, QualityTrends } from '@/lib/api';

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Re-export for convenience
export type { DateRange };

export function useMetrics(dateRange?: DateRange) {
  const [retrievalMetrics, setRetrievalMetrics] = useState<RetrievalMetrics | null>(null);
  const [retrievalSummary, setRetrievalSummary] = useState<RetrievalMetricsSummary | null>(null);
  const [latencyStats, setLatencyStats] = useState<LatencyStats | null>(null);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [qualityStats, setQualityStats] = useState<QualityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const options = dateRange ? {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      } : {};

      // Load all metrics in parallel
      const [
        retrievalResponse,
        summaryResponse,
        latencyResponse,
        errorResponse,
        qualityResponse,
      ] = await Promise.all([
        metricsApi.getRetrievalMetrics(options),
        metricsApi.getRetrievalMetricsSummary(),
        metricsApi.getLatencyStats(options),
        metricsApi.getErrorStats(options),
        metricsApi.getQualityStats(options),
      ]);

      if (retrievalResponse.success && retrievalResponse.data) {
        setRetrievalMetrics(retrievalResponse.data);
      }

      if (summaryResponse.success && summaryResponse.data) {
        setRetrievalSummary(summaryResponse.data);
      }

      if (latencyResponse.success && latencyResponse.data) {
        setLatencyStats(latencyResponse.data);
      }

      if (errorResponse.success && errorResponse.data) {
        setErrorStats(errorResponse.data);
      }

      if (qualityResponse.success && qualityResponse.data) {
        setQualityStats(qualityResponse.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load metrics');
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [dateRange?.startDate, dateRange?.endDate]);

  return {
    retrievalMetrics,
    retrievalSummary,
    latencyStats,
    errorStats,
    qualityStats,
    loading,
    error,
    refetch: loadMetrics,
  };
}

export function useLatencyTrends(
  operationType: string,
  dateRange: DateRange,
  interval: 'hour' | 'day' | 'week' = 'day'
) {
  const [trends, setTrends] = useState<LatencyTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await metricsApi.getLatencyTrends({
          operationType,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          interval,
        });
        if (response.success && response.data) {
          setTrends(response.data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load latency trends');
      } finally {
        setLoading(false);
      }
    };

    if (operationType && dateRange.startDate && dateRange.endDate) {
      loadTrends();
    }
  }, [operationType, dateRange.startDate, dateRange.endDate, interval]);

  return { trends, loading, error };
}

export function useErrorTrends(
  serviceType: string,
  dateRange: DateRange,
  errorCategory?: string,
  interval: 'hour' | 'day' | 'week' = 'day'
) {
  const [trends, setTrends] = useState<ErrorTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await metricsApi.getErrorTrends({
          serviceType,
          errorCategory,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          interval,
        });
        if (response.success && response.data) {
          setTrends(response.data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load error trends');
      } finally {
        setLoading(false);
      }
    };

    if (serviceType && dateRange.startDate && dateRange.endDate) {
      loadTrends();
    }
  }, [serviceType, errorCategory, dateRange.startDate, dateRange.endDate, interval]);

  return { trends, loading, error };
}

export function useQualityTrends(
  metricType: string,
  dateRange: DateRange,
  interval: 'hour' | 'day' | 'week' = 'day'
) {
  const [trends, setTrends] = useState<QualityTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await metricsApi.getQualityTrends({
          metricType,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          interval,
        });
        if (response.success && response.data) {
          setTrends(response.data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load quality trends');
      } finally {
        setLoading(false);
      }
    };

    if (metricType && dateRange.startDate && dateRange.endDate) {
      loadTrends();
    }
  }, [metricType, dateRange.startDate, dateRange.endDate, interval]);

  return { trends, loading, error };
}
