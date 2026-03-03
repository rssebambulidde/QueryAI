'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Conversation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Trash2, Edit2, Check, X, Folder, MoreVertical, Pin, Search, MessageCircle } from 'lucide-react';
import { useConversationStore } from '@/lib/store/conversation-store';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { useMobile } from '@/lib/hooks/use-mobile';
import { MODE_LABELS, normalizeConversationMode } from '@/lib/chat/mode-config';

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
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { updateConversation } = useConversationStore();
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const conversationMode = normalizeConversationMode(conversation.mode);
  const isChatMode = conversationMode === 'chat';



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
            className="h-7 text-sm flex-1"
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

          {/* Mode indicator — text badge on hover */}
          {isChatMode ? (
            <span title={MODE_LABELS.chat} className="flex items-center gap-0.5 flex-shrink-0">
              <MessageCircle className="w-3 h-3 text-purple-400" />
              <span className={cn(
                'text-xs font-medium text-purple-400 transition-all overflow-hidden whitespace-nowrap',
                isHovered ? 'max-w-[50px] opacity-100' : 'max-w-0 opacity-0'
              )}>{MODE_LABELS.chat}</span>
            </span>
          ) : (
            <span title={MODE_LABELS.research} className="flex items-center gap-0.5 flex-shrink-0">
              <Search className="w-3 h-3 text-blue-400" />
              <span className={cn(
                'text-xs font-medium text-blue-400 transition-all overflow-hidden whitespace-nowrap',
                isHovered ? 'max-w-[60px] opacity-100' : 'max-w-0 opacity-0'
              )}>Research</span>
            </span>
          )}

          {/* Title — primary content, clean and simple */}
          <span className="flex-1 text-sm truncate">
            {conversation.title || 'New Conversation'}
          </span>

          {/* Hover metadata: time stamp */}
          <span className={cn(
            'text-xs text-gray-400 flex-shrink-0 transition-opacity whitespace-nowrap',
            (isHovered || isMobile) ? 'opacity-100' : 'opacity-0'
          )}>
            {formatTime(conversation.lastMessageAt || conversation.updated_at)}
          </span>

          {/* Context menu trigger */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!showMenu) {
                  // Calculate coordinates before showing
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuCoords({
                    top: rect.bottom + window.scrollY,
                    left: rect.right + window.scrollX,
                  });
                }
                setShowMenu(!showMenu);
              }}
              className={cn(
                'p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded transition-opacity',
                isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              title="More options"
              aria-label="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              >
                <div
                  className={cn(
                    'absolute bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44',
                    'transition-opacity'
                  )}
                  style={{
                    // Position relative to viewport, subtracting width and adding small margin
                    top: `${menuCoords.top + 4}px`,
                    left: `${menuCoords.left - 176}px`, // 176px is w-44
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {onPin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePin(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[36px]"
                    >
                      <Pin className={cn('w-3.5 h-3.5', isPinned && 'fill-current')} />
                      {isPinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {onSaveToCollection && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAddToCollection(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[36px]"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      Add to Collection
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRename(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left touch-manipulation min-h-[36px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <div className="border-t border-gray-100 my-0.5" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(e); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left touch-manipulation min-h-[36px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
        </>
      )}
    </div>
  );
};
