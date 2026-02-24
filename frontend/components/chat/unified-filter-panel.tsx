'use client';

import React, { useState } from 'react';
import { Filter, X, Calendar, MapPin, Hash, Sparkles, Info } from 'lucide-react';
import { TimeRange } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

export interface UnifiedFilters {
  // Quick Filters
  keyword?: string;
  timeRange?: TimeRange;
  startDate?: string;
  endDate?: string;
  country?: string;
}

interface UnifiedFilterPanelProps {
  filters: UnifiedFilters;
  onChange: (filters: UnifiedFilters) => void;
  onClose: () => void;
  disabled?: boolean;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'year', label: 'Last year' },
];

// Complete list of all countries with ISO 3166-1 alpha-2 codes
import { COUNTRY_LIST as COUNTRIES } from '@/lib/constants/countries';

export const UnifiedFilterPanel: React.FC<UnifiedFilterPanelProps> = ({
  filters,
  onChange,
  onClose,
  disabled = false,
}) => {
  const { isMobile } = useMobile();
  const [useCustomDates, setUseCustomDates] = useState(false);

  const handleKeywordChange = (value: string) => {
    onChange({
      ...filters,
      keyword: value,
    });
  };

  const handleTimeRangeChange = (value: TimeRange | 'custom') => {
    if (value === 'custom') {
      setUseCustomDates(true);
      onChange({ ...filters, timeRange: undefined });
    } else {
      setUseCustomDates(false);
      onChange({ ...filters, timeRange: value, startDate: undefined, endDate: undefined });
    }
  };

  const handleClear = () => {
    onChange({
      keyword: undefined,
      timeRange: undefined,
      startDate: undefined,
      endDate: undefined,
      country: undefined,
    });
  };

  const hasFilters = filters.keyword || filters.timeRange || filters.startDate || filters.endDate || filters.country;

  return (
    <div 
      className={cn(
        "bg-white border border-gray-200 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 relative z-[100] flex flex-col",
        isMobile ? "max-h-[90vh] w-full mx-2" : "max-h-[80vh]"
      )}
      style={isMobile ? {
        maxHeight: 'calc(100vh - 2rem)',
        marginTop: 'env(safe-area-inset-top, 0)',
        marginBottom: 'env(safe-area-inset-bottom, 0)'
      } : {}}
    >
      {/* Header - Fixed */}
      <div className="flex-shrink-0 sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-[60] shadow-sm overflow-visible">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <Filter className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900 truncate">Unified Filters</h3>
          </div>
          <div className="flex items-center gap-2 relative z-[70] flex-shrink-0">
            {hasFilters && (
              <button
                onClick={handleClear}
                disabled={disabled}
                className={cn(
                  "text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap border border-gray-300 hover:border-gray-400 touch-manipulation",
                  "min-h-[44px]", // Touch target
                  isMobile ? "text-sm px-4" : ""
                )}
                title="Clear all filters"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              disabled={disabled}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors relative z-[70] flex items-center justify-center touch-manipulation min-w-[44px] min-h-[44px] flex-shrink-0"
              title="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
        {/* Filters Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <label className="text-xs font-semibold text-gray-900">Filters</label>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span className="hidden sm:inline">Temporary - refines web search only</span>
            </div>
          </div>

          {/* Keyword Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Hash className="w-3 h-3" />
              Keyword
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.keyword || ''}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="e.g., technology, education, AI..."
                disabled={disabled}
                className={cn(
                  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400",
                  "min-h-[44px]" // Touch target
                )}
              />
            </div>
          </div>

          {/* Time Range Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <Calendar className="w-3 h-3" />
              Time Range
            </label>
            <div className="space-y-2">
              <select
                value={useCustomDates ? 'custom' : filters.timeRange || ''}
                onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange | 'custom')}
                disabled={disabled}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
              >
                <option value="">All time</option>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom date range</option>
              </select>

              {useCustomDates && (
                <div className={cn(
                  "grid gap-2",
                  isMobile ? "grid-cols-1" : "grid-cols-2"
                )}>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
                      disabled={disabled}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">End Date</label>
                    <input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
                      disabled={disabled}
                      min={filters.startDate}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 min-h-[44px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location/Country Filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
              <MapPin className="w-3 h-3" />
              Location
            </label>
            <select
              value={filters.country || ''}
              onChange={(e) => onChange({ ...filters, country: e.target.value || undefined })}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 min-h-[44px]"
            >
              <option value="">All countries</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{COUNTRIES.length} countries available</p>
          </div>
        </div>
      </div>
    </div>
  );
};
