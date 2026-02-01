'use client';

import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface TokenUsageDisplayProps {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    budget?: number;
    limit?: number;
  };
  showAlerts?: boolean;
  previousUsage?: {
    totalTokens: number;
  };
}

export const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({
  tokenUsage,
  showAlerts = true,
  previousUsage,
}) => {
  const budgetPercentage = tokenUsage.budget
    ? (tokenUsage.totalTokens / tokenUsage.budget) * 100
    : 0;
  const limitPercentage = tokenUsage.limit
    ? (tokenUsage.totalTokens / tokenUsage.limit) * 100
    : 0;

  const getTrend = () => {
    if (!previousUsage) return null;
    const diff = tokenUsage.totalTokens - previousUsage.totalTokens;
    const percentChange = previousUsage.totalTokens > 0
      ? (diff / previousUsage.totalTokens) * 100
      : 0;

    if (Math.abs(percentChange) < 5) return null;

    if (diff > 0) {
      return <TrendingUp className="w-3 h-3 text-red-600" />;
    } else {
      return <TrendingDown className="w-3 h-3 text-green-600" />;
    }
  };

  const getAlertLevel = () => {
    if (tokenUsage.budget) {
      if (budgetPercentage >= 90) return 'critical';
      if (budgetPercentage >= 75) return 'warning';
    }
    if (tokenUsage.limit) {
      if (limitPercentage >= 90) return 'critical';
      if (limitPercentage >= 75) return 'warning';
    }
    return null;
  };

  const alertLevel = getAlertLevel();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          Token Usage
          {getTrend()}
        </h3>
        {alertLevel && showAlerts && (
          <div
            className={`flex items-center gap-1 text-xs ${
              alertLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            {alertLevel === 'critical' ? 'Critical' : 'Warning'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Prompt Tokens</p>
          <p className="text-lg font-semibold text-gray-900">
            {tokenUsage.promptTokens.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Completion Tokens</p>
          <p className="text-lg font-semibold text-gray-900">
            {tokenUsage.completionTokens.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Total Tokens</p>
          <p className="text-lg font-semibold text-blue-600">
            {tokenUsage.totalTokens.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Budget Visualization */}
      {tokenUsage.budget && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Budget Usage</span>
            <span>
              {tokenUsage.totalTokens.toLocaleString()} / {tokenUsage.budget.toLocaleString()} (
              {budgetPercentage.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                budgetPercentage >= 90
                  ? 'bg-red-600'
                  : budgetPercentage >= 75
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Limit Visualization */}
      {tokenUsage.limit && !tokenUsage.budget && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Token Limit</span>
            <span>
              {tokenUsage.totalTokens.toLocaleString()} / {tokenUsage.limit.toLocaleString()} (
              {limitPercentage.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                limitPercentage >= 90
                  ? 'bg-red-600'
                  : limitPercentage >= 75
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(limitPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Alerts */}
      {showAlerts && alertLevel && (
        <div
          className={`p-2 rounded text-xs ${
            alertLevel === 'critical'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}
        >
          {alertLevel === 'critical' ? (
            <p>
              Token usage is critical ({budgetPercentage.toFixed(1)}% of budget used). Consider
              reducing context size or optimizing queries.
            </p>
          ) : (
            <p>
              Token usage is high ({budgetPercentage.toFixed(1)}% of budget used). Monitor
              closely.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
