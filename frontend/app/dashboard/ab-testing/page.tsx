'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useABTesting } from '@/lib/hooks/use-ab-testing';
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
import { useABTestMetrics } from '@/lib/hooks/use-ab-testing';

type ViewMode = 'active' | 'create' | 'historical' | 'view';

export default function ABTestingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { tests, activeTests, completedTests, loading, error } = useABTesting();
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const { metrics, loading: metricsLoading, loadMetrics } = useABTestMetrics(
    selectedTest?.id || null,
    selectedTest?.status === 'active'
  );

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
            <h1 className="text-3xl font-bold text-gray-900">A/B Testing Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Admin & Internal Users Only</p>
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
            onStatusChange={async (testId, status) => {
              // This will be handled by the TestList component
            }}
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
                  <h2 className="text-2xl font-bold text-gray-900">{selectedTest.name}</h2>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-sm text-gray-600">Feature</p>
                  <p className="font-semibold">{selectedTest.feature}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Traffic Allocation</p>
                  <p className="font-semibold">{selectedTest.trafficAllocation}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sample Size</p>
                  <p className="font-semibold">{selectedTest.sampleSize.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Significance Level</p>
                  <p className="font-semibold">{(selectedTest.significanceLevel * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Variant A (Control)</p>
                  <p className="font-semibold">{selectedTest.variantA.name}</p>
                  {selectedTest.variantA.description && (
                    <p className="text-sm text-gray-500 mt-1">{selectedTest.variantA.description}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Variant B (Treatment)</p>
                  <p className="font-semibold">{selectedTest.variantB.name}</p>
                  {selectedTest.variantB.description && (
                    <p className="text-sm text-gray-500 mt-1">{selectedTest.variantB.description}</p>
                  )}
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
    </div>
  );
}
