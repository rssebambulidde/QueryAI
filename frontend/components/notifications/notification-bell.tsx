'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, TrendingUp, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/lib/store/notification-store';
import { useAuthStore } from '@/lib/store/auth-store';
import type { UserNotification } from '@/lib/api';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

/** Icon per notification type */
function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'usage_alert':
      return <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />;
    case 'usage_limit':
      return <TrendingUp className="w-4 h-4 text-red-500 flex-shrink-0" />;
    default:
      return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { isAuthenticated } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isOpen,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    setOpen,
    toggle,
  } = useNotificationStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Poll unread count
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchUnreadCount]);

  // Fetch full list when opened
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchNotifications();
    }
  }, [isOpen, isAuthenticated, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, setOpen]);

  const handleMarkRead = useCallback(
    (n: UserNotification) => {
      if (!n.read) markRead(n.id);
    },
    [markRead],
  );

  if (!isAuthenticated) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={toggle}
        className={cn(
          'w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative',
          isOpen
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
        )}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold leading-none px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute left-12 bottom-0 z-50 w-80 max-h-[420px] flex flex-col bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Read all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3',
                    !n.read && 'bg-orange-50/40',
                  )}
                >
                  <div className="mt-0.5">
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          n.read ? 'text-gray-600' : 'text-gray-900 font-medium',
                        )}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
