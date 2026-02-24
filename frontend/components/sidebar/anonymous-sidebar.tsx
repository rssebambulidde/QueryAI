'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SquarePen, LogIn, UserPlus, MessageSquareWarning, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnonymousSidebarProps {
  onNewChat: () => void;
  queryCount: number;
  maxQueries: number;
}

/**
 * Minimal sidebar for the anonymous chat page.
 * Shows brand, new chat, sign-in CTAs, and a "not saved" notice.
 * Matches the Copilot-style slim sidebar design.
 */
export const AnonymousSidebar: React.FC<AnonymousSidebarProps> = ({
  onNewChat,
  queryCount,
  maxQueries,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col h-full border-r border-gray-200 bg-white transition-all duration-200 flex-shrink-0',
        isCollapsed ? 'w-[60px]' : 'w-[260px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        {!isCollapsed && <Logo href="/chat" showName size="sm" />}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Query counter (only when not collapsed) */}
      {!isCollapsed && queryCount > 0 && (
        <div className="px-4 mb-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((queryCount / maxQueries) * 100, 100)}%` }}
              />
            </div>
            <span>{queryCount}/{maxQueries}</span>
          </div>
        </div>
      )}

      {/* Not saved notice */}
      {!isCollapsed && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700">
            <MessageSquareWarning className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Conversations are not saved. Sign in to keep your history.</span>
          </div>
        </div>
      )}

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
