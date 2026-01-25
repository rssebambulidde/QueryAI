'use client';

import React, { useState, useEffect } from 'react';
import { collectionApi, Conversation } from '@/lib/api';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollectionConversationsListProps {
  collectionId: string;
  onConversationSelect: (conversationId: string) => void;
}

export const CollectionConversationsList: React.FC<CollectionConversationsListProps> = ({
  collectionId,
  onConversationSelect,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [collectionId]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const response = await collectionApi.get(collectionId);
      if (response.success && response.data) {
        setConversations(response.data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load collection conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500 text-center">
        Loading...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500 text-center">
        No conversations in this collection
      </div>
    );
  }

  return (
    <div className="ml-4 mt-1 space-y-0.5">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onConversationSelect(conversation.id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded transition-colors text-left"
        >
          <MessageSquare className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {conversation.title || 'Untitled Conversation'}
          </span>
        </button>
      ))}
    </div>
  );
};
