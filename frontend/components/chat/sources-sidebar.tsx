'use client';

import React, { useCallback } from 'react';
import type { Source } from '@/lib/api';
import { SourcePanel } from './source-panel';
import type { SourcesSidebarProps } from './chat-types';

/**
 * Perplexity-style sources sidebar.
 *
 * Renders on the right side of the chat when a user clicks "N sources".
 * Handles both web-link opening and document downloads.
 */
export const SourcesSidebar: React.FC<SourcesSidebarProps> = ({
  sourcePanelContext,
  onClose,
  className,
}) => {
  const handleSourceClick = useCallback((source: Source & { documentId?: string }) => {
    if (source.type === 'document' && source.documentId) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      fetch(`${API_URL}/api/documents/${source.documentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Download failed'))))
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = source.title || 'document';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(() => {
          if (source.url) window.open(source.url, '_blank');
        });
    } else if (source.url) {
      window.open(source.url, '_blank');
    }
  }, []);

  if (!sourcePanelContext) return null;

  return (
    <SourcePanel
      variant="sidebar"
      sources={sourcePanelContext.sources}
      title={sourcePanelContext.query}
      isOpen={true}
      onClose={onClose}
      onSourceClick={handleSourceClick}
      className={className ?? 'w-[min(400px,100%)]'}
    />
  );
};
