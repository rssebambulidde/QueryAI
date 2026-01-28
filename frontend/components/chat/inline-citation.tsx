'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Source } from '@/lib/api';
import { ExternalLink, FileText, Download, ChevronDown, ChevronUp, X, Globe, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { documentApi } from '@/lib/api';

export interface CitationMatch {
  type: 'web' | 'document';
  number: number;
  index: number;
  sourceIndex: number;
  fullMatch: string;
}

interface InlineCitationProps {
  source: Source;
  citationNumber: number;
  totalCitations: number;
  className?: string;
  onExpand?: (source: Source) => void;
  isExpanded?: boolean;
}

export const InlineCitation: React.FC<InlineCitationProps> = ({
  source,
  citationNumber,
  totalCitations,
  className,
  onExpand,
  isExpanded = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDocument = source.type === 'document';
  const isWeb = source.type === 'web';

  // Handle tooltip positioning and visibility
  useEffect(() => {
    if (isHovered) {
      timeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 300); // Small delay before showing tooltip
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setShowTooltip(false);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isHovered]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onExpand) {
      onExpand(source);
    } else {
      setShowDetails(!showDetails);
    }
  };

  const handleDocumentClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (source.documentId) {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        
        const response = await fetch(`${API_URL}/api/documents/${source.documentId}/download`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = source.title || 'document';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } else if (source.url) {
          window.open(source.url, '_blank');
        }
      } catch (error) {
        console.error('Failed to download document:', error);
        if (source.url) {
          window.open(source.url, '_blank');
        }
      }
    } else if (source.url) {
      window.open(source.url, '_blank');
    }
  };

  const handleWebClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (source.url) {
      window.open(source.url, '_blank');
    }
  };

  const getSourcePreview = () => {
    if (source.snippet) {
      return source.snippet.length > 200 
        ? source.snippet.substring(0, 200) + '...' 
        : source.snippet;
    }
    if (source.title) {
      return source.title;
    }
    return 'No preview available';
  };

  const getSourceDomain = () => {
    if (source.url) {
      try {
        const url = new URL(source.url);
        return url.hostname.replace('www.', '');
      } catch {
        return null;
      }
    }
    return null;
  };

  return (
    <span
      className={cn('relative inline-flex items-baseline', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Citation Number Badge */}
      <button
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-[11px] font-semibold',
          'transition-all duration-200 cursor-pointer select-none',
          'hover:scale-110 active:scale-95',
          isDocument
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
            : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300',
          (isExpanded || showDetails) && 'ring-2 ring-offset-1',
          isDocument && (isExpanded || showDetails) && 'ring-blue-400',
          !isDocument && (isExpanded || showDetails) && 'ring-green-400'
        )}
        title={`${isDocument ? 'Document' : 'Web'} source ${citationNumber || ''}`}
        aria-label={`Citation ${citationNumber || ''}: ${source.title || 'Source'}`}
      >
        {isDocument ? (
          <File className="w-2.5 h-2.5" />
        ) : (
          <Globe className="w-2.5 h-2.5" />
        )}
        {citationNumber > 0 && <span className="ml-0.5">{citationNumber}</span>}
      </button>

      {/* Hover Tooltip */}
      {showTooltip && !showDetails && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50',
            'w-80 max-w-[90vw] p-3 rounded-lg shadow-xl border',
            'bg-white text-gray-900',
            'animate-in fade-in slide-in-from-bottom-2 duration-200'
          )}
          style={{ pointerEvents: 'none' }}
        >
          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-white border-r border-b border-gray-200 transform rotate-45"></div>
          </div>

          {/* Source Type Badge */}
          <div className="flex items-center gap-2 mb-2">
            {isDocument ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <FileText className="w-3 h-3" />
                Document
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <Globe className="w-3 h-3" />
                Web Source
              </span>
            )}
            {source.score && (
              <span className="text-xs text-gray-500">
                Relevance: {(source.score * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Source Title */}
          <h4 className="font-semibold text-sm mb-1.5 line-clamp-2 text-gray-900">
            {source.title || `Source ${citationNumber}`}
          </h4>

          {/* Source Preview/Snippet */}
          <p className="text-xs text-gray-600 mb-2 line-clamp-3">
            {getSourcePreview()}
          </p>

          {/* Source URL/Domain */}
          {isWeb && source.url && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{getSourceDomain() || source.url}</span>
            </div>
          )}

          {/* Action Hints */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Click to view details
            </span>
            {isDocument && source.documentId && (
              <button
                onClick={handleDocumentClick}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                title="Download document"
              >
                <Download className="w-3 h-3" />
              </button>
            )}
            {isWeb && source.url && (
              <button
                onClick={handleWebClick}
                className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                title="Open in new tab"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expanded Details Panel */}
      {showDetails && (
        <div
          className={cn(
            'absolute bottom-full left-0 mb-2 z-50',
            'w-96 max-w-[90vw] p-4 rounded-lg shadow-xl border',
            'bg-white text-gray-900',
            'animate-in fade-in slide-in-from-bottom-2 duration-200'
          )}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(false);
            }}
            className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3 mb-3 pr-6">
            {isDocument ? (
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm text-gray-900 truncate">
                  {source.title || `Source ${citationNumber}`}
                </h3>
                {source.score && (
                  <span className="text-xs text-gray-500">
                    {(source.score * 100).toFixed(0)}% relevant
                  </span>
                )}
              </div>
              {isWeb && getSourceDomain() && (
                <p className="text-xs text-gray-500 truncate">
                  {getSourceDomain()}
                </p>
              )}
            </div>
          </div>

          {/* Full Snippet */}
          {source.snippet && (
            <div className="mb-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                {source.snippet}
              </p>
            </div>
          )}

          {/* URL */}
          {source.url && (
            <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-2">
                {isWeb ? (
                  <ExternalLink className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                )}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-700 hover:text-gray-900 truncate flex-1"
                  onClick={(e) => {
                    if (isDocument) {
                      e.preventDefault();
                      handleDocumentClick(e);
                    }
                  }}
                >
                  {source.url}
                </a>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
            {isDocument && source.documentId ? (
              <button
                onClick={handleDocumentClick}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Document
              </button>
            ) : isWeb && source.url ? (
              <button
                onClick={handleWebClick}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Source
              </button>
            ) : null}
          </div>
        </div>
      )}
    </span>
  );
};
