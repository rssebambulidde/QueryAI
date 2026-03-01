'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from './chat-message';
import type { Source } from '@/lib/api';
import type { StreamingState } from './streaming-controls';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';
import type { ChatAttachment } from './chat-types';
import { ChatMessageList } from './chat-message-list';
import { ChatInputArea } from './chat-input-area';
import { SourcesSidebar } from './sources-sidebar';
import { ChatErrorBoundary } from './chat-error-boundary';
import { SignInPrompt } from './sign-in-prompt';
import { useAnonymousChatSend } from '@/lib/hooks/useAnonymousChatSend';
import { useMobile } from '@/lib/hooks/use-mobile';
import { useToast } from '@/lib/hooks/use-toast';
import {
  DEFAULT_CONVERSATION_MODE,
  type ConversationMode,
} from '@/lib/chat/mode-config';

// ─── Default no-op values for advanced features (not used in anonymous mode) ─
const NOOP = () => {};
const DEFAULT_QE_SETTINGS: QueryExpansionSettings = {
  enableExpansion: false,
  expansionMethod: 'hybrid',
  maxExpansions: 5,
  confidenceThreshold: 0.7,
};
const DEFAULT_RERANK_SETTINGS: RerankingSettings = {
  enableReranking: false,
  rerankingMethod: 'cross-encoder',
  topK: 10,
  diversityWeight: 0.5,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ANON_HOURLY_LIMIT = 15; // max messages per hour
const ANON_RATE_KEY = 'queryai_anon_hourly';

interface HourlyBucket {
  hour: number; // getTime() floored to hour
  count: number;
}

function getHourlyBucket(): HourlyBucket {
  if (typeof window === 'undefined') return { hour: 0, count: 0 };
  try {
    const raw = localStorage.getItem(ANON_RATE_KEY);
    if (raw) {
      const bucket: HourlyBucket = JSON.parse(raw);
      const currentHour = Math.floor(Date.now() / 3_600_000);
      if (bucket.hour === currentHour) return bucket;
    }
  } catch { /* ignore */ }
  return { hour: Math.floor(Date.now() / 3_600_000), count: 0 };
}

function incrementHourlyBucket(): HourlyBucket {
  const bucket = getHourlyBucket();
  bucket.count += 1;
  localStorage.setItem(ANON_RATE_KEY, JSON.stringify(bucket));
  return bucket;
}

function isHourlyLimitReached(): boolean {
  return getHourlyBucket().count >= ANON_HOURLY_LIMIT;
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Lightweight conversation stub kept in memory for anonymous sidebar list */
export interface AnonymousConversation {
  id: string;
  title: string;
  createdAt: Date;
}

interface AnonymousChatContainerProps {
  onNewChat: () => void;
  /** Called when a new conversation is created (for the sidebar list) */
  onConversationCreated?: (conversation: AnonymousConversation) => void;
  /** Pre-loaded messages when switching back to an existing conversation */
  initialMessages?: Message[];
  /** Current conversation ID (from parent, for switching) */
  conversationId?: string | null;
  /** Called whenever messages change so parent can cache them */
  onMessagesChange?: (conversationId: string, messages: Message[]) => void;
}

export const AnonymousChatContainer: React.FC<AnonymousChatContainerProps> = ({
  onNewChat: _onNewChat,
  onConversationCreated,
  initialMessages,
  conversationId: parentConversationId,
  onMessagesChange,
}) => {
  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const conversationMode: ConversationMode = DEFAULT_CONVERSATION_MODE;
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>('completed');
  const [error, setError] = useState<string | null>(null);
  const [sourcePanelContext, setSourcePanelContext] = useState<{ sources: Source[]; query: string } | null>(null);
  const [hourlyCount, setHourlyCount] = useState(() => getHourlyBucket().count);
  const [showSignInBanner, setShowSignInBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  /** Conversation-level attachments — re-sent with every follow-up message. */
  const [conversationAttachments, setConversationAttachments] = useState<ChatAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const { isMobile } = useMobile();

  const isRateLimited = hourlyCount >= ANON_HOURLY_LIMIT;
  const isEmpty = messages.length === 0;

  // Track conversation in sidebar list after first assistant reply
  const conversationIdRef = useRef<string | null>(parentConversationId || null);
  useEffect(() => {
    // When the first assistant message arrives, register a conversation entry
    const assistantMsgs = messages.filter((m) => m.role === 'assistant' && m.content);
    if (assistantMsgs.length > 0 && !conversationIdRef.current) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      const title = firstUserMsg?.content?.slice(0, 60) || 'New conversation';
      conversationIdRef.current = `anon-conv-${Date.now()}`;
      onConversationCreated?.({
        id: conversationIdRef.current,
        title,
        createdAt: new Date(),
      });
    }
    // Sync messages to parent for caching
    if (conversationIdRef.current && messages.length > 0) {
      onMessagesChange?.(conversationIdRef.current, messages);
    }
  }, [messages, onConversationCreated, onMessagesChange]);

  // Anonymous mode is always Express/chat.
  const { sendMessage, cancelStream } = useAnonymousChatSend({
    messages,
    conversationMode,
    setMessages,
    setIsLoading,
    setIsStreaming,
    setStreamingState,
    setError,
    toast,
    onQuerySent: () => {
      const bucket = incrementHourlyBucket();
      setHourlyCount(bucket.count);
      // Show sign-in banner after first answer
      if (bucket.count === 1 && !bannerDismissed) {
        setShowSignInBanner(true);
      }
    },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Greeting
  const welcomeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning! What would you like to ask?';
    if (h < 17) return 'Good afternoon! What would you like to ask?';
    return 'Good evening! What would you like to ask?';
  })();

  /** Remove a conversation-level attachment (local only — anon has no DB conversations). */
  const removeConversationAttachment = useCallback((id: string) => {
    setConversationAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSend = async (content: string, attachments?: ChatAttachment[]) => {
    // Block if hourly rate limited
    if (isRateLimited) {
      toast.error('Hourly message limit reached. Please wait or sign up for unlimited access.');
      return;
    }

    // Store any new inline attachments at the conversation level for follow-ups
    if (attachments && attachments.length > 0) {
      setConversationAttachments((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newOnes = attachments.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newOnes].slice(0, 5);
      });
    }

    await sendMessage(content, attachments);
  };



  // ─── Render ─────────────────────────────────────────────────────────────

  // If hourly rate limited and no messages, show gate
  if (isRateLimited && isEmpty) {
    return <SignInPrompt variant="gate" message="You've reached the hourly message limit. Sign up for unlimited access." />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Empty state — centred greeting + input */}
      {isEmpty && (
        <ChatInputArea
          variant="empty"
          mode={conversationMode}
          onSend={handleSend}
          disabled={isLoading || isStreaming}
          dynamicStarters={null}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onOpenCitationSettings={NOOP}
          welcomeGreeting={welcomeGreeting}
          ragSettings={{ enableWebSearch: true, maxWebResults: 3 }}
          onRagSettingsChange={NOOP}
          activeConversationAttachments={conversationAttachments}
          onClearConversationAttachment={removeConversationAttachment}
        />
      )}

      {/* Conversation mode */}
      {!isEmpty && (
        <>
          {/* Sign-in prompt banner */}
          {showSignInBanner && !bannerDismissed && !isRateLimited && (
            <SignInPrompt
              variant="banner"
              onDismiss={() => {
                setBannerDismissed(true);
                setShowSignInBanner(false);
              }}
            />
          )}

          {/* Gate overlay if hourly rate limited */}
          {isRateLimited ? (
            <SignInPrompt variant="gate" message="You've reached the hourly message limit. Sign up for unlimited access." />
          ) : (
            <>
              <div className="flex flex-1 min-h-0">
                <ChatErrorBoundary scope="chat">
                  <ChatMessageList
                    messages={messages}
                    isStreaming={isStreaming}
                    streamingState={streamingState}
                    error={error}
                    isMobile={isMobile}
                    mode={conversationMode}
                    lastResponseData={null}
                    queryExpansionEnabled={false}
                    onQueryExpansionEnabledChange={NOOP}
                    queryExpansionSettings={DEFAULT_QE_SETTINGS}
                    onQueryExpansionSettingsChange={NOOP}
                    rerankingEnabled={false}
                    onRerankingEnabledChange={NOOP}
                    rerankingSettings={DEFAULT_RERANK_SETTINGS}
                    onRerankingSettingsChange={NOOP}
                    previousTokenUsage={null}
                    previousCost={null}
                    onEditMessage={NOOP}
                    onDeleteMessage={NOOP}
                    onRegenerateMessage={NOOP}
                    onVersionSelect={NOOP}
                    onCompareVersions={NOOP}
                    onFollowUpClick={(q) => handleSend(q)}
                    onExitResearchMode={NOOP}
                    onOpenSources={(sources, query) => setSourcePanelContext({ sources, query })}
                    onPauseStreaming={NOOP}
                    onResumeStreaming={NOOP}
                    onCancelStreaming={cancelStream}
                    onRetryStreaming={NOOP}
                    onDismissError={() => setError(null)}
                  />
                </ChatErrorBoundary>

                <SourcesSidebar
                  sourcePanelContext={sourcePanelContext}
                  onClose={() => setSourcePanelContext(null)}
                />
              </div>

              <ChatInputArea
                variant="conversation"
                mode={conversationMode}
                onSend={handleSend}
                disabled={isLoading || isStreaming}
                dynamicStarters={null}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onOpenCitationSettings={NOOP}
                ragSettings={{ enableWebSearch: true, maxWebResults: 3 }}
                onRagSettingsChange={NOOP}
                activeConversationAttachments={conversationAttachments}
                onClearConversationAttachment={removeConversationAttachment}
              />
            </>
          )}
        </>
      )}

      <div ref={messagesEndRef} />

      {/* Footer legal links */}
      <footer className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap py-2 text-xs text-gray-400 border-t border-gray-100 flex-shrink-0">
        <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
        <span>·</span>
        <a href="/terms" className="hover:text-gray-600 transition-colors">Terms</a>
        <span>·</span>
        <a href="/cookie-policy" className="hover:text-gray-600 transition-colors">Cookies</a>
        <span>·</span>
        <a href="/disclaimer" className="hover:text-gray-600 transition-colors">Disclaimer</a>
      </footer>
    </div>
  );
};
