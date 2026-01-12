'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Filter } from 'lucide-react';
import { SearchFilters, SearchFilters as SearchFiltersType } from './search-filters';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string, filters?: SearchFiltersType) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  const [message, setMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersType>({});

  const handleSend = () => {
    if (message.trim() && !disabled) {
      const filtersToSend = Object.keys(filters).length > 0 ? filters : undefined;
      onSend(message.trim(), filtersToSend);
      setMessage('');
      setFilters({});
      setShowFilters(false);
    }
  };

  const handleFiltersChange = (newFilters: SearchFiltersType) => {
    setFilters(newFilters);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2">
      {/* Advanced Search Filters */}
      {showFilters && (
        <SearchFilters
          filters={filters}
          onChange={handleFiltersChange}
          onClose={() => setShowFilters(false)}
          disabled={disabled}
        />
      )}

      {/* Main Input */}
      <div className="flex gap-3">
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
            onClick={() => setShowFilters(!showFilters)}
            disabled={disabled}
            variant="outline"
            className={cn(
              "px-3 py-3 border-gray-300 hover:bg-gray-50",
              Object.keys(filters).length > 0 && "bg-blue-50 border-blue-300"
            )}
            title="Advanced search filters"
          >
            <Filter className={cn(
              "w-4 h-4",
              Object.keys(filters).length > 0 ? "text-blue-600" : "text-gray-600"
            )} />
          </Button>
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
