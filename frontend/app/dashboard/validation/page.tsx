'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useValidation, useTestSuite, useTestRun } from '@/lib/hooks/use-validation';
import { TestSuiteRunner } from '@/components/validation/test-suite-runner';
import { TestCaseEditor } from '@/components/validation/test-case-editor';
import { ResultsDashboard } from '@/components/validation/results-dashboard';
import { QualityScores } from '@/components/validation/quality-scores';
import { ComparisonCharts } from '@/components/validation/comparison-charts';
import { HistoricalReports } from '@/components/validation/historical-reports';
import { ReportExport } from '@/components/validation/report-export';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Play, FileText, History, Settings } from 'lucide-react';
import { ValidationTestSuite, ValidationRun, ValidationReport } from '@/lib/api-validation';

type ViewMode = 'runner' | 'editor' | 'results' | 'reports';

export default function ValidationPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { testSuites, loading, error } = useValidation();
  const [viewMode, setViewMode] = useState<ViewMode>('runner');
  const [selectedTestSuite, setSelectedTestSuite] = useState<ValidationTestSuite | null>(null);
  const [currentRun, setCurrentRun] = useState<ValidationRun | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Check if user is admin/internal (pro tier or admin role)
  const isAdmin =
    user?.subscriptionTier === 'pro' ||
    user?.email?.includes('@admin') ||
    user?.email?.includes('@internal');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Validation Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Test Suite Runner & Quality Analysis</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'runner' ? 'default' : 'outline'}
              onClick={() => setViewMode('runner')}
            >
              <Play className="w-4 h-4 mr-2" />
              Test Runner
            </Button>
            <Button
              variant={viewMode === 'editor' ? 'default' : 'outline'}
              onClick={() => setViewMode('editor')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Test Cases
            </Button>
            <Button
              variant={viewMode === 'results' ? 'default' : 'outline'}
              onClick={() => setViewMode('results')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Results
            </Button>
            <Button
              variant={viewMode === 'reports' ? 'default' : 'outline'}
              onClick={() => setViewMode('reports')}
            >
              <History className="w-4 h-4 mr-2" />
              Reports
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="error">
            <div>
              <h3 className="font-semibold mb-1">Error</h3>
              <p>{error}</p>
            </div>
          </Alert>
        )}

        {/* Content */}
        {viewMode === 'runner' && (
          <TestSuiteRunner
            testSuites={testSuites}
            loading={loading}
            onTestSuiteSelect={setSelectedTestSuite}
            onRunStart={(runId) => {
              setSelectedRunId(runId);
              setViewMode('results');
            }}
          />
        )}

        {viewMode === 'editor' && (
          <TestCaseEditor
            testSuites={testSuites}
            loading={loading}
            selectedTestSuite={selectedTestSuite}
            onTestSuiteSelect={setSelectedTestSuite}
          />
        )}

        {viewMode === 'results' && selectedRunId && (
          <ValidationResultsView runId={selectedRunId} />
        )}

        {viewMode === 'reports' && (
          <HistoricalReports />
        )}
      </div>
    </div>
  );
}

// Validation Results View Component
function ValidationResultsView({ runId }: { runId: string }) {
  const { run, results, loading } = useTestRun(runId);

  if (loading && !run) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading results...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600">Run not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quality Scores */}
      <QualityScores run={run} />

      {/* Results Dashboard */}
      <ResultsDashboard run={run} results={results} loading={loading} />

      {/* Comparison Charts */}
      <ComparisonCharts run={run} results={results} />
    </div>
  );
}
      </div>
    </div>
  );
}

// Validation Results View Component
function ValidationResultsView({ runId }: { runId: string }) {
  const { run, results, loading } = useTestRun(runId);

  if (loading && !run) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading results...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600">Run not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quality Scores */}
      <QualityScores run={run} />

      {/* Results Dashboard */}
      <ResultsDashboard run={run} results={results} loading={loading} />

      {/* Comparison Charts */}
      <ComparisonCharts run={run} results={results} />
    </div>
  );
}
