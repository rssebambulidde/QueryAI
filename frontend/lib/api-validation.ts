import { apiClient, ApiResponse } from './api';

// Validation Types
export interface ValidationTestSuite {
  id: string;
  name: string;
  description?: string;
  testCases: ValidationTestCase[];
  configuration: {
    enableRetrievalValidation: boolean;
    enableAnswerValidation: boolean;
    enableCitationValidation: boolean;
    retrievalThreshold?: number;
    answerThreshold?: number;
    citationThreshold?: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ValidationTestCase {
  id: string;
  query: string;
  expectedTopics?: string[];
  expectedDocuments?: string[];
  expectedAnswer?: string;
  expectedSources?: Array<{
    type: 'document' | 'web';
    title: string;
    url?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ValidationTestResult {
  id: string;
  testSuiteId: string;
  testCaseId: string;
  query: string;
  status: 'passed' | 'failed' | 'error';
  scores: {
    retrieval?: {
      precision: number;
      recall: number;
      f1Score: number;
      mrr: number;
    };
    answer?: {
      relevance: number;
      completeness: number;
      accuracy: number;
      overall: number;
    };
    citation?: {
      accuracy: number;
      completeness: number;
      overall: number;
    };
  };
  details: {
    retrievedDocuments?: string[];
    retrievedTopics?: string[];
    answer?: string;
    sources?: Array<{
      type: 'document' | 'web';
      title: string;
      url?: string;
    }>;
    errors?: string[];
  };
  executionTime: number;
  timestamp: string;
}

export interface ValidationRun {
  id: string;
  testSuiteId: string;
  testSuiteName: string;
  status: 'running' | 'completed' | 'failed';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  errorTests: number;
  overallScore: number;
  scores: {
    retrieval: number;
    answer: number;
    citation: number;
  };
  results: ValidationTestResult[];
  startedAt: string;
  completedAt?: string;
  createdBy: string;
}

export interface CreateTestSuiteInput {
  name: string;
  description?: string;
  testCases: Omit<ValidationTestCase, 'id'>[];
  configuration: ValidationTestSuite['configuration'];
}

export interface UpdateTestSuiteInput {
  name?: string;
  description?: string;
  testCases?: Omit<ValidationTestCase, 'id'>[];
  configuration?: Partial<ValidationTestSuite['configuration']>;
}

export interface RunTestSuiteInput {
  testSuiteId: string;
  options?: {
    parallel?: boolean;
    timeout?: number;
  };
}

export interface ValidationReport {
  id: string;
  runId: string;
  testSuiteId: string;
  testSuiteName: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    errors: number;
    overallScore: number;
    scores: {
      retrieval: number;
      answer: number;
      citation: number;
    };
  };
  results: ValidationTestResult[];
  trends?: {
    previousRun?: {
      overallScore: number;
      scores: {
        retrieval: number;
        answer: number;
        citation: number;
      };
    };
    improvement?: {
      overall: number;
      retrieval: number;
      answer: number;
      citation: number;
    };
  };
  createdAt: string;
}

// Validation API
export const validationApi = {
  // Test Suites
  listTestSuites: async (): Promise<ApiResponse<ValidationTestSuite[]>> => {
    const response = await apiClient.get('/api/validation/test-suites');
    return response.data;
  },

  getTestSuite: async (id: string): Promise<ApiResponse<ValidationTestSuite>> => {
    const response = await apiClient.get(`/api/validation/test-suites/${id}`);
    return response.data;
  },

  createTestSuite: async (
    data: CreateTestSuiteInput
  ): Promise<ApiResponse<ValidationTestSuite>> => {
    const response = await apiClient.post('/api/validation/test-suites', data);
    return response.data;
  },

  updateTestSuite: async (
    id: string,
    data: UpdateTestSuiteInput
  ): Promise<ApiResponse<ValidationTestSuite>> => {
    const response = await apiClient.put(`/api/validation/test-suites/${id}`, data);
    return response.data;
  },

  deleteTestSuite: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/validation/test-suites/${id}`);
    return response.data;
  },

  // Test Cases
  addTestCase: async (
    testSuiteId: string,
    testCase: Omit<ValidationTestCase, 'id'>
  ): Promise<ApiResponse<ValidationTestCase>> => {
    const response = await apiClient.post(
      `/api/validation/test-suites/${testSuiteId}/test-cases`,
      testCase
    );
    return response.data;
  },

  updateTestCase: async (
    testSuiteId: string,
    testCaseId: string,
    testCase: Partial<Omit<ValidationTestCase, 'id'>>
  ): Promise<ApiResponse<ValidationTestCase>> => {
    const response = await apiClient.put(
      `/api/validation/test-suites/${testSuiteId}/test-cases/${testCaseId}`,
      testCase
    );
    return response.data;
  },

  deleteTestCase: async (
    testSuiteId: string,
    testCaseId: string
  ): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(
      `/api/validation/test-suites/${testSuiteId}/test-cases/${testCaseId}`
    );
    return response.data;
  },

  importTestCases: async (
    testSuiteId: string,
    file: File
  ): Promise<ApiResponse<{ imported: number; errors: string[] }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(
      `/api/validation/test-suites/${testSuiteId}/test-cases/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  exportTestCases: async (testSuiteId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/api/validation/test-suites/${testSuiteId}/test-cases/export`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },

  // Test Execution
  runTestSuite: async (
    data: RunTestSuiteInput
  ): Promise<ApiResponse<{ runId: string }>> => {
    const response = await apiClient.post('/api/validation/runs', data);
    return response.data;
  },

  getRunStatus: async (runId: string): Promise<ApiResponse<ValidationRun>> => {
    const response = await apiClient.get(`/api/validation/runs/${runId}`);
    return response.data;
  },

  getRunResults: async (runId: string): Promise<ApiResponse<ValidationTestResult[]>> => {
    const response = await apiClient.get(`/api/validation/runs/${runId}/results`);
    return response.data;
  },

  // Reports
  listReports: async (options?: {
    testSuiteId?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<ApiResponse<ValidationReport[]>> => {
    const response = await apiClient.get('/api/validation/reports', {
      params: options,
    });
    return response.data;
  },

  getReport: async (id: string): Promise<ApiResponse<ValidationReport>> => {
    const response = await apiClient.get(`/api/validation/reports/${id}`);
    return response.data;
  },

  exportReport: async (reportId: string, format: 'pdf' | 'markdown'): Promise<Blob> => {
    const response = await apiClient.get(`/api/validation/reports/${reportId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },
};
