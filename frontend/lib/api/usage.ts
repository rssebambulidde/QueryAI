import { apiClient } from './client';
import type { ApiResponse, UsageStats, UsageHistory, UsageWarnings, OverageSummary, RetrievalMetrics, RetrievalMetricsSummary, LatencyStats, LatencyTrends, LatencyAlert, ErrorStats, ErrorTrends, QualityStats, QualityTrends, PerformanceMetrics, CostSummary, CostTrendPoint } from '../api';

export const usageApi = {
  getCurrent: async (): Promise<ApiResponse<{ usage: UsageStats }>> => {
    const response = await apiClient.get('/api/usage/current');
    return response.data;
  },
  getHistory: async (days?: number): Promise<ApiResponse<{ history: UsageHistory[]; days: number }>> => {
    const response = await apiClient.get('/api/usage/history', { params: days ? { days } : {} });
    return response.data;
  },
  getWarnings: async (): Promise<ApiResponse<UsageWarnings>> => {
    const response = await apiClient.get('/api/usage/warnings');
    return response.data;
  },
};

export const metricsApi = {
  getRetrievalMetrics: async (options?: { startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<ApiResponse<RetrievalMetrics>> => {
    const response = await apiClient.get('/api/metrics/retrieval', { params: options });
    return response.data;
  },
  getRetrievalMetricsSummary: async (): Promise<ApiResponse<RetrievalMetricsSummary>> => {
    const response = await apiClient.get('/api/metrics/retrieval/summary');
    return response.data;
  },
  getLatencyStats: async (options?: { operationType?: string; startDate?: string; endDate?: string; minLatency?: number; maxLatency?: number; limit?: number; offset?: number }): Promise<ApiResponse<LatencyStats>> => {
    const response = await apiClient.get('/api/metrics/latency/stats', { params: options });
    return response.data;
  },
  getLatencyTrends: async (options: { operationType: string; startDate: string; endDate: string; interval?: 'hour' | 'day' | 'week' }): Promise<ApiResponse<LatencyTrends>> => {
    const response = await apiClient.get('/api/metrics/latency/trends', { params: options });
    return response.data;
  },
  getLatencyAlerts: async (limit?: number): Promise<ApiResponse<{ alerts: LatencyAlert[]; total: number }>> => {
    const response = await apiClient.get('/api/metrics/latency/alerts', { params: limit ? { limit } : {} });
    return response.data;
  },
  getLatencyAlertStats: async (options?: { startDate?: string; endDate?: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/api/metrics/latency/alerts/stats', { params: options });
    return response.data;
  },
  getErrorStats: async (options?: { serviceType?: string; errorCategory?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<ApiResponse<ErrorStats>> => {
    const response = await apiClient.get('/api/metrics/errors/stats', { params: options });
    return response.data;
  },
  getErrorTrends: async (options: { serviceType: string; errorCategory?: string; startDate: string; endDate: string; interval?: 'hour' | 'day' | 'week' }): Promise<ApiResponse<ErrorTrends>> => {
    const response = await apiClient.get('/api/metrics/errors/trends', { params: options });
    return response.data;
  },
  getErrorAlerts: async (limit?: number): Promise<ApiResponse<{ alerts: any[]; total: number }>> => {
    const response = await apiClient.get('/api/metrics/errors/alerts', { params: limit ? { limit } : {} });
    return response.data;
  },
  getErrorAlertStats: async (options?: { startDate?: string; endDate?: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/api/metrics/errors/alerts/stats', { params: options });
    return response.data;
  },
  getQualityStats: async (options?: { metricType?: string; startDate?: string; endDate?: string; minScore?: number; maxScore?: number; limit?: number; offset?: number }): Promise<ApiResponse<QualityStats>> => {
    const response = await apiClient.get('/api/metrics/quality/stats', { params: options });
    return response.data;
  },
  getQualityTrends: async (options: { metricType: string; startDate: string; endDate: string; interval?: 'hour' | 'day' | 'week' }): Promise<ApiResponse<QualityTrends>> => {
    const response = await apiClient.get('/api/metrics/quality/trends', { params: options });
    return response.data;
  },
};

export const costApi = {
  getSummary: async (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<CostSummary>> => {
    const response = await apiClient.get('/api/analytics/cost/summary', { params: params ?? {} });
    return response.data;
  },
  getTrends: async (params: { startDate: string; endDate: string; interval?: 'hour' | 'day' | 'week' }): Promise<ApiResponse<{ trends: CostTrendPoint[]; interval: string; startDate: string; endDate: string }>> => {
    const response = await apiClient.get('/api/analytics/cost/trends', { params: params ?? {} });
    return response.data;
  },
};
