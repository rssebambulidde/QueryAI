import { apiClient } from './client';
import type { ApiResponse, SubscriptionData, UsageLimit, Subscription, BillingHistory } from '../api';

export const subscriptionApi = {
  get: async (): Promise<ApiResponse<SubscriptionData>> => {
    const response = await apiClient.get('/api/subscription');
    return response.data;
  },
  getLimits: async (): Promise<ApiResponse<{ queries: UsageLimit; tavilySearches: UsageLimit }>> => {
    const response = await apiClient.get('/api/subscription/limits');
    return response.data;
  },
  upgrade: async (tier: 'free' | 'pro'): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.put('/api/subscription/upgrade', { tier });
    return response.data;
  },
  cancel: async (immediate: boolean = false): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.post('/api/subscription/cancel', { immediate });
    return response.data;
  },
  downgrade: async (tier: 'free' | 'pro', immediate: boolean = false): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.put('/api/subscription/downgrade', { tier, immediate });
    return response.data;
  },
  reactivate: async (): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.post('/api/subscription/reactivate');
    return response.data;
  },
  getBillingHistory: async (): Promise<ApiResponse<BillingHistory>> => {
    const response = await apiClient.get('/api/subscription/billing-history');
    return response.data;
  },
  downloadInvoice: async (paymentId: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/subscription/invoice/${paymentId}`, { responseType: 'blob' });
    return response.data;
  },
  getHistory: async (): Promise<ApiResponse<{ history: any[]; total: number }>> => {
    const response = await apiClient.get('/api/subscription/history');
    return response.data;
  },
  getProratedPricing: async (toTier: 'free' | 'pro', toBillingPeriod?: 'monthly' | 'annual'): Promise<ApiResponse<{ proratedPricing: any }>> => {
    const params: { toTier: string; currency: string; toBillingPeriod?: string } = { toTier, currency: 'USD' };
    if (toBillingPeriod) params.toBillingPeriod = toBillingPeriod;
    const response = await apiClient.get('/api/subscription/prorated-pricing', { params });
    return response.data;
  },
  startTrial: async (tier: 'pro', trialDays: number = 7): Promise<ApiResponse<{ subscription: Subscription; trial_end: string }>> => {
    const response = await apiClient.post('/api/subscription/start-trial', { tier, trialDays });
    return response.data;
  },
  getPayPalStatus: async (): Promise<ApiResponse<{ hasPayPalSubscription: boolean; subscription: Subscription; paypalStatus: { subscriptionId: string; status: string; next_billing_time?: string } | null }>> => {
    const response = await apiClient.get('/api/subscription/paypal-status');
    return response.data;
  },
};
