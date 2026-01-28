'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Filter, Calendar, SortAsc, SortDesc, FileText, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Conversation } from '@/lib/api';

export type SortOption = 'date' | 'title' | 'messageCount';
export type SortDirection = 'asc' | 'desc';
export type SourceTypeFilter = 'all' | 'document' | 'web';

export interface ConversationFilters {
  searchQuery: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  sourceType: SourceTypeFilter;
  sortBy: SortOption;
  sortDirection: SortDirection;
}

interface ConversationSearchProps {
  conversations: Conversation[];
  onFilterChange: (filtered: Conversation[]) => void;
  className?: string;
}

export const ConversationSearch: React.FC<ConversationSearchProps> = ({
  conversations,
  onFilterChange,
  className,
}) => {
  const [filters, setFilters] = useState<ConversationFilters>({
    searchQuery: '',
    sourceType: 'all',
    sortBy: 'date',
    sortDirection: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter((conv) => {
        const titleMatch = conv.title?.toLowerCase().includes(query);
        const lastMessageMatch = conv.lastMessage?.toLowerCase().includes(query);
        return titleMatch || lastMessageMatch;
      });
    }

    // Date range filter
    if (filters.dateRange?.start || filters.dateRange?.end) {
      filtered = filtered.filter((conv) => {
        const convDate = new Date(conv.updated_at || conv.created_at);
        if (filters.dateRange?.start && convDate < filters.dateRange.start) return false;
        if (filters.dateRange?.end) {
          const endDate = new Date(filters.dateRange.end);
          endDate.setHours(23, 59, 59, 999); // Include entire end day
          if (convDate > endDate) return false;
        }
        return true;
      });
    }

    // Source type filter (check if conversation has messages with specific source types)
    if (filters.sourceType !== 'all') {
      // This would require checking message sources, which we don't have in the list
      // For now, we'll skip this filter or implement it when we have source data
      // filtered = filtered.filter((conv) => {
      //   // Check if conversation has sources of the specified type
      //   return true; // Placeholder
      // });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'messageCount':
          comparison = (a.messageCount || 0) - (b.messageCount || 0);
          break;
        case 'date':
        default:
          const dateA = new Date(a.updated_at || a.created_at).getTime();
          const dateB = new Date(b.updated_at || b.created_at).getTime();
          comparison = dateA - dateB;
          break;
      }

      return filters.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [conversations, filters]);

  // Notify parent of filtered results
  React.useEffect(() => {
    onFilterChange(filteredConversations);
  }, [filteredConversations, onFilterChange]);

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: value }));
  };

  const handleDateRangeChange = () => {
    setFilters((prev) => ({
      ...prev,
      dateRange: {
        start: dateStart ? new Date(dateStart) : undefined,
        end: dateEnd ? new Date(dateEnd) : undefined,
      },
    }));
  };

  const handleSortChange = (sortBy: SortOption) => {
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
      sourceType: 'all',
      sortBy: 'date',
      sortDirection: 'desc',
    });
    setDateStart('');
    setDateEnd('');
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.dateRange?.start ||
    filters.dateRange?.end ||
    filters.sourceType !== 'all';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search conversations..."
          value={filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-8 pr-8 h-9 text-sm"
        />
        {filters.searchQuery && (
          <button
            onClick={() => handleSearchChange('')}
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
                filters.dateRange?.start && '1',
                filters.dateRange?.end && '1',
                filters.sourceType !== 'all' && '1',
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
            onClick={() => handleSortChange('title')}
            className={cn(
              filters.sortBy === 'title' && 'bg-orange-50 border-orange-300'
            )}
          >
            Title
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={(e) => {
                    setDateStart(e.target.value);
                    handleDateRangeChange();
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => {
                    setDateEnd(e.target.value);
                    handleDateRangeChange();
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Source Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Source Type
            </label>
            <div className="flex items-center gap-2">
              {(['all', 'document', 'web'] as SourceTypeFilter[]).map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters((prev) => ({ ...prev, sourceType: type }))}
                  className={cn(
                    'flex items-center gap-1.5',
                    filters.sourceType === type && 'bg-orange-50 border-orange-300'
                  )}
                >
                  {type === 'document' && <FileText className="w-3.5 h-3.5" />}
                  {type === 'web' && <Globe className="w-3.5 h-3.5" />}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
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
          Showing {filteredConversations.length} of {conversations.length} conversations
        </div>
      )}
    </div>
  );
};
