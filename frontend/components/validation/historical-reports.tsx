'use client';

import React, { useState, useEffect } from 'react';
import { ValidationReport } from '@/lib/api-validation';
import { useValidation } from '@/lib/hooks/use-validation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Eye, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { ReportExport } from './report-export';

export const HistoricalReports: React.FC = () => {
  const { reports, loading, loadReports } = useValidation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<ValidationReport | null>(null);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = reports.filter(
    (report) =>
      report.testSuiteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading reports...</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Available</h3>
        <p className="text-gray-600">
          Run a test suite to generate validation reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search reports by test suite name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredReports.length} of {reports.length} reports
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {filteredReports.map((report) => {
          const improvement = report.trends?.improvement;
          const hasImprovement = improvement && Object.values(improvement).some((v) => v !== 0);

          return (
            <div
              key={report.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{report.testSuiteName}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      Run ID: <span className="font-mono text-xs">{report.runId.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ReportExport report={report} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {selectedReport?.id === report.id ? 'Hide' : 'View'}
                  </Button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Overall Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {report.summary.overallScore.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Retrieval</p>
                  <p className="text-xl font-semibold text-green-600">
                    {report.summary.scores.retrieval.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Answer</p>
                  <p className="text-xl font-semibold text-purple-600">
                    {report.summary.scores.answer.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Citation</p>
                  <p className="text-xl font-semibold text-orange-600">
                    {report.summary.scores.citation.toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Test Results Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Passed</p>
                  <p className="text-xl font-bold text-green-600">{report.summary.passed}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-xl font-bold text-red-600">{report.summary.failed}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Errors</p>
                  <p className="text-xl font-bold text-yellow-600">{report.summary.errors}</p>
                </div>
              </div>

              {/* Improvement Trends */}
              {hasImprovement && improvement && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Improvement Trends</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Overall', value: improvement.overall },
                      { label: 'Retrieval', value: improvement.retrieval },
                      { label: 'Answer', value: improvement.answer },
                      { label: 'Citation', value: improvement.citation },
                    ].map((metric) => {
                      const Icon = metric.value > 0 ? TrendingUp : metric.value < 0 ? TrendingDown : null;
                      return (
                        <div key={metric.label} className="flex items-center gap-2">
                          {Icon && (
                            <Icon
                              className={`w-4 h-4 ${
                                metric.value > 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            />
                          )}
                          <span className="text-sm text-gray-600">{metric.label}:</span>
                          <span
                            className={`text-sm font-semibold ${
                              metric.value > 0 ? 'text-green-600' : metric.value < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}
                          >
                            {metric.value > 0 ? '+' : ''}
                            {metric.value.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {selectedReport?.id === report.id && (
                <div className="border-t mt-4 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Full Report Details</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Total Tests: {report.summary.totalTests}
                  </p>
                  <div className="text-sm text-gray-600">
                    <p>View detailed results and analysis in the exported report.</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Found</h3>
          <p className="text-gray-600">
            Try adjusting your search query to find reports.
          </p>
        </div>
      )}
    </div>
  );
};
