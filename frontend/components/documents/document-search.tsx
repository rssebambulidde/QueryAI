'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Filter, SortAsc, SortDesc, Calendar, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DocumentItem } from '@/lib/api';

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
          const dateA = doc.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = doc.createdAt ? new Date(b.createdAt).getTime() : 0;
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
    <div className={cn('space-y-3', className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search documents..."
          value={filters.searchQuery}
          onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
          className="pl-8 pr-8 h-9 text-sm"
        />
        {filters.searchQuery && (
          <button
            onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Toggle and Sort */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2',
            hasActiveFilters && 'bg-orange-50 border-orange-300'
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full">
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
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortChange('date')}
            className={cn(
              filters.sortBy === 'date' && 'bg-orange-50 border-orange-300'
            )}
          >
            {filters.sortBy === 'date' && filters.sortDirection === 'desc' ? (
              <SortDesc className="w-4 h-4" />
            ) : (
              <SortAsc className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSortChange('name')}
            className={cn(
              filters.sortBy === 'name' && 'bg-orange-50 border-orange-300'
            )}
          >
            Name
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters((prev) => ({ ...prev, status: option.value }))}
                  className={cn(
                    'flex items-center gap-1.5',
                    filters.status === option.value && 'bg-orange-50 border-orange-300'
                  )}
                >
                  {option.icon}
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <div className="flex items-center gap-2">
              {(['all', 'pdf', 'text', 'docx', 'image'] as DocumentTypeFilter[]).map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters((prev) => ({ ...prev, type }))}
                  className={cn(
                    'flex items-center gap-1.5',
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
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value }));
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
              Clear All Filters
            </Button>
          )}
        </div>
      )}

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="text-xs text-gray-500 text-center">
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      )}
    </div>
  );
};
