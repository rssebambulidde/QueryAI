import { apiClient } from './client';
import type { ApiResponse, Conversation, Message, Source } from '../api';

export const conversationApi = {
  list: async (options?: { limit?: number; offset?: number; includeMetadata?: boolean }): Promise<ApiResponse<Conversation[]>> => {
    const response = await apiClient.get('/api/conversations', { params: options });
    return response.data;
  },
  get: async (id: string): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.get(`/api/conversations/${id}`);
    return response.data;
  },
  create: async (data: { title?: string }): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.post('/api/conversations', data);
    return response.data;
  },
  update: async (id: string, data: { title?: string; metadata?: any; filters?: any }): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.put(`/api/conversations/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/conversations/${id}`);
    return response.data;
  },
  getMessages: async (id: string, options?: { limit?: number; offset?: number }): Promise<ApiResponse<Message[]>> => {
    const response = await apiClient.get(`/api/conversations/${id}/messages`, { params: options });
    return response.data;
  },
  saveMessage: async (id: string, data: { role: 'user' | 'assistant'; content: string; sources?: Source[]; metadata?: Record<string, any> }): Promise<ApiResponse<Message>> => {
    const response = await apiClient.post(`/api/conversations/${id}/messages`, data);
    return response.data;
  },
  deleteMessage: async (conversationId: string, messageId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/conversations/${conversationId}/messages/${messageId}`);
    return response.data;
  },
};
