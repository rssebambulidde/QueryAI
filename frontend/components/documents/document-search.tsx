'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Filter, SortAsc, SortDesc, Calendar, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DocumentItem } from '@/lib/api';
import { useMobile } from '@/lib/hooks/use-mobile';

export type DocumentSortOption = 'name' | 'date' | 'size' | 'status';
export type DocumentSortDirection = 'asc' | 'desc';
export type DocumentStatusFilter = 'all' | 'stored' | 'processing' | 'extracted' | 'embedding' | 'embedded' | 'processed' | 'failed';
export type DocumentTypeFilter = 'all' | 'pdf' | 'text' | 'docx' | 'image';

export interface DocumentFilters {
  searchQuery: string;
  status: DocumentStatusFilter;
  type: DocumentTypeFilter;
  dateFrom?: string;
  dateTo?: string;
  sortBy: DocumentSortOption;
  sortDirection: DocumentSortDirection;
}

interface DocumentSearchProps {
  documents: DocumentItem[];
  onFilterChange: (filtered: DocumentItem[]) => void;
  className?: string;
}

export const DocumentSearch: React.FC<DocumentSearchProps> = ({
  documents,
  onFilterChange,
  className,
}) => {
  const { isMobile } = useMobile();
  const [filters, setFilters] = useState<DocumentFilters>({
    searchQuery: '',
    status: 'all',
    type: 'all',
    sortBy: 'date',
    sortDirection: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((doc) => {
        const nameMatch = doc.name?.toLowerCase().includes(query);
        // Could also search in content if available
        return nameMatch;
      });
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((doc) => doc.status === filters.status);
    }

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter((doc) => {
        const extension = doc.name.split('.').pop()?.toLowerCase();
        const mimeType = doc.mimeType?.toLowerCase() || '';
        
        switch (filters.type) {
          case 'pdf':
            return extension === 'pdf' || mimeType.includes('pdf');
          case 'text':
            return extension === 'txt' || extension === 'md' || mimeType.startsWith('text/');
          case 'docx':
            return extension === 'docx' || mimeType.includes('word');
          case 'image':
            return mimeType.startsWith('image/');
          default:
            return true;
        }
      });
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter((doc) => {
        if (!doc.createdAt) return false;
        const docDate = new Date(doc.createdAt);
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (docDate < fromDate) return false;
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (docDate > toDate) return false;
        }
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'date':
        default:
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return filters.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [documents, filters]);

  // Notify parent of filtered results
  React.useEffect(() => {
    onFilterChange(filteredDocuments);
  }, [filteredDocuments, onFilterChange]);

  const handleSortChange = (sortBy: DocumentSortOption) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortDirection:
        prev.sortBy === sortBy && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      status: 'all',
      type: 'all',
      sortBy: 'date',
      sortDirection: 'desc',
    });
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.status !== 'all' ||
    filters.type !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  const statusOptions: Array<{ value: DocumentStatusFilter; label: string; icon: React.ReactNode }> = [
    { value: 'all', label: 'All', icon: null },
    { value: 'stored', label: 'Stored', icon: <FileText className="w-3.5 h-3.5" /> },
    { value: 'processing', label: 'Processing', icon: <Clock className="w-3.5 h-3.5" /> },
    { value: 'extracted', label: 'Extracted', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { value: 'embedding', label: 'Embedding', icon: <Clock className="w-3.5 h-3.5" /> },
    { value: 'embedded', label: 'Embedded', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { value: 'processed', label: 'Processed', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { value: 'failed', label: 'Failed', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className={cn('space-y-3 sm:space-y-3', className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className={cn(
          "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
          isMobile ? "w-5 h-5" : "w-4 h-4 left-2"
        )} />
        <Input
          type="text"
          placeholder="Search documents..."
          value={filters.searchQuery}
          onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
          className={cn(
            "pr-10 sm:pr-8",
            isMobile ? "pl-10 h-11 text-base" : "pl-8 h-9 text-sm"
          )}
        />
        {filters.searchQuery && (
          <button
            onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
            className={cn(
              "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation",
              isMobile ? "w-8 h-8 flex items-center justify-center" : "right-2"
            )}
          >
            <X className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
          </button>
        )}
      </div>

      {/* Filter Toggle and Sort */}
      <div className={cn(
        "flex items-center gap-2",
        isMobile ? "flex-col" : "justify-between"
      )}>
        <Button
          variant="outline"
          size={isMobile ? "md" : "sm"}
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 touch-manipulation',
            isMobile ? "w-full h-11 justify-center" : "",
            hasActiveFilters && 'bg-orange-50 border-orange-300'
          )}
        >
          <Filter className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
          Filters
          {hasActiveFilters && (
            <span className={cn(
              "ml-1 px-2 py-0.5 bg-orange-600 text-white rounded-full",
              isMobile ? "text-sm" : "text-xs"
            )}>
              {[
                filters.searchQuery && '1',
                filters.status !== 'all' && '1',
                filters.type !== 'all' && '1',
                filters.dateFrom && '1',
                filters.dateTo && '1',
              ]
                .filter(Boolean)
                .length}
            </span>
          )}
        </Button>

        {/* Sort Options */}
        <div className={cn(
          "flex items-center gap-2",
          isMobile ? "w-full" : "gap-1"
        )}>
          <Button
            variant="outline"
            size={isMobile ? "md" : "sm"}
            onClick={() => handleSortChange('date')}
            className={cn(
              "touch-manipulation",
              isMobile ? "flex-1 h-11" : "",
              filters.sortBy === 'date' && 'bg-orange-50 border-orange-300'
            )}
          >
            {filters.sortBy === 'date' && filters.sortDirection === 'desc' ? (
              <SortDesc className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
            ) : (
              <SortAsc className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
            )}
            {isMobile && <span className="ml-2">Date</span>}
          </Button>
          <Button
            variant="outline"
            size={isMobile ? "md" : "sm"}
            onClick={() => handleSortChange('name')}
            className={cn(
              "touch-manipulation",
              isMobile ? "flex-1 h-11" : "",
              filters.sortBy === 'name' && 'bg-orange-50 border-orange-300'
            )}
          >
            {isMobile ? (
              <>
                <SortAsc className="w-5 h-5 mr-2" />
                Name
              </>
            ) : (
              'Name'
            )}
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className={cn(
          "bg-gray-50 rounded-lg border border-gray-200 space-y-4 overflow-y-auto max-h-[60vh]",
          isMobile ? "p-4" : "p-4"
        )}>
          {/* Status Filter */}
          <div>
            <label className={cn(
              "block font-medium text-gray-700 mb-2",
              isMobile ? "text-sm" : "text-xs"
            )}>
              Status
            </label>
            <div className={cn(
              "flex flex-wrap items-center gap-2",
              isMobile ? "gap-2" : "gap-2"
            )}>
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  size={isMobile ? "md" : "sm"}
                  onClick={() => setFilters((prev) => ({ ...prev, status: option.value }))}
                  className={cn(
                    'flex items-center gap-1.5 touch-manipulation',
                    isMobile ? "h-11 px-4" : "",
                    filters.status === option.value && 'bg-orange-50 border-orange-300'
                  )}
                >
                  {option.icon && React.isValidElement(option.icon) && React.cloneElement(option.icon as React.ReactElement<any>, {
                    className: cn(isMobile ? "w-4 h-4" : "w-3.5 h-3.5")
                  })}
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className={cn(
              "block font-medium text-gray-700 mb-2",
              isMobile ? "text-sm" : "text-xs"
            )}>
              Document Type
            </label>
            <div className={cn(
              "flex items-center gap-2",
              isMobile ? "flex-wrap" : ""
            )}>
              {(['all', 'pdf', 'text', 'docx', 'image'] as DocumentTypeFilter[]).map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  size={isMobile ? "md" : "sm"}
                  onClick={() => setFilters((prev) => ({ ...prev, type }))}
                  className={cn(
                    'flex items-center gap-1.5 touch-manipulation',
                    isMobile ? "h-11 px-4 flex-1 min-w-[100px]" : "",
                    filters.type === type && 'bg-orange-50 border-orange-300'
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className={cn(
              "block font-medium text-gray-700 mb-2",
              isMobile ? "text-sm" : "text-xs"
            )}>
              Date Range
            </label>
            <div className={cn(
              "flex items-center gap-2",
              isMobile ? "flex-col" : ""
            )}>
              <div className={isMobile ? "w-full" : "flex-1"}>
                <label className={cn(
                  "block text-gray-500 mb-1",
                  isMobile ? "text-sm" : "text-xs"
                )}>
                  From
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
                  }}
                  className={cn(
                    "min-h-[44px] text-base sm:text-sm",
                    isMobile ? "w-full" : "h-8 text-xs"
                  )}
                />
              </div>
              <div className={isMobile ? "w-full" : "flex-1"}>
                <label className={cn(
                  "block text-gray-500 mb-1",
                  isMobile ? "text-sm" : "text-xs"
                )}>
                  To
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value }));
                  }}
                  className={cn(
                    "min-h-[44px] text-base sm:text-sm",
                    isMobile ? "w-full" : "h-8 text-xs"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size={isMobile ? "md" : "sm"}
              onClick={clearFilters}
              className={cn(
                "w-full touch-manipulation",
                isMobile ? "h-11" : ""
              )}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* Results Count */}
      {hasActiveFilters && (
        <div className={cn(
          "text-gray-500 text-center",
          isMobile ? "text-sm" : "text-xs"
        )}>
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      )}
    </div>
  );
};
