'use client';

import React from 'react';
import { Source } from '@/lib/api';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Globe,
  ExternalLink,
  Download,
  Eye,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextPreview {
  text: string;
  loading: boolean;
  error?: string;
}

interface SourceListItemProps {
  source: Source;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (key: string) => void;
  onSourceClick: (source: Source) => void;
  onDocumentDownload: (source: Source) => void;
  textPreview?: TextPreview;
  onLoadTextPreview: (documentId: string) => void;
}

export const SourceListItem: React.FC<SourceListItemProps> = ({
  source,
  index,
  isExpanded,
  onToggleExpand,
  onSourceClick,
  onDocumentDownload,
  textPreview,
  onLoadTextPreview,
}) => {
  const key = `${source.type}-${index}`;
  const domain = getDomain(source.url);

  return (
    <div
      className={cn(
        'px-4 py-3 hover:bg-gray-50 transition-colors',
        isExpanded && 'bg-gray-50'
      )}
    >
      {/* Source Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
            source.type === 'document' ? 'bg-blue-100' : 'bg-green-100'
          )}
        >
          {source.type === 'document' ? (
            <FileText className="w-4 h-4 text-blue-600" />
          ) : (
            <Globe className="w-4 h-4 text-green-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Score */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4
              className="font-medium text-sm text-gray-900 line-clamp-2 cursor-pointer hover:text-orange-600 transition-colors"
              onClick={() => onSourceClick(source)}
            >
              {source.title || `Source ${index + 1}`}
            </h4>
            {source.score !== undefined && (
              <div className="flex-shrink-0">
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-medium',
                    source.score >= 0.8
                      ? 'bg-green-100 text-green-700'
                      : source.score >= 0.6
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {(source.score * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Domain */}
          {domain && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs text-gray-500 truncate">{domain}</span>
            </div>
          )}

          {/* Snippet */}
          {source.snippet && (
            <div className="mb-2">
              <p className="text-xs text-gray-600 line-clamp-2">{source.snippet}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onToggleExpand(key)}
              className="text-sm sm:text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 touch-manipulation min-h-[44px] sm:min-h-0 px-2 py-1 rounded-lg hover:bg-gray-100"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Less
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  More
                </>
              )}
            </button>
            {source.type === 'document' && source.documentId ? (
              <button
                onClick={(e) => { e.stopPropagation(); onDocumentDownload(source); }}
                className="text-sm sm:text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5 touch-manipulation min-h-[44px] sm:min-h-0 px-2 py-1 rounded-lg hover:bg-blue-50"
                title="Download document"
              >
                <Download className="w-4 h-4 sm:w-3 sm:h-3" />
                Download
              </button>
            ) : source.url ? (
              <button
                onClick={(e) => { e.stopPropagation(); window.open(source.url, '_blank'); }}
                className="text-sm sm:text-xs text-green-600 hover:text-green-700 flex items-center gap-1.5 touch-manipulation min-h-[44px] sm:min-h-0 px-2 py-1 rounded-lg hover:bg-green-50"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4 sm:w-3 sm:h-3" />
                Open
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          {source.snippet && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Relevant excerpt:</p>
              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded p-2 border border-gray-100">
                {source.snippet}
              </p>
            </div>
          )}

          {/* Document Text Preview */}
          {source.type === 'document' && source.documentId && (
            <div>
              {!textPreview?.text && !textPreview?.loading && (
                <button
                  onClick={() => onLoadTextPreview(source.documentId!)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  Show document preview
                </button>
              )}
              {textPreview?.loading && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 px-2 py-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading preview...
                </div>
              )}
              {textPreview?.text && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Document preview:</p>
                  <p className="text-xs text-gray-600 leading-relaxed bg-blue-50/50 rounded p-2 border border-blue-100 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {textPreview.text}
                  </p>
                </div>
              )}
              {textPreview?.error && (
                <p className="text-xs text-gray-400 px-2 py-1">{textPreview.error}</p>
              )}
            </div>
          )}

          {source.url && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">URL:</p>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-600 hover:text-orange-700 break-all"
              >
                {source.url}
              </a>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Type: {source.type === 'document' ? 'Document' : 'Web Source'}</span>
            {source.score !== undefined && (
              <span>Relevance: {(source.score * 100).toFixed(1)}%</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDomain(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}
