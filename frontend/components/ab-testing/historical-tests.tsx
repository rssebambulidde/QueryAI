'use client';

import React, { useState } from 'react';
import { ABTest } from '@/lib/api-ab-testing';
import { Input } from '@/components/ui/input';
import { Search, Eye, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HistoricalTestsProps {
  tests: ABTest[];
  loading: boolean;
  onTestSelect: (test: ABTest) => void;
}

export const HistoricalTests: React.FC<HistoricalTestsProps> = ({
  tests,
  loading,
  onTestSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTests = tests.filter(
    (test) =>
      test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading historical tests...</p>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Completed Tests</h3>
        <p className="text-gray-600">
          Completed tests will appear here for historical reference and analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search tests by name, feature, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredTests.length} of {tests.length} completed tests
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTests.map((test) => (
          <div
            key={test.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onTestSelect(test)}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {test.name}
              </h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium whitespace-nowrap ml-2">
                Completed
              </span>
            </div>

            {test.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {test.description}
              </p>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <TrendingUp className="w-4 h-4 mr-2" />
                <span className="font-medium">Feature:</span>
                <span className="ml-2">{test.feature}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="font-medium">Completed:</span>
                <span className="ml-2">
                  {test.completedAt
                    ? new Date(test.completedAt).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-xs text-gray-500">
                <div>Variant A: {test.variantA.name}</div>
                <div>Variant B: {test.variantB.name}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onTestSelect(test);
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredTests.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tests Found</h3>
          <p className="text-gray-600">
            Try adjusting your search query to find completed tests.
          </p>
        </div>
      )}
    </div>
  );
};
