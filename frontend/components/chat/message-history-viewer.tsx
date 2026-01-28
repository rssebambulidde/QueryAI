'use client';

import React, { useState, useMemo } from 'react';
import { Message, Source } from '@/lib/api';
import { Search, Download, FileText, Globe, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportConversationToMarkdown, exportConversationToJson } from '@/lib/utils/export-conversation';
import { Conversation } from '@/lib/api';

interface MessageHistoryViewerProps {
  conversation: Conversation;
  messages: Message[];
  className?: string;
}

interface MessageWithSources extends Message {
  sources?: Source[];
  sourceTypes?: {
    documents: number;
    web: number;
  };
}

export const MessageHistoryViewer: React.FC<MessageHistoryViewerProps> = ({
  conversation,
  messages,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Process messages with source information
  const processedMessages = useMemo<MessageWithSources[]>(() => {
    return messages.map((message) => {
      const sources = message.sources as Source[] | undefined;
      const sourceTypes = sources
        ? {
            documents: sources.filter((s) => s.type === 'document').length,
            web: sources.filter((s) => s.type === 'web').length,
          }
        : { documents: 0, web: 0 };

      return {
        ...message,
        sources,
        sourceTypes,
      };
    });
  }, [messages]);

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return processedMessages;

    const query = searchQuery.toLowerCase();
    return processedMessages.filter(
      (msg) =>
        msg.content.toLowerCase().includes(query) ||
        msg.sources?.some((s) => s.title?.toLowerCase().includes(query))
    );
  }, [processedMessages, searchQuery]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: Record<string, MessageWithSources[]> = {};
    filteredMessages.forEach((msg) => {
      const date = new Date(msg.created_at);
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    return groups;
  }, [filteredMessages]);

  const toggleMessage = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleExportMessage = (message: MessageWithSources) => {
    const exportData = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
      },
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: message.created_at,
        sources: message.sources || [],
      },
      exported_at: new Date().toISOString(),
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `message-${message.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Message History</h3>
          <div className="text-sm text-gray-500">
            {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey} className="space-y-4">
            {/* Date Header */}
            <div className="sticky top-0 bg-white py-2 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700">{dateKey}</h4>
            </div>

            {/* Messages for this date */}
            {dateMessages.map((message, index) => {
              const isExpanded = expandedMessages.has(message.id);
              const isSelected = selectedMessageId === message.id;
              const isUser = message.role === 'user';
              const hasSources = message.sources && message.sources.length > 0;

              return (
                <div
                  key={message.id}
                  className={cn(
                    'border border-gray-200 rounded-lg p-4 transition-all',
                    isSelected && 'ring-2 ring-orange-500 border-orange-300',
                    isUser ? 'bg-blue-50' : 'bg-white'
                  )}
                >
                  {/* Message Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          isUser
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        )}
                      >
                        {isUser ? 'User' : 'Assistant'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTime(message.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasSources && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          {message.sourceTypes?.documents > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {message.sourceTypes.documents}
                            </span>
                          )}
                          {message.sourceTypes?.web > 0 && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {message.sourceTypes.web}
                            </span>
                          )}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportMessage(message)}
                        className="h-7 px-2"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMessage(message.id)}
                        className="h-7 px-2"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Message Content Preview */}
                  <div
                    className={cn(
                      'text-sm text-gray-700 mb-2',
                      isExpanded ? '' : 'line-clamp-3'
                    )}
                    onClick={() => setSelectedMessageId(message.id)}
                  >
                    {message.content}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      {/* Full Content */}
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {message.content}
                      </div>

                      {/* Sources */}
                      {hasSources && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 mb-2">Sources</h5>
                          <div className="space-y-2">
                            {message.sources!.map((source, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                              >
                                {source.type === 'document' ? (
                                  <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                                ) : (
                                  <Globe className="w-4 h-4 text-green-600 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-gray-900 truncate">
                                    {source.title || `Source ${idx + 1}`}
                                  </div>
                                  {source.url && (
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-orange-600 hover:text-orange-700 truncate block"
                                    >
                                      {source.url}
                                    </a>
                                  )}
                                  {source.snippet && (
                                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {source.snippet}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {filteredMessages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No messages found' : 'No messages in this conversation'}
          </div>
        )}
      </div>
    </div>
  );
};
