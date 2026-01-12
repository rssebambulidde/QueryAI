'use client';

import React, { useState } from 'react';
import { Filter, X, Calendar, MapPin, Hash } from 'lucide-react';
import { TimeRange } from '@/lib/api';

export interface SearchFilters {
  topic?: string;
  timeRange?: TimeRange;
  startDate?: string;
  endDate?: string;
  country?: string;
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClose: () => void;
  disabled?: boolean;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'year', label: 'Last year' },
];

// Popular countries list (can be expanded)
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'UG', name: 'Uganda' },
  { code: 'KE', name: 'Kenya' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'IN', name: 'India' },
  { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
];

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onChange,
  onClose,
  disabled = false,
}) => {
  const [useCustomDates, setUseCustomDates] = useState(false);

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
    onChange({});
    setUseCustomDates(false);
  };

  const hasFilters = filters.topic || filters.timeRange || filters.startDate || filters.endDate || filters.country;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Search Filters</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={handleClear}
              disabled={disabled}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            disabled={disabled}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Topic/Keyword Filter */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1">
          <Hash className="w-3 h-3" />
          Topic/Keyword
        </label>
        <input
          type="text"
          value={filters.topic || ''}
          onChange={(e) => onChange({ ...filters, topic: e.target.value })}
          placeholder="e.g., technology, education, AI, finance..."
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
        />
        <p className="text-xs text-gray-500 mt-1">Any keyword to filter search results</p>
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
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
        >
          <option value="">All countries</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
