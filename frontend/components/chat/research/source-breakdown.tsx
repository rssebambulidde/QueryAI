'use client';

import React from 'react';
import { FileText, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Source } from '@/lib/api';

interface SourceBreakdownProps {
  sources: Source[];
  className?: string;
}

export const SourceBreakdown: React.FC<SourceBreakdownProps> = ({
  sources,
  className,
}) => {
  if (!sources || sources.length === 0) return null;

  const documentSources = sources.filter((s) => s.type === 'document');
  const webSources = sources.filter((s) => s.type === 'web');

  return (
    <div className={cn('flex items-center gap-3 text-xs text-gray-500', className)}>
      {documentSources.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded-md border border-orange-100">
          <FileText className="w-3 h-3 text-orange-500" />
          <span className="text-orange-700">
            {documentSources.length} document{documentSources.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {webSources.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-md border border-blue-100">
          <Globe className="w-3 h-3 text-blue-500" />
          <span className="text-blue-700">
            {webSources.length} web source{webSources.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};

interface RelevanceBarProps {
  score: number;
  className?: string;
}

export const RelevanceBar: React.FC<RelevanceBarProps> = ({
  score,
  className,
}) => {
  const percentage = Math.round(score * 100);
  
  const getColor = () => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[60px]">
        <div
          className={cn('h-full rounded-full transition-all', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{percentage}%</span>
    </div>
  );
};

interface DocumentSourceBadgeProps {
  source: Source;
  onClick?: () => void;
  className?: string;
}

export const DocumentSourceBadge: React.FC<DocumentSourceBadgeProps> = ({
  source,
  onClick,
  className,
}) => {
  const isDocument = source.type === 'document';
  const Icon = isDocument ? FileText : Globe;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors',
        isDocument
          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        className
      )}
      title={source.title}
    >
      <Icon className="w-3 h-3" />
      <span className="max-w-[100px] truncate">{source.title}</span>
    </button>
  );
};
