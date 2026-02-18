'use client';

import React from 'react';
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStatusBadgeProps {
  totalCount: number;
  processedCount: number;
  processingCount: number;
  className?: string;
}

export const ProcessingStatusBadge: React.FC<ProcessingStatusBadgeProps> = ({
  totalCount,
  processedCount,
  processingCount,
  className,
}) => {
  if (totalCount === 0) return null;

  const isAllProcessed = processingCount === 0 && processedCount > 0;

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
      isAllProcessed
        ? 'bg-green-50 text-green-700 border border-green-200'
        : processingCount > 0
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-gray-50 text-gray-600 border border-gray-200',
      className
    )}>
      {processingCount > 0 ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>
            {processingCount} processing
            {processedCount > 0 && ` • ${processedCount} ready`}
          </span>
        </>
      ) : isAllProcessed ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{processedCount} document{processedCount !== 1 ? 's' : ''} searchable</span>
        </>
      ) : (
        <>
          <FileText className="w-3.5 h-3.5" />
          <span>{totalCount} document{totalCount !== 1 ? 's' : ''}</span>
        </>
      )}
    </div>
  );
};
