'use client';

import React from 'react';
import { Conversation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MessageSquare, Pin } from 'lucide-react';

interface ConversationHoverPreviewProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelect: (conversationId: string) => void;
  pinnedConversations: Set<string>;
  formatTime: (dateString?: string) => string;
}

export const ConversationHoverPreview: React.FC<ConversationHoverPreviewProps> = ({
  conversations,
  currentConversationId,
  onSelect,
  pinnedConversations,
  formatTime,
}) => {
  return (
    <div 
      className="absolute left-full top-0 ml-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto"
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseLeave={(e) => e.stopPropagation()}
    >
      <div className="p-2">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
          All Conversations ({conversations.length})
        </div>
        <div className="space-y-0.5">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'w-full flex items-start gap-2 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-gray-50',
                conversation.id === currentConversationId && 'bg-orange-50'
              )}
            >
              <MessageSquare className={cn(
                'w-4 h-4 mt-0.5 flex-shrink-0',
                conversation.id === currentConversationId ? 'text-orange-600' : 'text-gray-400'
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {pinnedConversations.has(conversation.id) && (
                    <Pin className="w-3 h-3 text-orange-500 fill-orange-500 flex-shrink-0" />
                  )}
                  <span className={cn(
                    'text-sm font-medium truncate',
                    conversation.id === currentConversationId ? 'text-orange-900' : 'text-gray-900'
                  )}>
                    {conversation.title || 'New Conversation'}
                  </span>
                </div>
                {conversation.lastMessage && (
                  <p className="text-xs text-gray-500 truncate mb-1">
                    {conversation.lastMessage}
                  </p>
                )}
                <span className="text-xs text-gray-400">
                  {formatTime(conversation.lastMessageAt || conversation.updated_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
