'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SquarePen, LogIn, UserPlus, PanelLeftClose, PanelLeft, MessageSquare, MoreHorizontal, Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnonymousConversation } from '@/components/chat/anonymous-chat-container';

interface AnonymousSidebarProps {
  onNewChat: () => void;
  /** Conversation stubs from current session */
  conversations?: AnonymousConversation[];
  /** Currently active conversation id */
  activeConversationId?: string | null;
  /** Called when user clicks a conversation in the list */
  onSelectConversation?: (id: string) => void;
  /** Called to rename a conversation */
  onRenameConversation?: (id: string, newTitle: string) => void;
  /** Called to delete a conversation */
  onDeleteConversation?: (id: string) => void;
}

/**
 * Minimal sidebar for the anonymous chat page.
 * Shows brand, new chat, sign-in CTAs, and a "not saved" notice.
 * Matches the Copilot-style slim sidebar design.
 */
export const AnonymousSidebar: React.FC<AnonymousSidebarProps> = ({
  onNewChat,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  // Focus edit input when entering rename mode
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startRename = (conv: AnonymousConversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation?.(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (id: string) => {
    onDeleteConversation?.(id);
    setMenuOpenId(null);
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full border-r border-gray-200 bg-white transition-all duration-200 flex-shrink-0',
        isCollapsed ? 'w-[60px]' : 'w-[260px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        {!isCollapsed && <Logo href="/" showName size="sm" />}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* New Chat button */}
      <div className="px-3 py-3">
        <button
          onClick={onNewChat}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <SquarePen className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Conversation list */}
      {!isCollapsed && conversations.length > 0 && (
        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wider text-gray-400 font-medium">
            Recent (not saved)
          </div>
          {conversations.map((conv) => (
            <div key={conv.id} className="relative group">
              {editingId === conv.id ? (
                /* Inline rename */
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    className="flex-1 text-sm px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    maxLength={80}
                  />
                  <button onClick={confirmRename} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={cancelRename} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Normal conversation row */
                <button
                  onClick={() => onSelectConversation?.(conv.id)}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-left transition-colors',
                    activeConversationId === conv.id
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  <span className="truncate flex-1">{conv.title}</span>
                  {/* 3-dot menu trigger */}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === conv.id ? null : conv.id); }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-opacity"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
                  </span>
                </button>
              )}

              {/* Dropdown menu */}
              {menuOpenId === conv.id && editingId !== conv.id && (
                <div ref={menuRef} className="absolute right-2 top-full z-20 mt-0.5 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <button
                    onClick={() => startRename(conv)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Spacer (only when no conversations to fill) */}
      {(isCollapsed || conversations.length === 0) && <div className="flex-1" />}

      {/* Auth CTAs */}
      <div className={cn(
        'border-t border-gray-100 px-3 py-3',
        isCollapsed ? 'flex flex-col items-center gap-2' : 'space-y-2'
      )}>
        {isCollapsed ? (
          <>
            <Link href="/login">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" title="Sign in">
                <LogIn className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/signup">
              <button className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors" title="Sign up">
                <UserPlus className="w-4 h-4" />
              </button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-gray-600">
                <LogIn className="w-4 h-4" />
                Sign in
              </Button>
            </Link>
            <Link href="/signup" className="block">
              <Button size="sm" className="w-full justify-start gap-2">
                <UserPlus className="w-4 h-4" />
                Sign up free
              </Button>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
};
