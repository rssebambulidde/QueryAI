'use client';

import React, { useCallback } from 'react';
import type { Source } from '@/lib/api';
import { SourcePanel } from './source-panel';
import type { SourcesSidebarProps } from './chat-types';
import { downloadDocument } from '@/lib/utils/download-document';

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
      downloadDocument(source.documentId, source.title || 'document', source.url);
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
