'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Filter, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string, topic?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  const [message, setMessage] = useState('');
  const [showTopicFilter, setShowTopicFilter] = useState(false);
  const [topic, setTopic] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim(), topic.trim() || undefined);
      setMessage('');
      setTopic('');
      setShowTopicFilter(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2">
      {/* Topic Filter */}
      {showTopicFilter && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Filter by topic (e.g., technology, education, news)"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
            disabled={disabled}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={() => {
              setShowTopicFilter(false);
              setTopic('');
            }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={disabled}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
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
            onClick={() => setShowTopicFilter(!showTopicFilter)}
            disabled={disabled}
            variant="outline"
            className="px-3 py-3 border-gray-300 hover:bg-gray-50"
            title="Add topic filter"
          >
            <Filter className="w-4 h-4 text-gray-600" />
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
