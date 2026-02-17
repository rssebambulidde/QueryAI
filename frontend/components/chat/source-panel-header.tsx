'use client';

import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Globe,
  Filter,
  Download as DownloadIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SourceFilter } from './source-panel';

interface SourcePanelHeaderProps {
  sourceCount: number;
  isOpen: boolean;
  onToggle?: () => void;
  onExport: (format: 'json' | 'csv' | 'markdown') => void;
}

export const SourcePanelHeader: React.FC<SourcePanelHeaderProps> = ({
  sourceCount,
  isOpen,
  onToggle,
  onExport,
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors touch-manipulation min-h-[44px]"
  >
    <div className="flex items-center gap-2">
      {isOpen ? (
        <ChevronDown className="w-4 h-4 text-gray-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-500" />
      )}
      <span className="font-semibold text-sm text-gray-900">
        Sources ({sourceCount})
      </span>
    </div>
    {isOpen && (
      <div className="flex items-center gap-1">
        <div className="relative group">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExport('json');
            }}
            className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Export sources (JSON)"
          >
            <DownloadIcon className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    )}
  </button>
);

// ─── Filter Toolbar ──────────────────────────────────────────────────────────

interface SourcePanelFiltersProps {
  filter: SourceFilter;
  onFilterChange: (f: SourceFilter) => void;
  totalCount: number;
  documentCount: number;
  webCount: number;
}

export const SourcePanelFilters: React.FC<SourcePanelFiltersProps> = ({
  filter,
  onFilterChange,
  totalCount,
  documentCount,
  webCount,
}) => (
  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-gray-500" />
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFilterChange('all')}
            className={cn(
              'px-3 py-2 sm:px-2.5 sm:py-1 text-xs font-medium rounded transition-colors touch-manipulation min-h-[44px] sm:min-h-0',
              filter === 'all'
                ? 'bg-orange-100 text-orange-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => onFilterChange('document')}
            className={cn(
              'px-3 py-2 sm:px-2.5 sm:py-1 text-xs font-medium rounded transition-colors touch-manipulation min-h-[44px] sm:min-h-0',
              filter === 'document'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <FileText className="w-4 h-4 sm:w-3 sm:h-3 inline mr-1" />
            Docs ({documentCount})
          </button>
          <button
            onClick={() => onFilterChange('web')}
            className={cn(
              'px-3 py-2 sm:px-2.5 sm:py-1 text-xs font-medium rounded transition-colors touch-manipulation min-h-[44px] sm:min-h-0',
              filter === 'web'
                ? 'bg-green-100 text-green-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Globe className="w-4 h-4 sm:w-3 sm:h-3 inline mr-1" />
            Web ({webCount})
          </button>
        </div>
      </div>
    </div>
  </div>
);
