'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Calendar, MapPin, Hash, Tag, Plus, Sparkles, Info } from 'lucide-react';
import { TimeRange, Topic } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';
import { TopicCreationModal } from './topic-creation-modal';
import { KeywordTopicSuggestions } from './keyword-topic-suggestions';

export interface UnifiedFilters {
  // Persistent (Topic)
  topicId?: string | null;
  topic?: Topic | null;
  
  // Temporary (Quick Filters)
  keyword?: string;
  timeRange?: TimeRange;
  startDate?: string;
  endDate?: string;
  country?: string;
}

interface UnifiedFilterPanelProps {
  filters: UnifiedFilters;
  topics: Topic[];
  selectedTopic: Topic | null;
  onChange: (filters: UnifiedFilters) => void;
  onTopicSelect: (topic: Topic | null) => void;
  onClose: () => void;
  disabled?: boolean;
  onLoadTopics?: () => void;
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
  topics,
  selectedTopic,
  onChange,
  onTopicSelect,
  onClose,
  disabled = false,
  onLoadTopics,
}) => {
  const { isMobile } = useMobile();
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [createTopicInitialName, setCreateTopicInitialName] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [showKeywordSuggestion, setShowKeywordSuggestion] = useState(false);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if keyword should suggest creating a topic
  useEffect(() => {
    if (filters.keyword && filters.keyword.trim().length > 2 && !selectedTopic) {
      setShowKeywordSuggestion(true);
    } else {
      setShowKeywordSuggestion(false);
    }
  }, [filters.keyword, selectedTopic]);

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
      // Clear keyword if topic is selected (topic takes precedence)
      keyword: topic ? undefined : filters.keyword,
    });
  };

  const handleTopicCreated = (newTopic: Topic) => {
    setShowCreateTopic(false);
    setCreateTopicInitialName('');
    handleTopicSelect(newTopic);
    if (onLoadTopics) onLoadTopics();
  };

  const handleSaveKeywordAsTopic = () => {
    if (!filters.keyword || !filters.keyword.trim()) return;
    setCreateTopicInitialName(filters.keyword.trim());
    setShowCreateTopic(true);
    setShowKeywordSuggestion(false);
  };

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

  // Find matching topics for keyword suggestion
  const matchingTopics = filters.keyword && filters.keyword.trim().length > 2
    ? topics.filter(t => 
        t.name.toLowerCase().includes(filters.keyword!.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(filters.keyword!.toLowerCase()))
      )
    : [];

  return (
    <div 
      ref={panelRef}
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
        {/* Topic Scope Section (Persistent) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-orange-600" />
            <label className="text-xs font-semibold text-gray-900">Topic Scope</label>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span className="hidden sm:inline">Persistent - organizes conversations & documents</span>
            </div>
          </div>
          
          {selectedTopic ? (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm text-orange-900">{selectedTopic.name}</div>
                {selectedTopic.description && (
                  <div className="text-xs text-orange-700 mt-1">{selectedTopic.description}</div>
                )}
              </div>
              <button
                onClick={() => handleTopicSelect(null)}
                disabled={disabled}
                className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={topicDropdownRef}>
              <button
                onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                disabled={disabled}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 touch-manipulation",
                  "min-h-[44px]" // Touch target
                )}
              >
                <span className="text-gray-500">Select a topic...</span>
                <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
              
              {showTopicDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
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
          <TopicCreationModal
            isOpen={showCreateTopic}
            initialName={createTopicInitialName}
            disabled={disabled}
            onClose={() => { setShowCreateTopic(false); setCreateTopicInitialName(''); }}
            onCreated={handleTopicCreated}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Quick Filters Section (Temporary) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <label className="text-xs font-semibold text-gray-900">Quick Filters</label>
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
                placeholder={selectedTopic ? "Additional keyword (optional)" : "e.g., technology, education, AI..."}
                disabled={disabled || !!selectedTopic}
                className={cn(
                  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400",
                  "min-h-[44px]", // Touch target
                  selectedTopic && "bg-gray-100 cursor-not-allowed"
                )}
              />
              {selectedTopic && (
                <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
                  <span className="text-xs text-gray-500">Using topic instead</span>
                </div>
              )}
            </div>
            
            <KeywordTopicSuggestions
              keyword={filters.keyword}
              showKeywordSuggestion={showKeywordSuggestion}
              matchingTopics={matchingTopics}
              selectedTopic={selectedTopic}
              onSaveKeywordAsTopic={handleSaveKeywordAsTopic}
              onTopicSelect={handleTopicSelect}
            />
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
