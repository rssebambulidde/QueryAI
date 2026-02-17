import { apiClient } from './client';
import type { ApiResponse, Topic } from '../api';

export const topicApi = {
  list: async (): Promise<ApiResponse<Topic[]>> => {
    const response = await apiClient.get('/api/topics');
    return response.data;
  },
  get: async (id: string): Promise<ApiResponse<Topic>> => {
    const response = await apiClient.get(`/api/topics/${id}`);
    return response.data;
  },
  create: async (data: { name: string; description?: string; scopeConfig?: Record<string, any> }): Promise<ApiResponse<Topic>> => {
    const response = await apiClient.post('/api/topics', data);
    return response.data;
  },
  update: async (id: string, data: { name?: string; description?: string; scopeConfig?: Record<string, any> }): Promise<ApiResponse<Topic>> => {
    const response = await apiClient.put(`/api/topics/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/topics/${id}`);
    return response.data;
  },
};
