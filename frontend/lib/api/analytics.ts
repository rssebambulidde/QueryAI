import { apiClient } from './client';
import type { ApiResponse, AnalyticsOverview, QueryStatistics, TopQuery, APIUsageMetrics, UsageByDate } from '../api';

export const analyticsApi = {
  getOverview: async (days: number = 30): Promise<ApiResponse<AnalyticsOverview>> => {
    const response = await apiClient.get('/api/analytics/overview', { params: { days } });
    return response.data;
  },
  getQueryStatistics: async (startDate?: string, endDate?: string): Promise<ApiResponse<QueryStatistics>> => {
    const response = await apiClient.get('/api/analytics/query-statistics', { params: { startDate, endDate } });
    return response.data;
  },
  getTopQueries: async (limit: number = 10, startDate?: string, endDate?: string): Promise<ApiResponse<{ queries: TopQuery[] }>> => {
    const response = await apiClient.get('/api/analytics/top-queries', { params: { limit, startDate, endDate } });
    return response.data;
  },
  getAPIUsage: async (startDate?: string, endDate?: string): Promise<ApiResponse<APIUsageMetrics>> => {
    const response = await apiClient.get('/api/analytics/api-usage', { params: { startDate, endDate } });
    return response.data;
  },
  getUsageByDate: async (days: number = 30, startDate?: string, endDate?: string): Promise<ApiResponse<{ usage: UsageByDate[] }>> => {
    const response = await apiClient.get('/api/analytics/usage-by-date', { params: { days, startDate, endDate } });
    return response.data;
  },
};
