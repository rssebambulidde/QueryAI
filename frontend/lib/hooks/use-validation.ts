import { useState, useEffect, useCallback } from 'react';
import {
  validationApi,
  ValidationTestSuite,
  ValidationRun,
  ValidationReport,
  ValidationTestResult,
  CreateTestSuiteInput,
  UpdateTestSuiteInput,
  RunTestSuiteInput,
  ValidationTestCase,
} from '@/lib/api-validation';
import { useToast } from './use-toast';

export function useValidation() {
  const [testSuites, setTestSuites] = useState<ValidationTestSuite[]>([]);
  const [reports, setReports] = useState<ValidationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load test suites
  const loadTestSuites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await validationApi.listTestSuites();
      if (response.success && response.data) {
        setTestSuites(response.data);
      } else {
        throw new Error(response.error?.message || 'Failed to load test suites');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load test suites';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load reports
  const loadReports = useCallback(async (options?: {
    testSuiteId?: string;
    search?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await validationApi.listReports(options);
      if (response.success && response.data) {
        setReports(response.data);
      } else {
        throw new Error(response.error?.message || 'Failed to load reports');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load reports';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create test suite
  const createTestSuite = useCallback(
    async (data: CreateTestSuiteInput): Promise<ValidationTestSuite | null> => {
      try {
        setLoading(true);
        setError(null);
        const response = await validationApi.createTestSuite(data);
        if (response.success && response.data) {
          toast.success('Test suite created successfully');
          await loadTestSuites();
          return response.data;
        } else {
          throw new Error(response.error?.message || 'Failed to create test suite');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create test suite';
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast, loadTestSuites]
  );

  // Update test suite
  const updateTestSuite = useCallback(
    async (
      id: string,
      data: UpdateTestSuiteInput
    ): Promise<ValidationTestSuite | null> => {
      try {
        setLoading(true);
        setError(null);
        const response = await validationApi.updateTestSuite(id, data);
        if (response.success && response.data) {
          toast.success('Test suite updated successfully');
          await loadTestSuites();
          return response.data;
        } else {
          throw new Error(response.error?.message || 'Failed to update test suite');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update test suite';
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast, loadTestSuites]
  );

  // Delete test suite
  const deleteTestSuite = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);
        const response = await validationApi.deleteTestSuite(id);
        if (response.success) {
          toast.success('Test suite deleted successfully');
          await loadTestSuites();
          return true;
        } else {
          throw new Error(response.error?.message || 'Failed to delete test suite');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to delete test suite';
        setError(errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [toast, loadTestSuites]
  );

  // Load test suites on mount
  useEffect(() => {
    loadTestSuites();
  }, [loadTestSuites]);

  return {
    testSuites,
    reports,
    loading,
    error,
    loadTestSuites,
    loadReports,
    createTestSuite,
    updateTestSuite,
    deleteTestSuite,
  };
}

export function useTestSuite(testSuiteId: string | null) {
  const [testSuite, setTestSuite] = useState<ValidationTestSuite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadTestSuite = useCallback(async () => {
    if (!testSuiteId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await validationApi.getTestSuite(testSuiteId);
      if (response.success && response.data) {
        setTestSuite(response.data);
      } else {
        throw new Error(response.error?.message || 'Failed to load test suite');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load test suite';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [testSuiteId, toast]);

  useEffect(() => {
    loadTestSuite();
  }, [loadTestSuite]);

  return {
    testSuite,
    loading,
    error,
    loadTestSuite,
  };
}

export function useTestRun(runId: string | null, pollInterval: number = 2000) {
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [results, setResults] = useState<ValidationTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadRun = useCallback(async () => {
    if (!runId) return;

    try {
      setLoading(true);
      setError(null);
      const [runResponse, resultsResponse] = await Promise.all([
        validationApi.getRunStatus(runId),
        validationApi.getRunResults(runId),
      ]);

      if (runResponse.success && runResponse.data) {
        setRun(runResponse.data);
      }

      if (resultsResponse.success && resultsResponse.data) {
        setResults(resultsResponse.data);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load test run';
      setError(errorMessage);
      if (!run || run.status === 'running') {
        // Only show error if not polling
      }
    } finally {
      setLoading(false);
    }
  }, [runId, toast]);

  // Poll for updates if run is in progress
  useEffect(() => {
    if (!runId) return;

    loadRun();

    if (run?.status === 'running') {
      const interval = setInterval(() => {
        loadRun();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [runId, run?.status, loadRun, pollInterval]);

  const startRun = useCallback(
    async (data: RunTestSuiteInput): Promise<string | null> => {
      try {
        setLoading(true);
        setError(null);
        const response = await validationApi.runTestSuite(data);
        if (response.success && response.data) {
          return response.data.runId;
        } else {
          throw new Error(response.error?.message || 'Failed to start test run');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to start test run';
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  return {
    run,
    results,
    loading,
    error,
    loadRun,
    startRun,
  };
}
