'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Source, documentApi } from '@/lib/api';
import {
  FileText,
  Globe,
  ExternalLink,
  Download,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadDocument } from '@/lib/utils/download-document';
import { useMobile } from '@/lib/hooks/use-mobile';
import { SourcePanelHeader, SourcePanelFilters } from './source-panel-header';
import { SourceListItem } from './source-panel-list';

export type SourceFilter = 'all' | 'document' | 'web';
export type SourceViewMode = 'list';

interface SourcePanelProps {
  sources?: Source[];
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  title?: string;
  variant?: 'inline' | 'sidebar';
  onSourceClick?: (source: Source) => void;
  className?: string;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sources = [],
  isOpen = false,
  onToggle,
  onClose,
  title,
  variant = 'inline',
  onSourceClick,
  className,
}) => {
  const { isMobile } = useMobile();
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [textPreviews, setTextPreviews] = useState<Record<string, { text: string; loading: boolean; error?: string }>>({});

  const loadTextPreview = useCallback(async (documentId: string) => {
    if (textPreviews[documentId]?.text || textPreviews[documentId]?.loading) return;
    setTextPreviews((prev) => ({ ...prev, [documentId]: { text: '', loading: true } }));
    try {
      const response = await documentApi.getText(documentId);
      if (response.success && response.data) {
        const preview = response.data.text.slice(0, 500) + (response.data.text.length > 500 ? '...' : '');
        setTextPreviews((prev) => ({ ...prev, [documentId]: { text: preview, loading: false } }));
      } else {
        setTextPreviews((prev) => ({ ...prev, [documentId]: { text: '', loading: false, error: 'Text not available' } }));
      }
    } catch {
      setTextPreviews((prev) => ({ ...prev, [documentId]: { text: '', loading: false, error: 'Failed to load preview' } }));
    }
  }, [textPreviews]);

  // ── Derived data ────────────────────────────────────────────────────────

  const filteredSources = useMemo(() => {
    if (filter === 'all') return sources;
    return sources.filter((s) => s.type === filter);
  }, [sources, filter]);

  const sortedSources = useMemo(
    () => [...filteredSources].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [filteredSources],
  );

  const sortedForSidebar = useMemo(
    () => [...sources].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [sources],
  );

  const documentCount = sources.filter((s) => s.type === 'document').length;
  const webCount = sources.filter((s) => s.type === 'web').length;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSourceClick = (source: Source) => {
    if (onSourceClick) {
      onSourceClick(source);
    } else if (source.type === 'document' && source.documentId) {
      handleDocumentDownload(source);
    } else if (source.url) {
      window.open(source.url, '_blank');
    }
  };

  const handleDocumentDownload = async (source: Source) => {
    if (!source.documentId) return;
    await downloadDocument(source.documentId, source.title || 'document', source.url);
  };

  const handleExportSources = (format: 'json' | 'csv' | 'markdown' = 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const exportData = sources.map((s) => ({
      type: s.type, title: s.title, url: s.url, snippet: s.snippet, score: s.score, documentId: s.documentId,
    }));

    let blob: Blob;
    let ext: string;

    if (format === 'csv') {
      const rows = exportData.map((s) => [s.type, s.title || '', s.url || '', (s.snippet || '').replace(/"/g, '""'), s.score !== undefined ? (s.score * 100).toFixed(1) : '']);
      const csv = ['Type,Title,URL,Snippet,Score', ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
      blob = new Blob([csv], { type: 'text/csv' });
      ext = 'csv';
    } else if (format === 'markdown') {
      const md = [`# Sources Export\n\nExported: ${new Date().toLocaleString()}\nTotal Sources: ${sources.length}\n`,
        ...exportData.map((s, i) => [`## ${i + 1}. ${s.title || `Source ${i + 1}`}`, `- **Type:** ${s.type === 'document' ? 'Document' : 'Web Source'}`, s.url ? `- **URL:** ${s.url}` : '', s.score !== undefined ? `- **Relevance:** ${(s.score * 100).toFixed(1)}%` : '', s.snippet ? `- **Preview:** ${s.snippet}` : '', ''].filter(Boolean).join('\n'))].join('\n');
      blob = new Blob([md], { type: 'text/markdown' });
      ext = 'md';
    } else {
      blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), totalSources: sources.length, sources: exportData }, null, 2)], { type: 'application/json' });
      ext = 'json';
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sources-${timestamp}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getSourceDomain = (url?: string) => {
    if (!url) return null;
    try { return new URL(url).hostname.replace('www.', ''); } catch { return null; }
  };

  // ── Early exit ──────────────────────────────────────────────────────────

  if (sources.length === 0) return null;

  // ══════════════════════════════════════════════════════════════════════════
  // Sidebar variant
  // ══════════════════════════════════════════════════════════════════════════

  if (variant === 'sidebar') {
    const displayTitle = title?.trim() ? title.trim() : 'this response';
    const headerLabel = displayTitle.length > 40 ? `Sources for ${displayTitle.slice(0, 37)}...` : `Sources for ${displayTitle}`;

    const renderSidebarItem = (source: Source, index: number) => {
      const domain = getSourceDomain(source.url);
      const sourceName = domain || (source.type === 'document' ? 'Document' : 'Web');
      return (
        <div key={`${source.type}-${index}`} className={cn('px-4 py-3 hover:bg-gray-50 transition-colors', isMobile && 'py-4 min-h-[60px]')}>
          <div className="flex gap-3">
            <div className={cn('flex-shrink-0 rounded-lg flex items-center justify-center', isMobile ? 'w-10 h-10' : 'w-9 h-9', source.type === 'document' ? 'bg-blue-100' : 'bg-green-100')}>
              {source.type === 'document' ? <FileText className={cn(isMobile ? 'w-5 h-5' : 'w-4 h-4', 'text-blue-600')} /> : <Globe className={cn(isMobile ? 'w-5 h-5' : 'w-4 h-4', 'text-green-600')} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-medium mb-0.5">{sourceName}</p>
              <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 cursor-pointer hover:text-orange-600 transition-colors mb-1 touch-manipulation" onClick={() => handleSourceClick(source)}>{source.title || `Source ${index + 1}`}</h4>
              {source.snippet && <p className="text-xs text-gray-600 line-clamp-2 mb-2">{source.snippet}</p>}
              {(source.url || (source.type === 'document' && source.documentId)) && (
                <div className="mt-2 flex items-center gap-2">
                  {source.type === 'document' && source.documentId ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDocumentDownload(source); }} className={cn('text-blue-600 hover:text-blue-700 flex items-center gap-1', isMobile ? 'text-sm min-h-[44px] px-3 py-2 rounded-lg hover:bg-blue-50' : 'text-xs gap-1')}>
                      <Download className={cn(isMobile ? 'w-4 h-4' : 'w-3 h-3')} /> Download
                    </button>
                  ) : source.url ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className={cn('text-green-600 hover:text-green-700 flex items-center gap-1', isMobile ? 'text-sm min-h-[44px] px-3 py-2 rounded-lg hover:bg-green-50' : 'text-xs gap-1')}>
                      <ExternalLink className={cn(isMobile ? 'w-4 h-4' : 'w-3 h-3')} /> Open
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    if (isMobile) {
      return (
        <>
          {isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />}
          <div className={cn('fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out', isOpen ? 'translate-y-0' : 'translate-y-full', className)} style={{ maxHeight: '90vh' }}>
            <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1 bg-gray-300 rounded-full" /></div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
              <h3 className="font-semibold text-base text-gray-900 truncate pr-2">{headerLabel}</h3>
              {onClose && <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close sources"><X className="w-5 h-5" /></button>}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0"><div className="divide-y divide-gray-100">{sortedForSidebar.map(renderSidebarItem)}</div></div>
          </div>
        </>
      );
    }

    return (
      <div className={cn('flex flex-col h-full w-full bg-white border-l border-gray-200 flex-shrink-0', className)} style={{ width: 'min(400px, 100%)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/80">
          <h3 className="font-semibold text-sm text-gray-900 truncate pr-2">{headerLabel}</h3>
          {onClose && <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close sources"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto"><div className="divide-y divide-gray-100">{sortedForSidebar.map(renderSidebarItem)}</div></div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Inline variant — composed from extracted header, filters, and list item
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className={cn('border-t border-gray-200 bg-white', className)}>
      <SourcePanelHeader
        sourceCount={sources.length}
        isOpen={isOpen}
        onToggle={onToggle}
        onExport={handleExportSources}
      />

      {isOpen && (
        <div className="border-t border-gray-200">
          <SourcePanelFilters
            filter={filter}
            onFilterChange={setFilter}
            totalCount={sources.length}
            documentCount={documentCount}
            webCount={webCount}
          />

          <div className="max-h-[400px] overflow-y-auto">
            {sortedSources.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No sources found for this filter
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedSources.map((source, index) => (
                  <SourceListItem
                    key={`${source.type}-${index}`}
                    source={source}
                    index={index}
                    isExpanded={expandedSource === `${source.type}-${index}`}
                    onToggleExpand={(key) => setExpandedSource(expandedSource === key ? null : key)}
                    onSourceClick={handleSourceClick}
                    onDocumentDownload={handleDocumentDownload}
                    textPreview={source.documentId ? textPreviews[source.documentId] : undefined}
                    onLoadTextPreview={loadTextPreview}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
