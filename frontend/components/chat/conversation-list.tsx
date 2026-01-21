'use client';

import React, { useEffect, useState } from 'react';
import { useConversationStore } from '@/lib/store/conversation-store';
import { ConversationItem } from './conversation-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';

export const ConversationList: React.FC = () => {
  const {
    conversations,
    currentConversationId,
    isLoading,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useConversationStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewConversation = async () => {
    try {
      await createConversation();
      toast.success('New conversation created');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create conversation');
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      try {
        await deleteConversation(id);
        toast.success('Conversation deleted');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete conversation');
      }
    }
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
          <Button
            onClick={handleNewConversation}
            size="sm"
            className="h-8 w-8 p-0"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading conversations...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <Button onClick={handleNewConversation} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onSelect={() => selectConversation(conversation.id)}
                onDelete={(e) => handleDeleteConversation(conversation.id, e)}
                formatTime={formatTime}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
