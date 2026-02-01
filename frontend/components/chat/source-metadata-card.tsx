'use client';

import React from 'react';
import { Source } from '@/lib/api';
import { FileText, Globe, ExternalLink, Download, Calendar, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceMetadataCardProps {
  source: Source;
  index?: number;
  className?: string;
  showFullSnippet?: boolean;
  onSourceClick?: (source: Source) => void;
  onDownload?: (source: Source) => void;
}

export const SourceMetadataCard: React.FC<SourceMetadataCardProps> = ({
  source,
  index,
  className,
  showFullSnippet = false,
  onSourceClick,
  onDownload,
}) => {
  const isDocument = source.type === 'document';
  const isWeb = source.type === 'web';

  const getSourceDomain = () => {
    if (!source.url) return null;
    try {
      const url = new URL(source.url);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  const getRelevanceColor = (score?: number) => {
    if (score === undefined) return 'gray';
    if (score >= 0.8) return 'green';
    if (score >= 0.6) return 'yellow';
    return 'gray';
  };

  const getRelevanceLabel = (score?: number) => {
    if (score === undefined) return 'N/A';
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  const relevanceScore = source.score;
  const relevanceColor = getRelevanceColor(relevanceScore);
  const relevanceLabel = getRelevanceLabel(relevanceScore);
  const domain = getSourceDomain();
  const timestamp = formatTimestamp((source as any).created_at || (source as any).timestamp);

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Type Badge and Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {/* Source Type Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold',
                isDocument
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              )}
            >
              {isDocument ? (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Document
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Web Source
                </>
              )}
            </span>

            {/* Index Badge (if provided) */}
            {index !== undefined && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                {index + 1}
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className={cn(
              'font-semibold text-base text-gray-900 mb-1 line-clamp-2',
              onSourceClick && 'cursor-pointer hover:text-orange-600 transition-colors'
            )}
            onClick={() => onSourceClick && onSourceClick(source)}
            title={source.title || `Source ${index !== undefined ? index + 1 : ''}`}
          >
            {source.title || `Source ${index !== undefined ? index + 1 : ''}`}
          </h3>
        </div>

        {/* Relevance Score */}
        {relevanceScore !== undefined && (
          <div className="flex-shrink-0">
            <div className="flex flex-col items-end gap-1">
              {/* Score Percentage */}
              <div
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-bold',
                  relevanceColor === 'green' && 'bg-green-100 text-green-700',
                  relevanceColor === 'yellow' && 'bg-yellow-100 text-yellow-700',
                  relevanceColor === 'gray' && 'bg-gray-100 text-gray-600'
                )}
              >
                {(relevanceScore * 100).toFixed(0)}%
              </div>
              {/* Relevance Label */}
              <span className="text-xs text-gray-500">{relevanceLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Relevance Visual Indicator */}
      {relevanceScore !== undefined && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  relevanceColor === 'green' && 'bg-green-500',
                  relevanceColor === 'yellow' && 'bg-yellow-500',
                  relevanceColor === 'gray' && 'bg-gray-400'
                )}
                style={{ width: `${relevanceScore * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 min-w-[35px] text-right">
              {(relevanceScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* URL/Domain */}
      {(source.url || domain) && (
        <div className="mb-3 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {domain ? (
              <span className="text-sm text-gray-600 truncate" title={source.url}>
                {domain}
              </span>
            ) : (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-600 hover:text-orange-700 truncate block"
                title={source.url}
              >
                {source.url}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Document ID (if available) */}
      {source.documentId && (
        <div className="mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 font-mono truncate" title={source.documentId}>
            ID: {source.documentId}
          </span>
        </div>
      )}

      {/* Snippet/Preview */}
      {source.snippet && (
        <div className="mb-3">
          <p
            className={cn(
              'text-sm text-gray-700 leading-relaxed',
              showFullSnippet ? '' : 'line-clamp-3'
            )}
          >
            {source.snippet}
          </p>
        </div>
      )}

      {/* Timestamp */}
      {timestamp && (
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">{timestamp}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        {isDocument && source.documentId ? (
          <button
            onClick={() => onDownload && onDownload(source)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        ) : source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Source
          </a>
        ) : null}
      </div>
    </div>
  );
};
