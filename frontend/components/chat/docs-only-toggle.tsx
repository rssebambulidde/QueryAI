'use client';

import React from 'react';
import { FileText, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocsOnlyToggleProps {
  docsOnly: boolean;
  onToggle: (docsOnly: boolean) => void;
  disabled?: boolean;
  processedCount?: number;
  className?: string;
}

export const DocsOnlyToggle: React.FC<DocsOnlyToggleProps> = ({
  docsOnly,
  onToggle,
  disabled = false,
  processedCount = 0,
  className,
}) => {
  const noDocuments = processedCount === 0;
  
  const tooltipText = noDocuments 
    ? 'Upload documents to enable docs-only mode'
    : docsOnly 
    ? `Only searching your ${processedCount} document${processedCount !== 1 ? 's' : ''}`
    : 'Including web search with documents';

  return (
    <button
      type="button"
      onClick={() => !disabled && !noDocuments && onToggle(!docsOnly)}
      disabled={disabled || noDocuments}
      title={tooltipText}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        docsOnly
          ? 'bg-blue-100 text-blue-700 border border-blue-300 focus:ring-blue-400'
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 focus:ring-gray-400',
        (disabled || noDocuments) && 'opacity-50 cursor-not-allowed',
        className
      )}
      aria-pressed={docsOnly}
      aria-label={docsOnly ? 'Documents only - click to include web' : 'Including web - click for documents only'}
    >
      {docsOnly ? (
        <>
          <FileText className="w-3.5 h-3.5" />
          <span>Docs only</span>
        </>
      ) : (
        <>
          <Globe className="w-3.5 h-3.5" />
          <span>+ Web</span>
        </>
      )}
    </button>
  );
};
