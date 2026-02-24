'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Message } from './chat-message';
import type { Source } from '@/lib/api';
import type { StreamingState } from './streaming-controls';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';
import { ChatMessageList } from './chat-message-list';
import { ChatInputArea } from './chat-input-area';
import { SourcesSidebar } from './sources-sidebar';
import { ChatErrorBoundary } from './chat-error-boundary';
import { SignInPrompt } from './sign-in-prompt';
import { useAnonymousChatSend } from '@/lib/hooks/useAnonymousChatSend';
import { useMobile } from '@/lib/hooks/use-mobile';
import { useToast } from '@/lib/hooks/use-toast';

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

const MAX_ANONYMOUS_QUERIES = 5;
const SESSION_QUERY_KEY = 'queryai_anon_queries';

function getSessionQueryCount(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(sessionStorage.getItem(SESSION_QUERY_KEY) || '0', 10);
}

function incrementSessionQueryCount(): number {
  const count = getSessionQueryCount() + 1;
  sessionStorage.setItem(SESSION_QUERY_KEY, count.toString());
  return count;
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
}

export const AnonymousChatContainer: React.FC<AnonymousChatContainerProps> = ({ onNewChat, onConversationCreated }) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationMode] = useState<'research' | 'chat'>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>('completed');
  const [error, setError] = useState<string | null>(null);
  const [sourcePanelContext, setSourcePanelContext] = useState<{ sources: Source[]; query: string } | null>(null);
  const [queryCount, setQueryCount] = useState(getSessionQueryCount);
  const [showSignInBanner, setShowSignInBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const { isMobile } = useMobile();

  const isGated = queryCount >= MAX_ANONYMOUS_QUERIES;
  const isEmpty = messages.length === 0;

  // Track conversation in sidebar list after first assistant reply
  const conversationIdRef = useRef<string | null>(null);
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
  }, [messages, onConversationCreated]);

  // Hook
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
      const newCount = incrementSessionQueryCount();
      setQueryCount(newCount);
      // Show sign-in banner after first answer
      if (newCount === 1 && !bannerDismissed) {
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
    if (h < 12) return 'Good morning! What would you like to research?';
    if (h < 17) return 'Good afternoon! What would you like to research?';
    return 'Good evening! What would you like to research?';
  })();

  const handleSend = async (content: string) => {
    if (isGated) return;
    await sendMessage(content);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  // If query limit is reached and no messages, show gate
  if (isGated && isEmpty) {
    return <SignInPrompt variant="gate" />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Empty state — centred greeting + input (no suggestion chips) */}
      {isEmpty && (
        <ChatInputArea
          variant="empty"
          mode={conversationMode}
          onSend={handleSend}
          disabled={isLoading || isStreaming}
          selectedTopic={null}
          dynamicStarters={null}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onOpenCitationSettings={NOOP}
          welcomeGreeting={welcomeGreeting}
          ragSettings={{ enableDocumentSearch: false, enableWebSearch: true, maxDocumentChunks: 0, minScore: 0.5, maxWebResults: 3 }}
          onRagSettingsChange={NOOP}
        />
      )}

      {/* Conversation mode */}
      {!isEmpty && (
        <>
          {/* Sign-in prompt banner */}
          {showSignInBanner && !bannerDismissed && !isGated && (
            <SignInPrompt
              variant="banner"
              onDismiss={() => {
                setBannerDismissed(true);
                setShowSignInBanner(false);
              }}
            />
          )}

          {/* Gate overlay if limit reached */}
          {isGated ? (
            <SignInPrompt variant="gate" />
          ) : (
            <>
              <div className="flex flex-1 min-h-0">
                <ChatErrorBoundary scope="chat">
                  <ChatMessageList
                    messages={messages}
                    isStreaming={isStreaming}
                    streamingState={streamingState}
                    error={error}
                    selectedTopic={null}
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
                selectedTopic={null}
                dynamicStarters={null}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onOpenCitationSettings={NOOP}
                ragSettings={{ enableDocumentSearch: false, enableWebSearch: true, maxDocumentChunks: 0, minScore: 0.5, maxWebResults: 3 }}
                onRagSettingsChange={NOOP}
              />
            </>
          )}
        </>
      )}

      <div ref={messagesEndRef} />

      {/* Footer legal links */}
      <footer className="flex items-center justify-center gap-3 py-2 text-[11px] text-gray-400 border-t border-gray-100 flex-shrink-0">
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
