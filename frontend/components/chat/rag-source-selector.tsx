'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RAGSettings {
  enableDocumentSearch: boolean;
  enableWebSearch: boolean;
  documentIds?: string[];
  maxDocumentChunks?: number;
  minScore?: number;
  maxWebResults?: number;
  topicId?: string;
}

interface RAGSourceSelectorProps {
  settings: RAGSettings;
  onChange: (settings: RAGSettings) => void;
  documentCount?: number;
  hasProcessedDocuments?: boolean;
  className?: string;
}

export const RAGSourceSelector: React.FC<RAGSourceSelectorProps> = ({
  settings,
  onChange,
  documentCount = 0,
  hasProcessedDocuments = false,
  className,
}) => {
  const [isDocumentAvailable, setIsDocumentAvailable] = useState(hasProcessedDocuments);
  const [isWebAvailable, setIsWebAvailable] = useState(true); // Assume web is available

  // Update availability when document count changes
  useEffect(() => {
    setIsDocumentAvailable(hasProcessedDocuments && documentCount > 0);
  }, [hasProcessedDocuments, documentCount]);

  const handleDocumentToggle = () => {
    if (!isDocumentAvailable) return; // Don't toggle if not available
    
    onChange({
      ...settings,
      enableDocumentSearch: !settings.enableDocumentSearch,
    });
  };

  const handleWebToggle = () => {
    if (!isWebAvailable) return; // Don't toggle if not available
    
    onChange({
      ...settings,
      enableWebSearch: !settings.enableWebSearch,
    });
  };

  // Ensure at least one source is enabled
  useEffect(() => {
    if (!settings.enableDocumentSearch && !settings.enableWebSearch) {
      // If both are disabled, enable web search as default
      if (isWebAvailable) {
        onChange({
          ...settings,
          enableWebSearch: true,
        });
      } else if (isDocumentAvailable) {
        onChange({
          ...settings,
          enableDocumentSearch: true,
        });
      }
    }
  }, [settings.enableDocumentSearch, settings.enableWebSearch, isDocumentAvailable, isWebAvailable]);

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Document Search Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDocumentToggle}
          disabled={!isDocumentAvailable}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
            settings.enableDocumentSearch && isDocumentAvailable
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-500',
            !isDocumentAvailable
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-100 cursor-pointer'
          )}
          title={
            !isDocumentAvailable
              ? 'No processed documents available'
              : settings.enableDocumentSearch
              ? 'Disable document search'
              : 'Enable document search'
          }
        >
          <FileText className={cn(
            'w-4 h-4',
            settings.enableDocumentSearch && isDocumentAvailable ? 'text-blue-600' : 'text-gray-400'
          )} />
          <span className="text-sm font-medium">Documents</span>
          {isDocumentAvailable && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              settings.enableDocumentSearch
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-200 text-gray-600'
            )}>
              {documentCount}
            </span>
          )}
          {settings.enableDocumentSearch && isDocumentAvailable && (
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
          )}
          {!isDocumentAvailable && (
            <AlertCircle className="w-3 h-3 text-gray-400" />
          )}
        </button>
      </div>

      {/* Web Search Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleWebToggle}
          disabled={!isWebAvailable}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
            settings.enableWebSearch && isWebAvailable
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-500',
            !isWebAvailable
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-100 cursor-pointer'
          )}
          title={
            !isWebAvailable
              ? 'Web search unavailable'
              : settings.enableWebSearch
              ? 'Disable web search'
              : 'Enable web search'
          }
        >
          <Globe className={cn(
            'w-4 h-4',
            settings.enableWebSearch && isWebAvailable ? 'text-green-600' : 'text-gray-400'
          )} />
          <span className="text-sm font-medium">Web</span>
          {settings.enableWebSearch && isWebAvailable && (
            <CheckCircle2 className="w-3 h-3 text-green-600" />
          )}
          {!isWebAvailable && (
            <AlertCircle className="w-3 h-3 text-gray-400" />
          )}
        </button>
      </div>

      {/* Status Indicator */}
      {!settings.enableDocumentSearch && !settings.enableWebSearch && (
        <div className="flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="w-3 h-3" />
          <span>Enable at least one source</span>
        </div>
      )}
    </div>
  );
};
