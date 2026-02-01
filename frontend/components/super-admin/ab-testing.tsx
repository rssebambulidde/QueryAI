'use client';

import { useState } from 'react';
import { useABTesting, useABTestMetrics } from '@/lib/hooks/use-ab-testing';
import { TestList } from '@/components/ab-testing/test-list';
import { TestCreationForm } from '@/components/ab-testing/test-creation-form';
import { HistoricalTests } from '@/components/ab-testing/historical-tests';
import { TestMetricsDisplay } from '@/components/ab-testing/test-metrics-display';
import { StatisticalAnalysisChart } from '@/components/ab-testing/statistical-analysis-chart';
import { TestExportDialog } from '@/components/ab-testing/test-export-dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Plus, Archive, Download } from 'lucide-react';
import { ABTest } from '@/lib/api-ab-testing';

type ViewMode = 'active' | 'create' | 'historical' | 'view';

export default function ABTesting() {
  const { tests, activeTests, completedTests, loading, error } = useABTesting();
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const { metrics, loading: metricsLoading, loadMetrics } = useABTestMetrics(
    selectedTest?.id || null,
    selectedTest?.status === 'active'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">A/B Testing Dashboard</h3>
          <p className="text-sm text-gray-600 mt-1">Create and manage A/B tests</p>
        </div>
        <div className="flex gap-2">
          {viewMode === 'active' && (
            <>
              <Button
                variant="outline"
                onClick={() => setViewMode('create')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Test
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewMode('historical')}
              >
                <Archive className="w-4 h-4 mr-2" />
                Historical Tests
              </Button>
            </>
          )}
          {viewMode === 'create' && (
            <Button variant="outline" onClick={() => setViewMode('active')}>
              Back to Active Tests
            </Button>
          )}
          {viewMode === 'historical' && (
            <Button variant="outline" onClick={() => setViewMode('active')}>
              Back to Active Tests
            </Button>
          )}
          {viewMode === 'view' && selectedTest && (
            <Button variant="outline" onClick={() => {
              setViewMode('active');
              setSelectedTest(null);
            }}>
              Back to Active Tests
            </Button>
          )}
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
      {viewMode === 'active' && (
        <TestList
          tests={activeTests}
          loading={loading}
          onTestSelect={(test) => {
            setSelectedTest(test);
            setViewMode('view');
          }}
          onStatusChange={async () => {}}
        />
      )}

      {viewMode === 'create' && (
        <TestCreationForm
          onSuccess={() => {
            setViewMode('active');
          }}
          onCancel={() => {
            setViewMode('active');
          }}
        />
      )}

      {viewMode === 'historical' && (
        <HistoricalTests
          tests={completedTests}
          loading={loading}
          onTestSelect={(test) => {
            setSelectedTest(test);
            setViewMode('view');
          }}
        />
      )}

      {viewMode === 'view' && selectedTest && (
        <div className="space-y-6">
          {/* Test Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xl font-bold text-gray-900">{selectedTest.name}</h4>
                {selectedTest.description && (
                  <p className="text-gray-600 mt-1">{selectedTest.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTest.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : selectedTest.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : selectedTest.status === 'completed'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedTest.status.charAt(0).toUpperCase() + selectedTest.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Test Metrics */}
          <TestMetricsDisplay
            metrics={metrics}
            loading={metricsLoading}
            onRefresh={loadMetrics}
            autoRefresh={selectedTest.status === 'active'}
          />

          {/* Statistical Analysis Chart */}
          <StatisticalAnalysisChart metrics={metrics} />
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && selectedTest && (
        <TestExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          test={selectedTest}
          metrics={metrics}
        />
      )}
    </div>
  );
}
