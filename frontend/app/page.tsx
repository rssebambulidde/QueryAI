'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { AnonymousChatContainer } from '@/components/chat/anonymous-chat-container';
import type { AnonymousConversation } from '@/components/chat/anonymous-chat-container';
import { AnonymousSidebar } from '@/components/sidebar/anonymous-sidebar';
import { useMobile } from '@/lib/hooks/use-mobile';
import { Menu, X } from 'lucide-react';
import type { Message } from '@/components/chat/chat-message';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { isMobile } = useMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [conversations, setConversations] = useState<AnonymousConversation[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem('queryai_anon_conversations');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt) }));
      }
    } catch { /* ignore */ }
    return [];
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Store messages per conversation so we can switch between them
  const messageStoreRef = useRef<Record<string, Message[]>>({});

  // Restore cached messages from sessionStorage on mount.
  // JSON.parse turns Date fields into strings, so rehydrate `timestamp` back to Date.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('queryai_anon_messages');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Message[]>;
        for (const msgs of Object.values(parsed)) {
          for (const msg of msgs) {
            if (msg.timestamp && !(msg.timestamp instanceof Date)) {
              msg.timestamp = new Date(msg.timestamp as unknown as string);
            }
          }
        }
        messageStoreRef.current = parsed;
      }
    } catch { /* ignore */ }
  }, []);



  // If Supabase redirected here with auth hash params (e.g. confirmation or error),
  // forward to /auth/confirm which handles them properly.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
      router.replace(`/auth/confirm${hash}`);
      return;
    }
  }, [router]);

  useEffect(() => {
    checkAuth().catch(() => { });
  }, [checkAuth]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleNewChat = () => {
    setChatKey((k) => k + 1);
    setActiveConversationId(null);
    setIsMobileSidebarOpen(false);
  };

  // Persist conversations to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem('queryai_anon_conversations', JSON.stringify(conversations));
    } catch { /* ignore quota errors */ }
  }, [conversations]);

  const persistMessages = useCallback(() => {
    try {
      sessionStorage.setItem('queryai_anon_messages', JSON.stringify(messageStoreRef.current));
    } catch { /* ignore quota errors */ }
  }, []);

  const handleConversationCreated = useCallback((conv: AnonymousConversation) => {
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
  }, []);

  /** Called by the container whenever its messages change so we can cache them */
  const handleMessagesChange = useCallback((convId: string, msgs: Message[]) => {
    messageStoreRef.current[convId] = msgs;
    persistMessages();
  }, [persistMessages]);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setChatKey((k) => k + 1); // re-mount container with cached messages
    setIsMobileSidebarOpen(false);
  }, []);

  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: newTitle } : c));
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    delete messageStoreRef.current[id];
    persistMessages();
    if (activeConversationId === id) {
      setChatKey((k) => k + 1);
      setActiveConversationId(null);
    }
  }, [activeConversationId, persistMessages]);

  // Resolve initial messages for the active conversation (if switching back)
  const initialMessages = activeConversationId ? (messageStoreRef.current[activeConversationId] || []) : [];

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
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
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
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <AnonymousChatContainer
            key={chatKey}
            onNewChat={handleNewChat}
            onConversationCreated={handleConversationCreated}
            initialMessages={initialMessages}
            conversationId={activeConversationId}
            onMessagesChange={handleMessagesChange}
          />
        </div>
      </main>
    </div>
  );
}
