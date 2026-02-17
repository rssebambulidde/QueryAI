'use client';

import React from 'react';
import { Source } from '@/lib/api';
import { ExternalLink, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadDocument } from '@/lib/utils/download-document';

interface SourceCitationProps {
  source: Source;
  index: number;
  className?: string;
}

export const SourceCitation: React.FC<SourceCitationProps> = ({ source, index, className }) => {
  const handleDocumentClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (source.documentId) {
      await downloadDocument(source.documentId, source.title || 'document', source.url);
    } else if (source.url) {
      window.open(source.url, '_blank');
    }
  };

  const getSourceDisplayName = () => {
    if (source.type === 'web' && source.url) {
      try {
        const url = new URL(source.url);
        return url.hostname.replace('www.', '');
      } catch {
        return source.title || `Source ${index + 1}`;
      }
    }
    return source.title || `Document ${index + 1}`;
  };

  const isDocument = source.type === 'document';
  const displayName = getSourceDisplayName();

  return (
    <a
      href={source.url || '#'}
      onClick={isDocument && source.documentId ? handleDocumentClick : undefined}
      target={!isDocument ? '_blank' : undefined}
      rel={!isDocument ? 'noopener noreferrer' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        'bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800',
        'border border-orange-200 hover:border-orange-300',
        className
      )}
      title={source.title || displayName}
    >
      {isDocument ? (
        <>
          <FileText className="w-3 h-3" />
          <span className="truncate max-w-[200px]">{displayName}</span>
          {source.documentId && <Download className="w-3 h-3 flex-shrink-0" />}
        </>
      ) : (
        <>
          <ExternalLink className="w-3 h-3" />
          <span className="truncate max-w-[200px]">{displayName}</span>
        </>
      )}
    </a>
  );
};
