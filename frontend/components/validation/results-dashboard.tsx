'use client';

import React, { useState } from 'react';
import { ValidationRun, ValidationTestResult } from '@/lib/api-validation';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface ResultsDashboardProps {
  run: ValidationRun;
  results: ValidationTestResult[];
  loading: boolean;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  run,
  results,
  loading,
}) => {
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'error'>('all');
  const [sortBy, setSortBy] = useState<'query' | 'status' | 'score'>('query');

  const filteredResults = results.filter((result) => {
    if (filter === 'all') return true;
    return result.status === filter;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    switch (sortBy) {
      case 'status':
        return a.status.localeCompare(b.status);
      case 'score':
        const scoreA = a.scores.answer?.overall || a.scores.retrieval?.f1Score || 0;
        const scoreB = b.scores.answer?.overall || b.scores.retrieval?.f1Score || 0;
        return scoreB - scoreA;
      default:
        return a.query.localeCompare(b.query);
    }
  });

  const getStatusIcon = (status: ValidationTestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: ValidationTestResult['status']) => {
    const badges = {
      passed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      error: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getOverallScore = (result: ValidationTestResult) => {
    const scores = [];
    if (result.scores.retrieval) {
      scores.push(result.scores.retrieval.f1Score);
    }
    if (result.scores.answer) {
      scores.push(result.scores.answer.overall);
    }
    if (result.scores.citation) {
      scores.push(result.scores.citation.overall);
    }
    return scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length) * 100
      : 0;
  };

  if (loading && results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Test Results</h2>
        <div className="flex gap-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Results</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="error">Errors</option>
          </select>
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="query">Sort by Query</option>
            <option value="status">Sort by Status</option>
            <option value="score">Sort by Score</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Tests</p>
          <p className="text-2xl font-bold text-gray-900">{run.totalTests}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Passed</p>
          <p className="text-2xl font-bold text-green-600">{run.passedTests}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Failed</p>
          <p className="text-2xl font-bold text-red-600">{run.failedTests}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Errors</p>
          <p className="text-2xl font-bold text-yellow-600">{run.errorTests}</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Query
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scores
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Execution Time
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedResults.map((result) => (
              <React.Fragment key={result.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(result.status)}
                      <span className="ml-2">{getStatusBadge(result.status)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{result.query}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getOverallScore(result).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {result.scores.retrieval && (
                        <span>R: {(result.scores.retrieval.f1Score * 100).toFixed(0)}% </span>
                      )}
                      {result.scores.answer && (
                        <span>A: {(result.scores.answer.overall * 100).toFixed(0)}% </span>
                      )}
                      {result.scores.citation && (
                        <span>C: {(result.scores.citation.overall * 100).toFixed(0)}%</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {result.executionTime}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedResult(expandedResult === result.id ? null : result.id)
                      }
                    >
                      {expandedResult === result.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </td>
                </tr>
                {expandedResult === result.id && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 bg-gray-50">
                      <div className="space-y-4">
                        {/* Detailed Scores */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {result.scores.retrieval && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                                Retrieval Scores
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Precision:</span>
                                  <span className="font-medium">
                                    {(result.scores.retrieval.precision * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Recall:</span>
                                  <span className="font-medium">
                                    {(result.scores.retrieval.recall * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">F1 Score:</span>
                                  <span className="font-medium">
                                    {(result.scores.retrieval.f1Score * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">MRR:</span>
                                  <span className="font-medium">
                                    {result.scores.retrieval.mrr.toFixed(3)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          {result.scores.answer && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                                Answer Scores
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Relevance:</span>
                                  <span className="font-medium">
                                    {(result.scores.answer.relevance * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Completeness:</span>
                                  <span className="font-medium">
                                    {(result.scores.answer.completeness * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Accuracy:</span>
                                  <span className="font-medium">
                                    {(result.scores.answer.accuracy * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Overall:</span>
                                  <span className="font-medium">
                                    {(result.scores.answer.overall * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          {result.scores.citation && (
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                                Citation Scores
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Accuracy:</span>
                                  <span className="font-medium">
                                    {(result.scores.citation.accuracy * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Completeness:</span>
                                  <span className="font-medium">
                                    {(result.scores.citation.completeness * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Overall:</span>
                                  <span className="font-medium">
                                    {(result.scores.citation.overall * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        {result.details.answer && (
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900 mb-2">Answer</h4>
                            <p className="text-sm text-gray-700 bg-white p-3 rounded border">
                              {result.details.answer}
                            </p>
                          </div>
                        )}

                        {result.details.errors && result.details.errors.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm text-red-900 mb-2">Errors</h4>
                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                              {result.details.errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {sortedResults.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No results found matching the current filter.</p>
        </div>
      )}
    </div>
  );
};
