import { useState, useEffect, useCallback } from 'react';
import {
  healthApi,
  SystemHealth,
  ResponseTimeMetric,
  ErrorRateMetric,
  ThroughputMetric,
  ComponentPerformance,
  PerformanceAlert,
  AlertConfiguration,
  HealthMetrics,
} from '@/lib/api-health';
import { useToast } from './use-toast';

export function useHealthMonitoring(autoRefresh: boolean = true, refreshInterval: number = 5000) {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadHealthMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getHealthMetrics();
      if (response.success && response.data) {
        setHealthMetrics(response.data);
        setSystemHealth(response.data.systemHealth);
      } else {
        throw new Error(response.error?.message || 'Failed to load health metrics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load health metrics';
      setError(errorMessage);
      // Don't show toast on auto-refresh errors to avoid spam
      if (!autoRefresh) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [autoRefresh, toast]);

  // Auto-refresh health metrics
  useEffect(() => {
    loadHealthMetrics();

    if (autoRefresh) {
      const interval = setInterval(() => {
        loadHealthMetrics();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [loadHealthMetrics, autoRefresh, refreshInterval]);

  return {
    healthMetrics,
    systemHealth,
    loading,
    error,
    loadHealthMetrics,
  };
}

export function useResponseTimeMetrics(options?: {
  startDate?: string;
  endDate?: string;
  component?: string;
  interval?: 'minute' | 'hour' | 'day';
}) {
  const [metrics, setMetrics] = useState<ResponseTimeMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getResponseTimeMetrics(options);
      if (response.success && response.data) {
        setMetrics(response.data.metrics);
      } else {
        throw new Error(response.error?.message || 'Failed to load response time metrics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load response time metrics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [options, toast]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    loading,
    error,
    loadMetrics,
  };
}

export function useErrorRateMetrics(options?: {
  startDate?: string;
  endDate?: string;
  interval?: 'minute' | 'hour' | 'day';
}) {
  const [metrics, setMetrics] = useState<ErrorRateMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getErrorRateMetrics(options);
      if (response.success && response.data) {
        setMetrics(response.data.metrics);
      } else {
        throw new Error(response.error?.message || 'Failed to load error rate metrics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load error rate metrics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [options, toast]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    loading,
    error,
    loadMetrics,
  };
}

export function useThroughputMetrics(options?: {
  startDate?: string;
  endDate?: string;
  interval?: 'minute' | 'hour' | 'day';
}) {
  const [metrics, setMetrics] = useState<ThroughputMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getThroughputMetrics(options);
      if (response.success && response.data) {
        setMetrics(response.data.metrics);
      } else {
        throw new Error(response.error?.message || 'Failed to load throughput metrics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load throughput metrics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [options, toast]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    loading,
    error,
    loadMetrics,
  };
}

export function useComponentPerformance(options?: {
  component?: string;
  startDate?: string;
  endDate?: string;
}) {
  const [performance, setPerformance] = useState<ComponentPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadPerformance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getComponentPerformance(options);
      if (response.success && response.data) {
        setPerformance(response.data.performance);
      } else {
        throw new Error(response.error?.message || 'Failed to load component performance');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load component performance';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [options, toast]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  return {
    performance,
    loading,
    error,
    loadPerformance,
  };
}

export function useAlerts(options?: {
  type?: 'performance' | 'error' | 'component';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  acknowledged?: boolean;
  resolved?: boolean;
}) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getAlerts(options);
      if (response.success && response.data) {
        setAlerts(response.data.alerts);
      } else {
        throw new Error(response.error?.message || 'Failed to load alerts');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load alerts';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [options, toast]);

  const acknowledgeAlert = useCallback(
    async (alertId: string): Promise<boolean> => {
      try {
        const response = await healthApi.acknowledgeAlert(alertId);
        if (response.success) {
          toast.success('Alert acknowledged');
          await loadAlerts();
          return true;
        } else {
          throw new Error(response.error?.message || 'Failed to acknowledge alert');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to acknowledge alert');
        return false;
      }
    },
    [toast, loadAlerts]
  );

  const resolveAlert = useCallback(
    async (alertId: string): Promise<boolean> => {
      try {
        const response = await healthApi.resolveAlert(alertId);
        if (response.success) {
          toast.success('Alert resolved');
          await loadAlerts();
          return true;
        } else {
          throw new Error(response.error?.message || 'Failed to resolve alert');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to resolve alert');
        return false;
      }
    },
    [toast, loadAlerts]
  );

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  return {
    alerts,
    loading,
    error,
    loadAlerts,
    acknowledgeAlert,
    resolveAlert,
  };
}

export function useAlertConfigurations() {
  const [configurations, setConfigurations] = useState<AlertConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthApi.getAlertConfigurations();
      if (response.success && response.data) {
        setConfigurations(response.data.configurations);
      } else {
        throw new Error(response.error?.message || 'Failed to load alert configurations');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load alert configurations';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateConfiguration = useCallback(
    async (id: string, config: Partial<AlertConfiguration>): Promise<boolean> => {
      try {
        const response = await healthApi.updateAlertConfiguration(id, config);
        if (response.success) {
          toast.success('Alert configuration updated');
          await loadConfigurations();
          return true;
        } else {
          throw new Error(response.error?.message || 'Failed to update alert configuration');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to update alert configuration');
        return false;
      }
    },
    [toast, loadConfigurations]
  );

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  return {
    configurations,
    loading,
    error,
    loadConfigurations,
    updateConfiguration,
  };
}
