import { apiClient, ApiResponse } from './api';

// A/B Testing Types
export interface ABTest {
  id: string;
  name: string;
  description?: string;
  feature: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  variantA: VariantConfig;
  variantB: VariantConfig;
  trafficAllocation: number; // Percentage (0-100)
  sampleSize: number;
  significanceLevel: number; // e.g., 0.05 for 95% confidence
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

export interface VariantConfig {
  name: string;
  description?: string;
  configuration: Record<string, any>;
}

export interface ABTestMetrics {
  testId: string;
  variantA: VariantMetrics;
  variantB: VariantMetrics;
  statisticalSignificance: StatisticalSignificance;
  lastUpdated: string;
}

export interface VariantMetrics {
  sampleSize: number;
  averageMetrics: Record<string, number>;
  totalEvents: number;
  conversionRate?: number;
}

export interface StatisticalSignificance {
  isSignificant: boolean;
  pValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  improvementPercentage?: number;
  winner?: 'A' | 'B' | null;
}

export interface CreateABTestInput {
  name: string;
  description?: string;
  feature: string;
  variantA: VariantConfig;
  variantB: VariantConfig;
  trafficAllocation: number;
  sampleSize: number;
  significanceLevel: number;
}

export interface UpdateABTestInput {
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed';
  trafficAllocation?: number;
}

export interface ABTestExport {
  test: ABTest;
  metrics: ABTestMetrics;
  analysis: {
    summary: string;
    recommendations: string[];
    charts: any;
  };
}

// A/B Testing API
export const abTestingApi = {
  // List all tests
  list: async (options?: {
    status?: 'draft' | 'active' | 'paused' | 'completed';
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ABTest[]>> => {
    const response = await apiClient.get('/api/ab-testing/tests', {
      params: options,
    });
    return response.data;
  },

  // Get a specific test
  get: async (id: string): Promise<ApiResponse<ABTest>> => {
    const response = await apiClient.get(`/api/ab-testing/tests/${id}`);
    return response.data;
  },

  // Create a new test
  create: async (data: CreateABTestInput): Promise<ApiResponse<ABTest>> => {
    const response = await apiClient.post('/api/ab-testing/tests', data);
    return response.data;
  },

  // Update a test
  update: async (
    id: string,
    data: UpdateABTestInput
  ): Promise<ApiResponse<ABTest>> => {
    const response = await apiClient.put(`/api/ab-testing/tests/${id}`, data);
    return response.data;
  },

  // Delete a test
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/ab-testing/tests/${id}`);
    return response.data;
  },

  // Get test metrics
  getMetrics: async (id: string): Promise<ApiResponse<ABTestMetrics>> => {
    const response = await apiClient.get(`/api/ab-testing/tests/${id}/metrics`);
    return response.data;
  },

  // Update test status
  updateStatus: async (
    id: string,
    status: 'draft' | 'active' | 'paused' | 'completed'
  ): Promise<ApiResponse<ABTest>> => {
    const response = await apiClient.put(`/api/ab-testing/tests/${id}/status`, {
      status,
    });
    return response.data;
  },

  // Get completed tests (historical archive)
  getCompleted: async (options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<ApiResponse<ABTest[]>> => {
    const response = await apiClient.get('/api/ab-testing/tests/completed', {
      params: options,
    });
    return response.data;
  },

  // Export test results
  exportResults: async (
    id: string,
    format: 'pdf' | 'csv'
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/api/ab-testing/tests/${id}/export`,
      {
        params: { format },
        responseType: 'blob',
      }
    );
    return response.data;
  },
};
