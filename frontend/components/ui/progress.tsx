'use client';

import * as React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
}

export function Progress({ value, max = 100, className = '', ...props }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={`w-full bg-gray-200 rounded-full overflow-hidden ${className}`}
      {...props}
    >
      <div
        className="h-full transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
