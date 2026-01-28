import { useState, useEffect, useCallback } from 'react';
import {
  abTestingApi,
  ABTest,
  ABTestMetrics,
  CreateABTestInput,
  UpdateABTestInput,
} from '@/lib/api-ab-testing';
import { useToast } from './use-toast';

export function useABTesting() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [activeTests, setActiveTests] = useState<ABTest[]>([]);
  const [completedTests, setCompletedTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load all tests
  const loadTests = useCallback(async (status?: 'draft' | 'active' | 'paused' | 'completed') => {
    try {
      setLoading(true);
      setError(null);
      const response = await abTestingApi.list({ status });
      if (response.success && response.data) {
        setTests(response.data);
        setActiveTests(response.data.filter((t) => t.status === 'active'));
        setCompletedTests(response.data.filter((t) => t.status === 'completed'));
      } else {
        throw new Error(response.error?.message || 'Failed to load tests');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load A/B tests';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load active tests
  const loadActiveTests = useCallback(async () => {
    await loadTests('active');
  }, [loadTests]);

  // Load completed tests
  const loadCompletedTests = useCallback(async () => {
    await loadTests('completed');
  }, [loadTests]);

  // Create a new test
  const createTest = useCallback(async (data: CreateABTestInput): Promise<ABTest | null> => {
    try {
      setLoading(true);
      setError(null);
      const response = await abTestingApi.create(data);
      if (response.success && response.data) {
        toast.success('A/B test created successfully');
        await loadTests(); // Refresh list
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to create test');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create A/B test';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, loadTests]);

  // Update a test
  const updateTest = useCallback(async (
    id: string,
    data: UpdateABTestInput
  ): Promise<ABTest | null> => {
    try {
      setLoading(true);
      setError(null);
      const response = await abTestingApi.update(id, data);
      if (response.success && response.data) {
        toast.success('Test updated successfully');
        await loadTests(); // Refresh list
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to update test');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update A/B test';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, loadTests]);

  // Update test status
  const updateTestStatus = useCallback(async (
    id: string,
    status: 'draft' | 'active' | 'paused' | 'completed'
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await abTestingApi.updateStatus(id, status);
      if (response.success) {
        toast.success(`Test ${status} successfully`);
        await loadTests(); // Refresh list
        return true;
      } else {
        throw new Error(response.error?.message || 'Failed to update test status');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update test status';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadTests]);

  // Delete a test
  const deleteTest = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await abTestingApi.delete(id);
      if (response.success) {
        toast.success('Test deleted successfully');
        await loadTests(); // Refresh list
        return true;
      } else {
        throw new Error(response.error?.message || 'Failed to delete test');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete A/B test';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadTests]);

  // Load tests on mount
  useEffect(() => {
    loadTests();
  }, [loadTests]);

  return {
    tests,
    activeTests,
    completedTests,
    loading,
    error,
    loadTests,
    loadActiveTests,
    loadCompletedTests,
    createTest,
    updateTest,
    updateTestStatus,
    deleteTest,
  };
}

export function useABTestMetrics(testId: string | null, autoRefresh: boolean = true) {
  const [metrics, setMetrics] = useState<ABTestMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadMetrics = useCallback(async () => {
    if (!testId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await abTestingApi.getMetrics(testId);
      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        throw new Error(response.error?.message || 'Failed to load metrics');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load test metrics';
      setError(errorMessage);
      // Don't show toast on auto-refresh errors to avoid spam
      if (!autoRefresh) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [testId, autoRefresh, toast]);

  // Auto-refresh metrics
  useEffect(() => {
    if (!testId || !autoRefresh) return;

    loadMetrics();

    const interval = setInterval(() => {
      loadMetrics();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [testId, autoRefresh, loadMetrics]);

  return {
    metrics,
    loading,
    error,
    loadMetrics,
  };
}
