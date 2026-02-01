'use client';

import React, { useState } from 'react';
import { ValidationTestSuite } from '@/lib/api-validation';
import { useTestRun } from '@/lib/hooks/use-validation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Play, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface TestSuiteRunnerProps {
  testSuites: ValidationTestSuite[];
  loading: boolean;
  onTestSuiteSelect: (testSuite: ValidationTestSuite) => void;
  onRunStart: (runId: string) => void;
}

export const TestSuiteRunner: React.FC<TestSuiteRunnerProps> = ({
  testSuites,
  loading,
  onTestSuiteSelect,
  onRunStart,
}) => {
  const [selectedTestSuiteId, setSelectedTestSuiteId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { startRun } = useTestRun(null);
  const { toast } = useToast();

  const selectedTestSuite = testSuites.find((ts) => ts.id === selectedTestSuiteId);

  const handleRunTests = async () => {
    if (!selectedTestSuiteId) {
      toast.error('Please select a test suite');
      return;
    }

    setRunning(true);
    try {
      const runId = await startRun({
        testSuiteId: selectedTestSuiteId,
        options: {
          parallel: true,
          timeout: 30000,
        },
      });

      if (runId) {
        onRunStart(runId);
        toast.success('Test run started successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start test run');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading test suites...</p>
      </div>
    );
  }

  if (testSuites.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Test Suites Available</h3>
        <p className="text-gray-600 mb-4">
          Create a test suite in the Test Cases editor to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Suite Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Select Test Suite</h2>
        <div className="space-y-2">
          {testSuites.map((testSuite) => (
            <div
              key={testSuite.id}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedTestSuiteId === testSuite.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedTestSuiteId(testSuite.id);
                onTestSuiteSelect(testSuite);
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{testSuite.name}</h3>
                  {testSuite.description && (
                    <p className="text-sm text-gray-600 mt-1">{testSuite.description}</p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {testSuite.testCases.length} test cases
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {testSuite.configuration.enableRetrievalValidation && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    Retrieval
                  </span>
                )}
                {testSuite.configuration.enableAnswerValidation && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    Answer
                  </span>
                )}
                {testSuite.configuration.enableCitationValidation && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                    Citation
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Suite Configuration */}
      {selectedTestSuite && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Test Suite Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Test Cases</p>
              <p className="text-lg font-semibold">{selectedTestSuite.testCases.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Validation Types</p>
              <div className="flex gap-2">
                {selectedTestSuite.configuration.enableRetrievalValidation && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    Retrieval
                  </span>
                )}
                {selectedTestSuite.configuration.enableAnswerValidation && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    Answer
                  </span>
                )}
                {selectedTestSuite.configuration.enableCitationValidation && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                    Citation
                  </span>
                )}
              </div>
            </div>
            {selectedTestSuite.configuration.retrievalThreshold && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Retrieval Threshold</p>
                <p className="text-lg font-semibold">
                  {(selectedTestSuite.configuration.retrievalThreshold * 100).toFixed(0)}%
                </p>
              </div>
            )}
            {selectedTestSuite.configuration.answerThreshold && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Answer Threshold</p>
                <p className="text-lg font-semibold">
                  {(selectedTestSuite.configuration.answerThreshold * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={handleRunTests}
            disabled={running}
            className="w-full md:w-auto"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
        </div>
      )}

      {!selectedTestSuite && (
        <Alert variant="info">
          <p>Please select a test suite to run tests</p>
        </Alert>
      )}
    </div>
  );
};
