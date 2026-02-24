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
import { Search, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// ─── Suggestion chips ────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  'Research a topic',
  'Verify a claim',
  'Compare two things',
  'Explain a concept',
  'Summarize an article',
  'Find recent news',
];

// ─── Component ───────────────────────────────────────────────────────────────

interface AnonymousChatContainerProps {
  onNewChat: () => void;
}

export const AnonymousChatContainer: React.FC<AnonymousChatContainerProps> = ({ onNewChat }) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationMode, setConversationMode] = useState<'research' | 'chat'>('research');
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

  const handleSuggestionClick = (suggestion: string) => {
    if (isGated) return;
    sendMessage(suggestion);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  // If query limit is reached and no messages, show gate
  if (isGated && isEmpty) {
    return <SignInPrompt variant="gate" />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Empty state — centred greeting + input + suggestion chips */}
      {isEmpty && (
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Icon + Greeting */}
            <div className="text-center mb-8">
              <div className={cn(
                'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
                conversationMode === 'chat'
                  ? 'bg-gradient-to-br from-purple-100 to-purple-200'
                  : 'bg-gradient-to-br from-blue-100 to-blue-200'
              )}>
                {conversationMode === 'chat'
                  ? <MessageCircle className="w-8 h-8 text-purple-600" />
                  : <Search className="w-8 h-8 text-blue-600" />
                }
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                {welcomeGreeting}
              </h3>
              <p className="text-gray-500">
                {conversationMode === 'chat'
                  ? 'Fast AI answers — quick and conversational.'
                  : 'In-depth research with cited sources and web search.'
                }
              </p>
            </div>

            {/* Input */}
            <ChatInputArea
              variant="empty"
              mode={conversationMode}
              onModeChange={setConversationMode}
              onSend={handleSend}
              disabled={isLoading || isStreaming}
              selectedTopic={null}
              dynamicStarters={null}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onOpenCitationSettings={NOOP}
              welcomeGreeting={undefined}
              ragSettings={{ enableDocumentSearch: false, enableWebSearch: true, maxDocumentChunks: 0, minScore: 0.5, maxWebResults: 3 }}
              onRagSettingsChange={NOOP}
            />

            {/* Suggestion chips */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSuggestionClick(chip)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
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
                onModeChange={setConversationMode}
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
    </div>
  );
};
