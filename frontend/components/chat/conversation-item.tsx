'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MessageSquare, Trash2, Edit2, Check, X, Folder, MoreVertical, Pin } from 'lucide-react';
import { useConversationStore } from '@/lib/store/conversation-store';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { useMobile } from '@/lib/hooks/use-mobile';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onSaveToCollection?: (conversationId: string) => void;
  onPin?: (conversationId: string) => void;
  isPinned?: boolean;
  formatTime: (dateString?: string) => string;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onSaveToCollection,
  onPin,
  isPinned = false,
  formatTime,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title || '');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { updateConversation } = useConversationStore();
  const { toast } = useToast();
  const { isMobile } = useMobile();

  // Close menu on outside click (works for both mouse and touch)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      // Listen to both mousedown and touchstart for better mobile support
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showMenu]);

  const handleEdit = async () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      try {
        await updateConversation(conversation.id, editTitle.trim());
        setIsEditing(false);
        setShowMenu(false);
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
    setShowMenu(false);
  };

  const handleRename = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleAddToCollection = () => {
    if (onSaveToCollection) {
      onSaveToCollection(conversation.id);
    }
    setShowMenu(false);
  };

  const handlePin = () => {
    if (onPin) {
      onPin(conversation.id);
    }
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete(e);
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
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isPinned && (
                    <Pin className="w-3 h-3 text-orange-500 fill-orange-500 flex-shrink-0" />
                  )}
                  <h3 className={cn(
                    'text-sm font-medium truncate',
                    isActive ? 'text-orange-900' : 'text-gray-900'
                  )}>
                    {conversation.title || 'New Conversation'}
                  </h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {conversation.topic_id && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 bg-orange-100 rounded">
                      Research
                    </span>
                  )}
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }}
                      className={cn(
                        "p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-opacity touch-manipulation",
                        "min-w-[44px] min-h-[44px] flex items-center justify-center", // Touch target size
                        isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100" // Always visible on mobile
                      )}
                      title="More options"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMenu && (
                      <div className={cn(
                        "absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1",
                        isMobile 
                          ? "right-0 top-full mt-1 w-48 max-w-[calc(100vw-2rem)]" // Ensure menu doesn't overflow on mobile
                          : "right-0 top-full mt-1 w-48"
                      )}>
                        {onPin && (
                          <button
                            onClick={handlePin}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[44px]"
                            style={{ minHeight: '44px' }}
                          >
                            <Pin className={cn('w-4 h-4', isPinned && 'fill-current')} />
                            {isPinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                        {onSaveToCollection && (
                          <button
                            onClick={handleAddToCollection}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[44px]"
                            style={{ minHeight: '44px' }}
                          >
                            <Folder className="w-4 h-4" />
                            Add to Collection
                          </button>
                        )}
                        <button
                          onClick={handleRename}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[44px]"
                          style={{ minHeight: '44px' }}
                        >
                          <Edit2 className="w-4 h-4" />
                          Rename
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={handleDelete}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left touch-manipulation min-h-[44px]"
                          style={{ minHeight: '44px' }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
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
