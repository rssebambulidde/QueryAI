import { apiClient, ApiResponse } from './api';

// Health Monitoring Types
export type SystemStatus = 'healthy' | 'degraded' | 'down';
export type ComponentStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  latency?: number;
  errorRate?: number;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  overall: SystemStatus;
  components: ComponentHealth[];
  timestamp: string;
}

export interface ResponseTimeMetric {
  timestamp: string;
  responseTime: number;
  component?: string;
  operation?: string;
}

export interface ErrorRateMetric {
  timestamp: string;
  errorRate: number;
  errorCount: number;
  totalRequests: number;
  errorsByType?: Record<string, number>;
}

export interface ThroughputMetric {
  timestamp: string;
  requestsPerSecond: number;
  concurrentRequests: number;
}

export interface ComponentPerformance {
  component: string;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'error' | 'component';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  component?: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface AlertConfiguration {
  id: string;
  type: 'performance' | 'error' | 'component';
  enabled: boolean;
  threshold: number;
  component?: string;
  metric?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface HealthMetrics {
  systemHealth: SystemHealth;
  responseTime: {
    current: number;
    average: number;
    p95: number;
    p99: number;
    trend: ResponseTimeMetric[];
  };
  errorRate: {
    current: number;
    average: number;
    trend: ErrorRateMetric[];
    breakdown: Record<string, number>;
  };
  throughput: {
    current: number;
    average: number;
    concurrent: number;
    trend: ThroughputMetric[];
  };
  componentPerformance: ComponentPerformance[];
}

// Health Monitoring API
export const healthApi = {
  // System Health
  getSystemHealth: async (): Promise<ApiResponse<SystemHealth>> => {
    const response = await apiClient.get('/api/health/system');
    return response.data;
  },

  getHealthHistory: async (options?: {
    startDate?: string;
    endDate?: string;
    interval?: 'minute' | 'hour' | 'day';
  }): Promise<ApiResponse<{ history: Array<{ timestamp: string; health: SystemHealth }> }>> => {
    const response = await apiClient.get('/api/health/history', {
      params: options,
    });
    return response.data;
  },

  // Response Time
  getResponseTimeMetrics: async (options?: {
    startDate?: string;
    endDate?: string;
    component?: string;
    interval?: 'minute' | 'hour' | 'day';
  }): Promise<ApiResponse<{ metrics: ResponseTimeMetric[] }>> => {
    const response = await apiClient.get('/api/health/response-time', {
      params: options,
    });
    return response.data;
  },

  // Error Rate
  getErrorRateMetrics: async (options?: {
    startDate?: string;
    endDate?: string;
    interval?: 'minute' | 'hour' | 'day';
  }): Promise<ApiResponse<{ metrics: ErrorRateMetric[] }>> => {
    const response = await apiClient.get('/api/health/error-rate', {
      params: options,
    });
    return response.data;
  },

  // Throughput
  getThroughputMetrics: async (options?: {
    startDate?: string;
    endDate?: string;
    interval?: 'minute' | 'hour' | 'day';
  }): Promise<ApiResponse<{ metrics: ThroughputMetric[] }>> => {
    const response = await apiClient.get('/api/health/throughput', {
      params: options,
    });
    return response.data;
  },

  // Component Performance
  getComponentPerformance: async (options?: {
    component?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ performance: ComponentPerformance[] }>> => {
    const response = await apiClient.get('/api/health/component-performance', {
      params: options,
    });
    return response.data;
  },

  // Alerts
  getAlerts: async (options?: {
    type?: 'performance' | 'error' | 'component';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  }): Promise<ApiResponse<{ alerts: PerformanceAlert[]; total: number }>> => {
    const response = await apiClient.get('/api/health/alerts', {
      params: options,
    });
    return response.data;
  },

  acknowledgeAlert: async (alertId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/health/alerts/${alertId}/acknowledge`);
    return response.data;
  },

  resolveAlert: async (alertId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/health/alerts/${alertId}/resolve`);
    return response.data;
  },

  getAlertHistory: async (options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ApiResponse<{ alerts: PerformanceAlert[]; total: number }>> => {
    const response = await apiClient.get('/api/health/alerts/history', {
      params: options,
    });
    return response.data;
  },

  // Alert Configuration
  getAlertConfigurations: async (): Promise<ApiResponse<{ configurations: AlertConfiguration[] }>> => {
    const response = await apiClient.get('/api/health/alert-configurations');
    return response.data;
  },

  updateAlertConfiguration: async (
    id: string,
    config: Partial<AlertConfiguration>
  ): Promise<ApiResponse<AlertConfiguration>> => {
    const response = await apiClient.put(`/api/health/alert-configurations/${id}`, config);
    return response.data;
  },

  createAlertConfiguration: async (
    config: Omit<AlertConfiguration, 'id'>
  ): Promise<ApiResponse<AlertConfiguration>> => {
    const response = await apiClient.post('/api/health/alert-configurations', config);
    return response.data;
  },

  deleteAlertConfiguration: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/health/alert-configurations/${id}`);
    return response.data;
  },

  // Combined Metrics
  getHealthMetrics: async (): Promise<ApiResponse<HealthMetrics>> => {
    const response = await apiClient.get('/api/health/metrics');
    return response.data;
  },
};
