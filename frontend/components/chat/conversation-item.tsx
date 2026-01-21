'use client';

import React, { useState } from 'react';
import { Conversation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react';
import { useConversationStore } from '@/lib/store/conversation-store';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (dateString?: string) => string;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onDelete,
  formatTime,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title || '');
  const { updateConversation } = useConversationStore();
  const { toast } = useToast();

  const handleEdit = async () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      try {
        await updateConversation(conversation.id, editTitle.trim());
        setIsEditing(false);
        toast.success('Conversation renamed');
      } catch (error: any) {
        toast.error(error.message || 'Failed to rename conversation');
      }
    } else {
      setIsEditing(false);
      setEditTitle(conversation.title || '');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(conversation.title || '');
  };

  return (
    <div
      className={cn(
        'group relative px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50',
        isActive && 'bg-orange-50 border-l-4 border-l-orange-600'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-lg flex-shrink-0',
          isActive ? 'bg-orange-100' : 'bg-gray-100'
        )}>
          <MessageSquare className={cn(
            'w-4 h-4',
            isActive ? 'text-orange-600' : 'text-gray-600'
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2 mb-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="h-7 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <h3 className={cn(
                  'text-sm font-medium truncate',
                  isActive ? 'text-orange-900' : 'text-gray-900'
                )}>
                  {conversation.title || 'New Conversation'}
                </h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Rename"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onDelete}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              {conversation.lastMessage && (
                <p className="text-xs text-gray-500 truncate mb-1">
                  {conversation.lastMessage}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{formatTime(conversation.lastMessageAt || conversation.updated_at)}</span>
                {conversation.messageCount !== undefined && conversation.messageCount > 0 && (
                  <>
                    <span>•</span>
                    <span>{conversation.messageCount} messages</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
