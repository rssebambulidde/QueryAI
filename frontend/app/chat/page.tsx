'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { AnonymousChatContainer } from '@/components/chat/anonymous-chat-container';
import type { AnonymousConversation } from '@/components/chat/anonymous-chat-container';
import { AnonymousSidebar } from '@/components/sidebar/anonymous-sidebar';
import { useMobile } from '@/lib/hooks/use-mobile';
import { Menu, X } from 'lucide-react';

const ANON_HOURLY_LIMIT = 15;
const ANON_RATE_KEY = 'queryai_anon_hourly';

function getHourlyCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(ANON_RATE_KEY);
    if (raw) {
      const bucket = JSON.parse(raw);
      const currentHour = Math.floor(Date.now() / 3_600_000);
      if (bucket.hour === currentHour) return bucket.count;
    }
  } catch { /* ignore */ }
  return 0;
}

export default function AnonymousChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { isMobile } = useMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0); // key to reset chat container
  const [queryCount, setQueryCount] = useState(0);
  const [conversations, setConversations] = useState<AnonymousConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth().catch(() => {});
  }, [checkAuth]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Sync hourly query count
  useEffect(() => {
    setQueryCount(getHourlyCount());
    const interval = setInterval(() => {
      setQueryCount(getHourlyCount());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle OAuth redirect tokens in hash
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { hash } = window.location;
    if (hash && hash.includes('access_token')) {
      window.location.replace(`/auth/callback${hash}`);
    }
  }, []);

  const handleNewChat = () => {
    setChatKey((k) => k + 1); // Reset the chat container
    setActiveConversationId(null);
    setIsMobileSidebarOpen(false);
  };

  const handleConversationCreated = useCallback((conv: AnonymousConversation) => {
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
  }, []);

  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: newTitle } : c));
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      // Deleted the active conversation — start a new chat
      setChatKey((k) => k + 1);
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render for authenticated users (they'll be redirected)
  if (isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-[#FAF8F5]">
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="fixed top-4 left-4 z-50 bg-white shadow-lg rounded-lg p-2 border border-gray-200"
          aria-label="Toggle menu"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobile && isMobileSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[280px]">
              <AnonymousSidebar
                onNewChat={handleNewChat}
                queryCount={queryCount}
                maxQueries={ANON_HOURLY_LIMIT}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onRenameConversation={handleRenameConversation}
                onDeleteConversation={handleDeleteConversation}
              />
            </div>
          </>
        )}

        {/* Desktop sidebar */}
        {!isMobile && (
          <AnonymousSidebar
            onNewChat={handleNewChat}
            queryCount={queryCount}
            maxQueries={ANON_HOURLY_LIMIT}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <AnonymousChatContainer key={chatKey} onNewChat={handleNewChat} onConversationCreated={handleConversationCreated} />
        </div>
      </main>
    </div>
  );
}
