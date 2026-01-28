'use client';

import React, { useState, useMemo } from 'react';
import { Source } from '@/lib/api';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Globe, 
  ExternalLink, 
  Download, 
  Filter,
  X,
  Download as DownloadIcon,
  FileDown,
  Grid,
  List
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { documentApi } from '@/lib/api';
import { SourceMetadataCard } from './source-metadata-card';

export type SourceFilter = 'all' | 'document' | 'web';
export type SourceViewMode = 'list' | 'cards';

interface SourcePanelProps {
  sources?: Source[];
  isOpen?: boolean;
  onToggle?: () => void;
  onSourceClick?: (source: Source) => void;
  className?: string;
  viewMode?: SourceViewMode;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sources = [],
  isOpen = false,
  onToggle,
  onSourceClick,
  className,
  viewMode: initialViewMode = 'list',
}) => {
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SourceViewMode>(initialViewMode);

  // Filter sources
  const filteredSources = useMemo(() => {
    if (filter === 'all') return sources;
    return sources.filter(s => s.type === filter);
  }, [sources, filter]);

  // Sort by relevance score (if available)
  const sortedSources = useMemo(() => {
    return [...filteredSources].sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      return scoreB - scoreA; // Descending order
    });
  }, [filteredSources]);

  const documentCount = sources.filter(s => s.type === 'document').length;
  const webCount = sources.filter(s => s.type === 'web').length;

  const handleSourceClick = (source: Source) => {
    if (onSourceClick) {
      onSourceClick(source);
    } else {
      // Default behavior
      if (source.type === 'document' && source.documentId) {
        handleDocumentDownload(source);
      } else if (source.url) {
        window.open(source.url, '_blank');
      }
    }
  };

  const handleDocumentDownload = async (source: Source) => {
    if (!source.documentId) return;
    
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
  };

  const handleExportSources = (format: 'json' | 'csv' | 'markdown' = 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'json') {
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalSources: sources.length,
        sources: sources.map(s => ({
          type: s.type,
          title: s.title,
          url: s.url,
          snippet: s.snippet,
          score: s.score,
          documentId: s.documentId,
        })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sources-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = ['Type', 'Title', 'URL', 'Snippet', 'Score'];
      const rows = sources.map(s => [
        s.type,
        s.title || '',
        s.url || '',
        (s.snippet || '').replace(/"/g, '""'), // Escape quotes
        s.score !== undefined ? (s.score * 100).toFixed(1) : '',
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sources-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else if (format === 'markdown') {
      const markdownContent = [
        `# Sources Export`,
        `\nExported: ${new Date().toLocaleString()}`,
        `Total Sources: ${sources.length}\n`,
        ...sources.map((s, idx) => [
          `## ${idx + 1}. ${s.title || `Source ${idx + 1}`}`,
          `- **Type:** ${s.type === 'document' ? 'Document' : 'Web Source'}`,
          s.url ? `- **URL:** ${s.url}` : '',
          s.score !== undefined ? `- **Relevance:** ${(s.score * 100).toFixed(1)}%` : '',
          s.snippet ? `- **Preview:** ${s.snippet}` : '',
          '',
        ].filter(Boolean).join('\n'))
      ].join('\n');
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sources-${timestamp}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

  const getSourceDomain = (url?: string) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return null;
    }
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className={cn('border-t border-gray-200 bg-white', className)}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="font-semibold text-sm text-gray-900">
            Sources ({sources.length})
          </span>
        </div>
        {isOpen && (
          <div className="flex items-center gap-1">
            <div className="relative group">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportSources('json');
                }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                title="Export sources (JSON)"
              >
                <DownloadIcon className="w-4 h-4" />
              </button>
              {/* Export menu - could be expanded later */}
            </div>
          </div>
        )}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-gray-200">
          {/* Filters and View Toggle */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-500" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFilter('all')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                      filter === 'all'
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    All ({sources.length})
                  </button>
                  <button
                    onClick={() => setFilter('document')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                      filter === 'document'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <FileText className="w-3 h-3 inline mr-1" />
                    Docs ({documentCount})
                  </button>
                  <button
                    onClick={() => setFilter('web')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                      filter === 'web'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Globe className="w-3 h-3 inline mr-1" />
                    Web ({webCount})
                  </button>
                </div>
              </div>
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 border-l border-gray-300 pl-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    viewMode === 'list'
                      ? 'bg-gray-200 text-gray-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    viewMode === 'cards'
                      ? 'bg-gray-200 text-gray-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                  title="Card view"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Source List/Cards */}
          <div className="max-h-[400px] overflow-y-auto">
            {sortedSources.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No sources found for this filter
              </div>
            ) : viewMode === 'cards' ? (
              // Card View
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedSources.map((source, index) => (
                  <SourceMetadataCard
                    key={`${source.type}-${index}`}
                    source={source}
                    index={index}
                    showFullSnippet={true}
                    onSourceClick={onSourceClick || handleSourceClick}
                    onDownload={handleDocumentDownload}
                  />
                ))}
              </div>
            ) : (
              // List View (existing)
              <div className="divide-y divide-gray-100">
                {sortedSources.map((source, index) => {
                  const isExpanded = expandedSource === `${source.type}-${index}`;
                  const domain = getSourceDomain(source.url);
                  
                  return (
                    <div
                      key={`${source.type}-${index}`}
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
                            source.type === 'document'
                              ? 'bg-blue-100'
                              : 'bg-green-100'
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
                              onClick={() => handleSourceClick(source)}
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

                          {/* Domain/URL */}
                          {domain && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-xs text-gray-500 truncate">
                                {domain}
                              </span>
                            </div>
                          )}

                          {/* Snippet Preview */}
                          {source.snippet && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {source.snippet}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => {
                                const key = `${source.type}-${index}`;
                                setExpandedSource(isExpanded ? null : key);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDocumentDownload(source);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                title="Download document"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </button>
                            ) : source.url ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(source.url, '_blank');
                                }}
                                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                          {/* Full Snippet */}
                          {source.snippet && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-1">Preview:</p>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {source.snippet}
                              </p>
                            </div>
                          )}

                          {/* Full URL */}
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

                          {/* Metadata */}
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
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
