'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tag, ChevronDown, ChevronUp, Plus, X, Hash, Calendar, MapPin } from 'lucide-react';
import { Topic, topicApi, conversationApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useFilterStore } from '@/lib/store/filter-store';
import { useConversationStore } from '@/lib/store/conversation-store';
import { TIME_RANGE_OPTIONS, COUNTRY_OPTIONS } from '@/lib/filter-constants';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/lib/api';

export const SidebarTopicFilters: React.FC = () => {
  const { toast } = useToast();
  const {
    unifiedFilters,
    setUnifiedFilters,
    topics,
    selectedTopic,
    setSelectedTopic,
    loadTopics,
    isLoadingTopics,
  } = useFilterStore();
  const { currentConversationId } = useConversationStore();

  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const topicDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(e.target as Node)) {
        setShowTopicDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTopicSelect = (topic: Topic | null) => {
    setSelectedTopic(topic);
    setShowTopicDropdown(false);
    setUnifiedFilters((prev) => ({
      ...prev,
      topicId: topic?.id ?? null,
      topic: topic ?? null,
      keyword: topic ? undefined : prev.keyword,
    }));
    if (currentConversationId) {
      conversationApi
        .update(currentConversationId, { topicId: topic?.id ?? undefined })
        .catch(console.warn);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) {
      toast.error('Topic name is required');
      return;
    }
    try {
      const res = await topicApi.create({
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || undefined,
      });
      if (res.success && res.data) {
        toast.success('Topic created');
        setNewTopicName('');
        setNewTopicDescription('');
        setShowCreateTopic(false);
        handleTopicSelect(res.data);
        await loadTopics();
      }
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || 'Failed to create topic');
    }
  };

  const handleClear = () => {
    setSelectedTopic(null);
    setUnifiedFilters({
      topicId: null,
      topic: null,
      keyword: undefined,
      timeRange: undefined,
      startDate: undefined,
      endDate: undefined,
      country: undefined,
    });
  };

  const hasFilters =
    selectedTopic ||
    unifiedFilters.keyword ||
    unifiedFilters.timeRange ||
    unifiedFilters.country;

  return (
    <div className="mt-2 ml-2 mr-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      {/* Topic selector */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-orange-600" />
          <span className="text-xs font-medium text-gray-700">Topic</span>
        </div>
        <div className="relative" ref={topicDropdownRef}>
          {selectedTopic ? (
            <div className="flex items-center justify-between gap-1 px-2.5 py-1.5 bg-orange-50 border border-orange-200 rounded-md">
              <span className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 bg-orange-100 rounded">
                  Research
                </span>
                <span className="text-xs font-medium text-orange-900 truncate">{selectedTopic.name}</span>
              </span>
              <button
                type="button"
                onClick={() => handleTopicSelect(null)}
                className="p-0.5 text-orange-600 hover:bg-orange-100 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowTopicDropdown(!showTopicDropdown);
                if (!showTopicDropdown) loadTopics();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-left"
            >
              <span className="text-gray-500">Select topic...</span>
              {showTopicDropdown ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
          )}

          {showTopicDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              <div className="p-1.5 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowTopicDropdown(false);
                    setShowCreateTopic(true);
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded"
                >
                  <Plus className="w-3 h-3" />
                  New topic
                </button>
              </div>
              {isLoadingTopics ? (
                <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
              ) : topics.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No topics yet</div>
              ) : (
                topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTopicSelect(t)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{t.name}</div>
                    {t.description && (
                      <div className="text-gray-500 mt-0.5 truncate">{t.description}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {showCreateTopic && (
          <div className="p-2 bg-white border border-gray-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">New topic</span>
              <button
                type="button"
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
              placeholder="Name"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <input
              type="text"
              value={newTopicDescription}
              onChange={(e) => setNewTopicDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleCreateTopic}
                disabled={!newTopicName.trim()}
                className="flex-1 px-2 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
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

      {/* Search filters */}
      <div className="space-y-2 border-t border-gray-200 pt-2">
        <div className="flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">Keyword</span>
        </div>
        <input
          type="text"
          value={unifiedFilters.keyword ?? ''}
          onChange={(e) =>
            setUnifiedFilters((prev) => ({ ...prev, keyword: e.target.value || undefined }))
          }
          placeholder="e.g. AI, education..."
          disabled={!!selectedTopic}
          className={cn(
            'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent',
            selectedTopic && 'bg-gray-100 cursor-not-allowed'
          )}
        />

        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">Time</span>
        </div>
        <select
          value={unifiedFilters.timeRange ?? ''}
          onChange={(e) =>
            setUnifiedFilters((prev) => ({
              ...prev,
              timeRange: (e.target.value as TimeRange) || undefined,
            }))
          }
          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="">All time</option>
          {TIME_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">Country</span>
        </div>
        <select
          value={unifiedFilters.country ?? ''}
          onChange={(e) =>
            setUnifiedFilters((prev) => ({ ...prev, country: e.target.value || undefined }))
          }
          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code || 'all'} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
        >
          <X className="w-3 h-3" />
          Clear filters
        </button>
      )}
    </div>
  );
};
