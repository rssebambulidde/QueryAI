'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Trash2, Edit2, Check, X, Folder, MoreVertical, Pin } from 'lucide-react';
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
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { updateConversation } = useConversationStore();
  const { toast } = useToast();
  const { isMobile } = useMobile();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
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
    if (onSaveToCollection) onSaveToCollection(conversation.id);
    setShowMenu(false);
  };

  const handlePin = () => {
    if (onPin) onPin(conversation.id);
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
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-gray-100 text-gray-900'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Inline editing mode */}
      {isEditing ? (
        <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
            className="h-7 text-[13px] flex-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(); }}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* Pin indicator */}
          {isPinned && (
            <Pin className="w-3 h-3 text-gray-400 fill-gray-400 flex-shrink-0" />
          )}

          {/* Title — primary content, clean and simple */}
          <span className="flex-1 text-[13px] truncate">
            {conversation.title || 'New Conversation'}
          </span>

          {/* Hover metadata: time stamp */}
          <span className={cn(
            'text-[11px] text-gray-400 flex-shrink-0 transition-opacity whitespace-nowrap',
            (isHovered || isMobile) ? 'opacity-100' : 'opacity-0'
          )}>
            {formatTime(conversation.lastMessageAt || conversation.updated_at)}
          </span>

          {/* Context menu trigger */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className={cn(
                'p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded transition-opacity',
                isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              title="More options"
              aria-label="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className={cn(
                'absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1',
                'right-0 top-full mt-1 w-44'
              )}>
                {onPin && (
                  <button
                    onClick={handlePin}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[36px]"
                  >
                    <Pin className={cn('w-3.5 h-3.5', isPinned && 'fill-current')} />
                    {isPinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                {onSaveToCollection && (
                  <button
                    onClick={handleAddToCollection}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[36px]"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    Add to Collection
                  </button>
                )}
                <button
                  onClick={handleRename}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[36px]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Rename
                </button>
                <div className="border-t border-gray-100 my-0.5" />
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 text-left touch-manipulation min-h-[36px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
