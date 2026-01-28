'use client';

import React, { useState } from 'react';
import { ValidationTestSuite, ValidationTestCase } from '@/lib/api-validation';
import { useValidation } from '@/lib/hooks/use-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Plus, Trash2, Edit2, Save, X, Upload, Download } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { validationApi } from '@/lib/api-validation';

interface TestCaseEditorProps {
  testSuites: ValidationTestSuite[];
  loading: boolean;
  selectedTestSuite: ValidationTestSuite | null;
  onTestSuiteSelect: (testSuite: ValidationTestSuite) => void;
}

export const TestCaseEditor: React.FC<TestCaseEditorProps> = ({
  testSuites,
  loading,
  selectedTestSuite,
  onTestSuiteSelect,
}) => {
  const [editingTestCase, setEditingTestCase] = useState<ValidationTestCase | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { updateTestSuite } = useValidation();
  const { toast } = useToast();

  const handleAddTestCase = () => {
    setEditingTestCase({
      id: 'new',
      query: '',
      expectedTopics: [],
      expectedDocuments: [],
      expectedAnswer: '',
      expectedSources: [],
    });
    setShowAddForm(true);
  };

  const handleSaveTestCase = async (testCase: ValidationTestCase) => {
    if (!selectedTestSuite) return;

    try {
      const updatedTestCases = editingTestCase?.id === 'new'
        ? [...selectedTestSuite.testCases, { ...testCase, id: `temp-${Date.now()}` }]
        : selectedTestSuite.testCases.map((tc) =>
            tc.id === editingTestCase?.id ? testCase : tc
          );

      await updateTestSuite(selectedTestSuite.id, {
        testCases: updatedTestCases.map(({ id, ...tc }) => tc),
      });

      setEditingTestCase(null);
      setShowAddForm(false);
      toast.success('Test case saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save test case');
    }
  };

  const handleDeleteTestCase = async (testCaseId: string) => {
    if (!selectedTestSuite) return;
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      const updatedTestCases = selectedTestSuite.testCases.filter(
        (tc) => tc.id !== testCaseId
      );

      await updateTestSuite(selectedTestSuite.id, {
        testCases: updatedTestCases.map(({ id, ...tc }) => tc),
      });

      toast.success('Test case deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete test case');
    }
  };

  const handleImport = async (file: File) => {
    if (!selectedTestSuite) return;

    try {
      const response = await validationApi.importTestCases(selectedTestSuite.id, file);
      if (response.success) {
        toast.success(`Imported ${response.data?.imported || 0} test cases`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import test cases');
    }
  };

  const handleExport = async () => {
    if (!selectedTestSuite) return;

    try {
      const blob = await validationApi.exportTestCases(selectedTestSuite.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-cases-${selectedTestSuite.name}-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Test cases exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export test cases');
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
        <p className="text-gray-600">No test suites available. Create one first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Suite Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Select Test Suite</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testSuites.map((testSuite) => (
            <div
              key={testSuite.id}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedTestSuite?.id === testSuite.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onTestSuiteSelect(testSuite)}
            >
              <h3 className="font-semibold text-gray-900">{testSuite.name}</h3>
              {testSuite.description && (
                <p className="text-sm text-gray-600 mt-1">{testSuite.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {testSuite.testCases.length} test cases
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Test Cases List */}
      {selectedTestSuite && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Test Cases ({selectedTestSuite.testCases.length})
            </h2>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                  }}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </span>
                </Button>
              </label>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button size="sm" onClick={handleAddTestCase}>
                <Plus className="w-4 h-4 mr-2" />
                Add Test Case
              </Button>
            </div>
          </div>

          {selectedTestSuite.testCases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No test cases yet. Click "Add Test Case" to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTestSuite.testCases.map((testCase) => (
                <div
                  key={testCase.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  {editingTestCase?.id === testCase.id ? (
                    <TestCaseForm
                      testCase={editingTestCase}
                      onSave={handleSaveTestCase}
                      onCancel={() => {
                        setEditingTestCase(null);
                        setShowAddForm(false);
                      }}
                    />
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{testCase.query}</p>
                        {testCase.expectedAnswer && (
                          <p className="text-sm text-gray-600 mt-1">
                            Expected: {testCase.expectedAnswer.substring(0, 100)}
                            {testCase.expectedAnswer.length > 100 ? '...' : ''}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {testCase.expectedTopics && testCase.expectedTopics.length > 0 && (
                            <span className="text-xs text-gray-500">
                              Topics: {testCase.expectedTopics.length}
                            </span>
                          )}
                          {testCase.expectedDocuments && testCase.expectedDocuments.length > 0 && (
                            <span className="text-xs text-gray-500">
                              Docs: {testCase.expectedDocuments.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTestCase(testCase)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTestCase(testCase.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Test Case Form */}
      {showAddForm && editingTestCase && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add Test Case</h2>
          <TestCaseForm
            testCase={editingTestCase}
            onSave={handleSaveTestCase}
            onCancel={() => {
              setEditingTestCase(null);
              setShowAddForm(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

// Test Case Form Component
function TestCaseForm({
  testCase,
  onSave,
  onCancel,
}: {
  testCase: ValidationTestCase;
  onSave: (testCase: ValidationTestCase) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<ValidationTestCase>(testCase);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Query *"
        value={formData.query}
        onChange={(e) => setFormData({ ...formData, query: e.target.value })}
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Answer
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          rows={3}
          value={formData.expectedAnswer || ''}
          onChange={(e) => setFormData({ ...formData, expectedAnswer: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Topics (comma-separated)
        </label>
        <Input
          value={(formData.expectedTopics || []).join(', ')}
          onChange={(e) =>
            setFormData({
              ...formData,
              expectedTopics: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
            })
          }
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Documents (comma-separated)
        </label>
        <Input
          value={(formData.expectedDocuments || []).join(', ')}
          onChange={(e) =>
            setFormData({
              ...formData,
              expectedDocuments: e.target.value.split(',').map((d) => d.trim()).filter(Boolean),
            })
          }
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </form>
  );
}
