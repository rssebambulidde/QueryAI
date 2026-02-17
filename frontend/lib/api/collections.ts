import { apiClient } from './client';
import type { ApiResponse, Collection, CreateCollectionInput, UpdateCollectionInput, Conversation } from '../api';

export const collectionApi = {
  list: async (): Promise<ApiResponse<Collection[]>> => {
    const response = await apiClient.get('/api/collections');
    return response.data;
  },
  get: async (id: string): Promise<ApiResponse<Collection>> => {
    const response = await apiClient.get(`/api/collections/${id}`);
    return response.data;
  },
  create: async (input: CreateCollectionInput): Promise<ApiResponse<Collection>> => {
    const response = await apiClient.post('/api/collections', input);
    return response.data;
  },
  update: async (id: string, input: UpdateCollectionInput): Promise<ApiResponse<Collection>> => {
    const response = await apiClient.put(`/api/collections/${id}`, input);
    return response.data;
  },
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/collections/${id}`);
    return response.data;
  },
  addConversation: async (collectionId: string, conversationId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/collections/${collectionId}/conversations/${conversationId}`);
    return response.data;
  },
  removeConversation: async (collectionId: string, conversationId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/collections/${collectionId}/conversations/${conversationId}`);
    return response.data;
  },
  search: async (collectionId: string, query: string): Promise<ApiResponse<Conversation[]>> => {
    const response = await apiClient.get(`/api/collections/${collectionId}/search`, { params: { q: query } });
    return response.data;
  },
};
