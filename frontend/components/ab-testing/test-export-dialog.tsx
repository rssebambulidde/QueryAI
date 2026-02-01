'use client';

import React, { useState } from 'react';
import { ABTest, ABTestMetrics } from '@/lib/api-ab-testing';
import { abTestingApi } from '@/lib/api-ab-testing';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { X, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface TestExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  test: ABTest;
  metrics: ABTestMetrics | null;
}

export const TestExportDialog: React.FC<TestExportDialogProps> = ({
  isOpen,
  onClose,
  test,
  metrics,
}) => {
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      setExporting(format);
      const blob = await abTestingApi.exportResults(test.id, format);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ab-test-${test.name}-${new Date().toISOString()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} export downloaded successfully`);
      onClose();
    } catch (error: any) {
      toast.error(error.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Export Test Results</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Export the test results and analysis in your preferred format.
            </p>
          </div>

          {/* Test Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Test: {test.name}</p>
            <p className="text-xs text-gray-600">
              Status: {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
            </p>
            {metrics && (
              <p className="text-xs text-gray-600">
                Last Updated: {new Date(metrics.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-6 h-6 text-blue-600" />
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">Export as PDF</p>
                <p className="text-sm text-gray-600">
                  Complete report with charts and analysis
                </p>
              </div>
              {exporting === 'pdf' && (
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              )}
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">Export as CSV</p>
                <p className="text-sm text-gray-600">
                  Raw data for further analysis
                </p>
              </div>
              {exporting === 'csv' && (
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          </div>

          {!metrics && (
            <Alert variant="warning">
              <p className="text-sm">
                No metrics available yet. Metrics will be included in the export once data is
                collected.
              </p>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={exporting !== null}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
