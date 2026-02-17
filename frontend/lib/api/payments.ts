import { apiClient } from './client';
import type { ApiResponse, PaymentInitiateRequest, PaymentInitiateResponse, Payment, RefundRequest, RefundResponse } from '../api';

export const paymentApi = {
  initiate: async (data: PaymentInitiateRequest & { recurring?: boolean }): Promise<ApiResponse<PaymentInitiateResponse>> => {
    const response = await apiClient.post('/api/payment/initiate', data);
    return response.data;
  },
  getStatus: async (orderTrackingId: string): Promise<ApiResponse<{ payment: Payment }>> => {
    const response = await apiClient.get(`/api/payment/status/${orderTrackingId}`);
    return response.data;
  },
  getHistory: async (): Promise<ApiResponse<{ payments: Payment[] }>> => {
    const response = await apiClient.get('/api/payment/history');
    return response.data;
  },
  refund: async (data: RefundRequest): Promise<ApiResponse<RefundResponse>> => {
    const response = await apiClient.post('/api/payment/refund', data);
    return response.data;
  },
  syncSubscription: async (subscriptionId?: string): Promise<ApiResponse<{ synced: boolean; message: string }>> => {
    const response = await apiClient.post('/api/payment/sync-subscription', { subscription_id: subscriptionId });
    return response.data;
  },
};
