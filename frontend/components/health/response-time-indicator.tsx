'use client';

import React from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ResponseTimeIndicatorProps {
  responseTime: number; // in milliseconds
  previousResponseTime?: number;
  showTrend?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ResponseTimeIndicator: React.FC<ResponseTimeIndicatorProps> = ({
  responseTime,
  previousResponseTime,
  showTrend = true,
  size = 'sm',
}) => {
  const getColor = (time: number) => {
    if (time < 500) return 'text-green-600';
    if (time < 1000) return 'text-yellow-600';
    if (time < 2000) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTrend = () => {
    if (!previousResponseTime || !showTrend) return null;
    const diff = responseTime - previousResponseTime;
    const percentChange = (diff / previousResponseTime) * 100;

    if (Math.abs(percentChange) < 5) return null; // Less than 5% change, no trend

    if (diff < 0) {
      return <TrendingDown className="w-3 h-3 text-green-600" />;
    } else {
      return <TrendingUp className="w-3 h-3 text-red-600" />;
    }
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={`flex items-center gap-1 ${sizeClasses[size]}`}>
      <Clock className={`${iconSizes[size]} ${getColor(responseTime)}`} />
      <span className={`font-medium ${getColor(responseTime)}`}>
        {responseTime.toFixed(0)}ms
      </span>
      {getTrend()}
    </div>
  );
};
