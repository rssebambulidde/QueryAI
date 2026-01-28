'use client';

import React, { useState } from 'react';
import { ABTest } from '@/lib/api-ab-testing';
import { Button } from '@/components/ui/button';
import { useABTesting } from '@/lib/hooks/use-ab-testing';
import {
  Play,
  Pause,
  CheckCircle,
  Eye,
  MoreVertical,
  TrendingUp,
  Users,
} from 'lucide-react';

interface TestListProps {
  tests: ABTest[];
  loading: boolean;
  onTestSelect: (test: ABTest) => void;
  onStatusChange?: (testId: string, status: 'active' | 'paused' | 'completed') => void;
}

export const TestList: React.FC<TestListProps> = ({
  tests,
  loading,
  onTestSelect,
  onStatusChange,
}) => {
  const { updateTestStatus } = useABTesting();
  const [actioningTestId, setActioningTestId] = useState<string | null>(null);

  const handleStatusChange = async (
    testId: string,
    status: 'active' | 'paused' | 'completed',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setActioningTestId(testId);
    const success = await updateTestStatus(testId, status);
    if (success && onStatusChange) {
      onStatusChange(testId, status);
    }
    setActioningTestId(null);
  };

  const getStatusBadge = (status: ABTest['status']) => {
    const badges = {
      active: 'bg-green-100 text-green-800 border-green-200',
      paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200',
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium border ${
          badges[status]
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading tests...</p>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Tests</h3>
        <p className="text-gray-600 mb-4">
          Create your first A/B test to start experimenting with different variants.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Test Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feature
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Variants
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sample Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Traffic
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tests.map((test) => (
              <tr
                key={test.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onTestSelect(test)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {test.name}
                      </div>
                      {test.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {test.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{test.feature}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(test.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">A:</span> {test.variantA.name}
                    <br />
                    <span className="font-medium">B:</span> {test.variantB.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <Users className="w-4 h-4 mr-1 text-gray-400" />
                    {test.sampleSize.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{test.trafficAllocation}%</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {test.status === 'active' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleStatusChange(test.id, 'paused', e)}
                          disabled={actioningTestId === test.id}
                          title="Pause test"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleStatusChange(test.id, 'completed', e)}
                          disabled={actioningTestId === test.id}
                          title="Complete test"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {test.status === 'paused' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleStatusChange(test.id, 'active', e)}
                        disabled={actioningTestId === test.id}
                        title="Resume test"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTestSelect(test);
                      }}
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
