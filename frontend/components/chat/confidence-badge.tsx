'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

function getLevel(score: number) {
  if (score >= 0.8) return { label: 'High confidence', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' };
  if (score >= 0.5) return { label: 'Medium confidence', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' };
  return { label: 'Low confidence', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' };
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ score, className }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const { label, color, dot } = getLevel(score);

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium leading-tight transition-colors',
          color,
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip((v) => !v)}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
        {label}
      </button>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50">
          <div className="font-medium mb-0.5">Quality score: {Math.round(score * 100)}%</div>
          <div className="text-gray-300 text-[10px]">Based on length, citations, structure, and formatting</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};
