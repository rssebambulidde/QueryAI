'use client';

import React from 'react';
import { DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

interface CostEstimationProps {
  cost: {
    perQuery: number;
    total: number;
    breakdown: CostBreakdown;
  };
  showAlerts?: boolean;
  budget?: number;
  previousCost?: {
    total: number;
  };
}

export interface CostBreakdown {
  embedding?: number;
  search?: number;
  ai?: {
    prompt: number;
    completion: number;
    total: number;
  };
  storage?: number;
  other?: number;
}

export const CostEstimation: React.FC<CostEstimationProps> = ({
  cost,
  showAlerts = true,
  budget,
  previousCost,
}) => {
  const budgetPercentage = budget ? (cost.total / budget) * 100 : 0;
  const getTrend = () => {
    if (!previousCost) return null;
    const diff = cost.total - previousCost.total;
    if (Math.abs(diff) < 0.01) return null;

    if (diff > 0) {
      return <TrendingUp className="w-3 h-3 text-red-600" />;
    }
    return null;
  };

  const getAlertLevel = () => {
    if (budget) {
      if (budgetPercentage >= 90) return 'critical';
      if (budgetPercentage >= 75) return 'warning';
    }
    return null;
  };

  const alertLevel = getAlertLevel();

  const formatCost = (amount: number) => {
    if (amount < 0.01) {
      return `$${(amount * 1000).toFixed(2)}m`;
    }
    return `$${amount.toFixed(4)}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          Cost Estimation
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Cost Per Query</p>
          <p className="text-xl font-bold text-green-600">{formatCost(cost.perQuery)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Total Cost</p>
          <p className="text-xl font-bold text-gray-900">{formatCost(cost.total)}</p>
        </div>
      </div>

      {/* Budget Visualization */}
      {budget && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Budget Usage</span>
            <span>
              {formatCost(cost.total)} / {formatCost(budget)} ({budgetPercentage.toFixed(1)}%)
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

      {/* Cost Breakdown */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-gray-900 mb-2">Cost Breakdown</p>
        <div className="space-y-1">
          {cost.breakdown.ai && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">AI Processing</span>
              <span className="font-medium text-gray-900">
                {formatCost(cost.breakdown.ai.total)}
              </span>
            </div>
          )}
          {cost.breakdown.ai && (
            <>
              <div className="flex justify-between text-xs pl-3">
                <span className="text-gray-500">- Prompt</span>
                <span className="text-gray-600">{formatCost(cost.breakdown.ai.prompt)}</span>
              </div>
              <div className="flex justify-between text-xs pl-3">
                <span className="text-gray-500">- Completion</span>
                <span className="text-gray-600">{formatCost(cost.breakdown.ai.completion)}</span>
              </div>
            </>
          )}
          {cost.breakdown.embedding && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Embedding</span>
              <span className="font-medium text-gray-900">
                {formatCost(cost.breakdown.embedding)}
              </span>
            </div>
          )}
          {cost.breakdown.search && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Search</span>
              <span className="font-medium text-gray-900">
                {formatCost(cost.breakdown.search)}
              </span>
            </div>
          )}
          {cost.breakdown.storage && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Storage</span>
              <span className="font-medium text-gray-900">
                {formatCost(cost.breakdown.storage)}
              </span>
            </div>
          )}
          {cost.breakdown.other && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Other</span>
              <span className="font-medium text-gray-900">
                {formatCost(cost.breakdown.other)}
              </span>
            </div>
          )}
        </div>
      </div>

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
              Cost is critical ({budgetPercentage.toFixed(1)}% of budget used). Consider
              optimizing queries or reducing usage.
            </p>
          ) : (
            <p>
              Cost is high ({budgetPercentage.toFixed(1)}% of budget used). Monitor closely.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
