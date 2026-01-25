'use client';

import React from 'react';
import { FileText, FileCheck, FileBarChart, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIActionButtonsProps {
  onSummarize: () => void;
  onWriteEssay: () => void;
  onDetailedReport: () => void;
  onExport: () => void;
  isLoading?: boolean;
  className?: string;
}

export const AIActionButtons: React.FC<AIActionButtonsProps> = ({
  onSummarize,
  onWriteEssay,
  onDetailedReport,
  onExport,
  isLoading = false,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2 mt-4 pt-3 border-t border-gray-200', className)}>
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
      <Button
        size="sm"
        variant="outline"
        onClick={onExport}
        disabled={isLoading}
        className="h-8 text-xs px-3"
        aria-label="Export as PDF"
      >
        <FileDown className="w-3 h-3 mr-1.5" />
        Export PDF
      </Button>
    </div>
  );
};
