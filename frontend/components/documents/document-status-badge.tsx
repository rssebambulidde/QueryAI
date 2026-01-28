'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle, File, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentItem } from '@/lib/api';

interface DocumentStatusBadgeProps {
  document: DocumentItem;
  onRefresh?: () => void;
  className?: string;
  showProgress?: boolean;
}

export const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({
  document,
  onRefresh,
  className,
  showProgress = false,
}) => {
  const status = document.status || 'stored';
  const isProcessing = status === 'processing' || status === 'embedding';
  const isFailed = status === 'failed' || status === 'embedding_failed';
  const isCompleted = status === 'processed' || status === 'extracted' || status === 'embedded';

  const getStatusConfig = () => {
    switch (status) {
      case 'processed':
        return {
          label: 'Processed',
          icon: CheckCircle2,
          className: 'bg-green-100 text-green-700 border-green-200',
          iconClassName: 'text-green-600',
        };
      case 'extracted':
        return {
          label: 'Extracted',
          icon: CheckCircle2,
          className: 'bg-orange-100 text-orange-700 border-orange-200',
          iconClassName: 'text-orange-600',
        };
      case 'embedding':
        return {
          label: 'Chunking...',
          icon: Clock,
          className: 'bg-purple-100 text-purple-700 border-purple-200',
          iconClassName: 'text-purple-600 animate-spin',
        };
      case 'embedded':
        return {
          label: 'Embedded',
          icon: CheckCircle2,
          className: 'bg-green-100 text-green-700 border-green-200',
          iconClassName: 'text-green-600',
        };
      case 'stored':
        return {
          label: 'Stored',
          icon: File,
          className: 'bg-gray-100 text-gray-700 border-gray-200',
          iconClassName: 'text-gray-600',
        };
      case 'processing':
        return {
          label: 'Processing...',
          icon: Clock,
          className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          iconClassName: 'text-yellow-600 animate-spin',
        };
      case 'failed':
        return {
          label: 'Failed',
          icon: AlertCircle,
          className: 'bg-red-100 text-red-700 border-red-200',
          iconClassName: 'text-red-600',
        };
      case 'embedding_failed':
        return {
          label: 'Embedding Failed',
          icon: AlertCircle,
          className: 'bg-red-100 text-red-700 border-red-200',
          iconClassName: 'text-red-600',
        };
      default:
        return {
          label: 'Unknown',
          icon: File,
          className: 'bg-gray-100 text-gray-700 border-gray-200',
          iconClassName: 'text-gray-600',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
          config.className
        )}
      >
        <Icon className={cn('w-3 h-3', config.iconClassName)} />
        {config.label}
      </span>

      {/* Error Message */}
      {isFailed && (
        <span className="text-xs text-red-600 truncate max-w-xs" title={document.extractionError || document.embeddingError}>
          {document.extractionError || document.embeddingError || 'Error occurred'}
        </span>
      )}

      {/* Progress Indicator */}
      {showProgress && isProcessing && (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-orange-600 animate-pulse" style={{ width: '60%' }} />
          </div>
          <span className="text-xs text-gray-500">Processing...</span>
        </div>
      )}

      {/* Refresh Button */}
      {onRefresh && (isProcessing || isFailed) && (
        <button
          onClick={onRefresh}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isProcessing && 'animate-spin')} />
        </button>
      )}
    </div>
  );
};
