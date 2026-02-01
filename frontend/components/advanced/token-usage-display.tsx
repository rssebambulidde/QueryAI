'use client';

import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
  const { isMobile } = useMobile();
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
    <div className={cn(
      "bg-white border border-gray-200 rounded-lg space-y-3",
      isMobile ? "p-4" : "p-4"
    )}>
      <div className="flex items-center justify-between">
        <h3 className={cn(
          "font-semibold text-gray-900 flex items-center gap-2",
          isMobile ? "text-base" : "text-sm"
        )}>
          Token Usage
          {getTrend() && React.cloneElement(getTrend()!, {
            className: cn(isMobile ? "w-4 h-4" : "w-3 h-3")
          })}
        </h3>
        {alertLevel && showAlerts && (
          <div
            className={cn(
              "flex items-center gap-1",
              isMobile ? "text-sm" : "text-xs",
              alertLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'
            )}
          >
            <AlertTriangle className={cn(isMobile ? "w-4 h-4" : "w-3 h-3")} />
            {alertLevel === 'critical' ? 'Critical' : 'Warning'}
          </div>
        )}
      </div>

      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-1" : "grid-cols-3"
      )}>
        <div>
          <p className={cn(
            "text-gray-600 mb-1",
            isMobile ? "text-sm" : "text-xs"
          )}>
            Prompt Tokens
          </p>
          <p className={cn(
            "font-semibold text-gray-900",
            isMobile ? "text-xl" : "text-lg"
          )}>
            {tokenUsage.promptTokens.toLocaleString()}
          </p>
        </div>
        <div>
          <p className={cn(
            "text-gray-600 mb-1",
            isMobile ? "text-sm" : "text-xs"
          )}>
            Completion Tokens
          </p>
          <p className={cn(
            "font-semibold text-gray-900",
            isMobile ? "text-xl" : "text-lg"
          )}>
            {tokenUsage.completionTokens.toLocaleString()}
          </p>
        </div>
        <div>
          <p className={cn(
            "text-gray-600 mb-1",
            isMobile ? "text-sm" : "text-xs"
          )}>
            Total Tokens
          </p>
          <p className={cn(
            "font-semibold text-blue-600",
            isMobile ? "text-xl" : "text-lg"
          )}>
            {tokenUsage.totalTokens.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Budget Visualization */}
      {tokenUsage.budget && (
        <div>
          <div className={cn(
            "flex justify-between text-gray-600 mb-2",
            isMobile ? "text-sm" : "text-xs"
          )}>
            <span>Budget Usage</span>
            <span>
              {tokenUsage.totalTokens.toLocaleString()} / {tokenUsage.budget.toLocaleString()} (
              {budgetPercentage.toFixed(1)}%)
            </span>
          </div>
          <div className={cn(
            "w-full bg-gray-200 rounded-full",
            isMobile ? "h-3" : "h-2"
          )}>
            <div
              className={cn(
                "rounded-full transition-all",
                isMobile ? "h-3" : "h-2",
                budgetPercentage >= 90
                  ? 'bg-red-600'
                  : budgetPercentage >= 75
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              )}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Limit Visualization */}
      {tokenUsage.limit && !tokenUsage.budget && (
        <div>
          <div className={cn(
            "flex justify-between text-gray-600 mb-2",
            isMobile ? "text-sm" : "text-xs"
          )}>
            <span>Token Limit</span>
            <span>
              {tokenUsage.totalTokens.toLocaleString()} / {tokenUsage.limit.toLocaleString()} (
              {limitPercentage.toFixed(1)}%)
            </span>
          </div>
          <div className={cn(
            "w-full bg-gray-200 rounded-full",
            isMobile ? "h-3" : "h-2"
          )}>
            <div
              className={cn(
                "rounded-full transition-all",
                isMobile ? "h-3" : "h-2",
                limitPercentage >= 90
                  ? 'bg-red-600'
                  : limitPercentage >= 75
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              )}
              style={{ width: `${Math.min(limitPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Alerts */}
      {showAlerts && alertLevel && (
        <div
          className={cn(
            "p-3 rounded border",
            isMobile ? "text-sm" : "text-xs",
            alertLevel === 'critical'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-yellow-50 text-yellow-800 border-yellow-200'
          )}
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
