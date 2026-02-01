'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  count?: number;
}

export const ConversationSkeleton: React.FC<SkeletonLoaderProps> = ({ className, count = 3 }) => {
  return (
    <div className={cn('space-y-2 px-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const CollectionSkeleton: React.FC<SkeletonLoaderProps> = ({ className, count = 3 }) => {
  return (
    <div className={cn('space-y-2 px-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-5 h-5 rounded bg-gray-200 flex-shrink-0" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
};
