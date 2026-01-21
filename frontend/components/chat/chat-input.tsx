'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { UnifiedFilters } from './unified-filter-panel';
import { HorizontalFilterBar } from './horizontal-filter-bar';
import { Topic } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string, filters?: UnifiedFilters) => void;
  disabled?: boolean;
  placeholder?: string;
  // Unified filters props
  topics?: Topic[];
  selectedTopic?: Topic | null;
  onTopicSelect?: (topic: Topic | null) => void;
  unifiedFilters?: UnifiedFilters;
  onUnifiedFiltersChange?: (filters: UnifiedFilters) => void;
  onLoadTopics?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  topics = [],
  selectedTopic = null,
  onTopicSelect,
  unifiedFilters,
  onUnifiedFiltersChange,
  onLoadTopics,
}) => {
  const [message, setMessage] = useState('');
  const [localFilters, setLocalFilters] = useState<UnifiedFilters>(
    unifiedFilters || {
      topicId: selectedTopic?.id || null,
      topic: selectedTopic,
    }
  );

  // Update local filters when unifiedFilters prop changes
  React.useEffect(() => {
    if (unifiedFilters) {
      setLocalFilters(unifiedFilters);
    }
  }, [unifiedFilters]);

  // Update local filters when selectedTopic changes
  React.useEffect(() => {
    setLocalFilters(prev => ({
      ...prev,
      topicId: selectedTopic?.id || null,
      topic: selectedTopic,
    }));
  }, [selectedTopic]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      // Check if we have any filters (topic or quick filters)
      const hasFilters = localFilters.topicId || 
                        localFilters.keyword || 
                        localFilters.timeRange || 
                        localFilters.startDate || 
                        localFilters.endDate || 
                        localFilters.country;
      
      const filtersToSend = hasFilters ? localFilters : undefined;
      onSend(message.trim(), filtersToSend);
      setMessage('');
      // Don't clear filters - keep them for the next message
      // Filters will persist in the conversation
    }
  };

  const handleFiltersChange = (newFilters: UnifiedFilters) => {
    setLocalFilters(newFilters);
    if (onUnifiedFiltersChange) {
      onUnifiedFiltersChange(newFilters);
    }
  };

  const handleTopicSelect = (topic: Topic | null) => {
    const updatedFilters: UnifiedFilters = {
      ...localFilters,
      topicId: topic?.id || null,
      topic: topic,
      // Clear keyword if topic is selected (topic takes precedence)
      keyword: topic ? undefined : localFilters.keyword,
    };
    handleFiltersChange(updatedFilters);
    if (onTopicSelect) {
      onTopicSelect(topic);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      {/* Horizontal Filter Bar - Above input */}
      <HorizontalFilterBar
        filters={localFilters}
        topics={topics}
        selectedTopic={selectedTopic || localFilters.topic || null}
        onChange={handleFiltersChange}
        onTopicSelect={handleTopicSelect}
        disabled={disabled}
        onLoadTopics={onLoadTopics}
      />

      {/* Main Input */}
      <div className="flex gap-3 px-4 py-3">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400"
            style={{
              minHeight: '48px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
          >
            {disabled ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
