'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, Calendar, MapPin, Hash, Tag, Plus, Sparkles, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { TimeRange, Topic, topicApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UnifiedFilters } from './unified-filter-panel';

interface HorizontalFilterBarProps {
  filters: UnifiedFilters;
  topics: Topic[];
  selectedTopic: Topic | null;
  onChange: (filters: UnifiedFilters) => void;
  onTopicSelect: (topic: Topic | null) => void;
  disabled?: boolean;
  onLoadTopics?: () => void;
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'day', label: '24h' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'UG', name: 'Uganda' },
  { code: 'KE', name: 'Kenya' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  // Add more as needed
];

export const HorizontalFilterBar: React.FC<HorizontalFilterBarProps> = ({
  filters,
  topics,
  selectedTopic,
  onChange,
  onTopicSelect,
  disabled = false,
  onLoadTopics,
}) => {
  const { toast } = useToast();
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const topicDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node)) {
        setShowTopicDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTopicSelect = (topic: Topic | null) => {
    onTopicSelect(topic);
    setShowTopicDropdown(false);
    onChange({
      ...filters,
      topicId: topic?.id || null,
      topic: topic || null,
      keyword: topic ? undefined : filters.keyword,
    });
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) {
      toast.error('Topic name is required');
      return;
    }

    try {
      const response = await topicApi.create({
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || undefined,
      });

      if (response.success && response.data) {
        toast.success('Topic created successfully');
        const newTopic = response.data;
        setNewTopicName('');
        setNewTopicDescription('');
        setShowCreateTopic(false);
        handleTopicSelect(newTopic);
        
        if (onLoadTopics) {
          onLoadTopics();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create topic');
    }
  };

  const handleClear = () => {
    onChange({
      topicId: null,
      topic: null,
      keyword: undefined,
      timeRange: undefined,
      startDate: undefined,
      endDate: undefined,
      country: undefined,
    });
    onTopicSelect(null);
  };

  const hasFilters = selectedTopic || filters.keyword || filters.timeRange || filters.startDate || filters.endDate || filters.country;

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Topic Selector */}
        <div className="flex items-center gap-2" ref={topicDropdownRef}>
          <Tag className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Topic:</span>
          {selectedTopic ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-200 rounded-md">
              <span className="text-xs font-medium text-orange-900">{selectedTopic.name}</span>
              <button
                onClick={() => handleTopicSelect(null)}
                disabled={disabled}
                className="p-0.5 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded transition-colors"
                title="Remove topic"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                disabled={disabled}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
              >
                Select...
              </button>
              
              {showTopicDropdown && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {topics.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      <p>No topics yet.</p>
                      <button
                        onClick={() => {
                          setShowTopicDropdown(false);
                          setShowCreateTopic(true);
                        }}
                        className="mt-2 text-orange-600 hover:text-orange-700 font-medium"
                      >
                        Create your first topic
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 border-b border-gray-100">
                        <button
                          onClick={() => {
                            setShowTopicDropdown(false);
                            setShowCreateTopic(true);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Create New Topic
                        </button>
                      </div>
                      {topics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => handleTopicSelect(topic)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">{topic.name}</div>
                          {topic.description && (
                            <div className="text-xs text-gray-500 mt-1">{topic.description}</div>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Create Topic Modal */}
          {showCreateTopic && (
            <div className="absolute top-full left-0 mt-1 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-900">Create Topic</span>
                <button
                  onClick={() => {
                    setShowCreateTopic(false);
                    setNewTopicName('');
                    setNewTopicDescription('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Topic name"
                disabled={disabled}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <textarea
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Description (optional)"
                disabled={disabled}
                rows={2}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTopic}
                  disabled={disabled || !newTopicName.trim()}
                  className="flex-1 px-2 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateTopic(false);
                    setNewTopicName('');
                    setNewTopicDescription('');
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-300"></div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Keyword */}
          {!selectedTopic && (
            <div className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-gray-500" />
              <input
                type="text"
                value={filters.keyword || ''}
                onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
                placeholder="Keyword"
                disabled={disabled}
                className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
              />
            </div>
          )}

          {/* Time Range */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-500" />
            <select
              value={filters.timeRange || ''}
              onChange={(e) => onChange({ ...filters, timeRange: e.target.value as TimeRange || undefined })}
              disabled={disabled}
              className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All time</option>
              {TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-500" />
            <select
              value={filters.country || ''}
              onChange={(e) => onChange({ ...filters, country: e.target.value || undefined })}
              disabled={disabled}
              className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 flex items-center gap-1"
            title="Advanced filters"
          >
            <Filter className="w-3 h-3" />
            {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Clear Button */}
        {hasFilters && (
          <button
            onClick={handleClear}
            disabled={disabled}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 flex items-center gap-1 whitespace-nowrap"
            title="Clear all filters"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters (Custom Date Range) */}
      {showAdvancedFilters && (
        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-3">
          <span className="text-xs text-gray-600">Custom Date:</span>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })}
            disabled={disabled}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })}
            disabled={disabled}
            min={filters.startDate}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
};
