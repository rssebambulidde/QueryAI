'use client';

import React from 'react';
import { FileText, FileCheck, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIActionButtonsProps {
  onSummarize: () => void;
  onWriteEssay: () => void;
  onDetailedReport: () => void;
  isLoading?: boolean;
  className?: string;
}

export const AIActionButtons: React.FC<AIActionButtonsProps> = ({
  onSummarize,
  onWriteEssay,
  onDetailedReport,
  isLoading = false,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2 mt-4 pt-3 border-t border-gray-200', className)}>
      <span className="text-xs font-medium text-gray-600 mr-2">Actions:</span>
      <Button
        size="sm"
        variant="outline"
        onClick={onSummarize}
        disabled={isLoading}
        className="h-8 text-xs px-3"
      >
        <FileText className="w-3 h-3 mr-1.5" />
        Summarize
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onWriteEssay}
        disabled={isLoading}
        className="h-8 text-xs px-3"
      >
        <FileCheck className="w-3 h-3 mr-1.5" />
        Write Essay
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDetailedReport}
        disabled={isLoading}
        className="h-8 text-xs px-3"
      >
        <FileBarChart className="w-3 h-3 mr-1.5" />
        Detailed Report
      </Button>
    </div>
  );
};
