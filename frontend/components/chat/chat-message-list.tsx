'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from './chat-message';
import { StreamingControls } from './streaming-controls';
import { QueryExpansionDisplay } from '@/components/advanced/query-expansion-display';
import { RerankingControls } from '@/components/advanced/reranking-controls';
import { ContextVisualization } from '@/components/advanced/context-visualization';
import { TokenUsageDisplay } from '@/components/advanced/token-usage-display';
import { CostEstimation } from '@/components/advanced/cost-estimation';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessageListProps } from './chat-types';

/**
 * Distance from the bottom (px) at which we still consider the user
 * "at the bottom" and continue auto-scrolling as new content arrives.
 */
const SCROLL_BOTTOM_THRESHOLD = 150;

/**
 * Virtualised message thread.
 *
 * Uses @tanstack/react-virtual to keep the rendered DOM at ~10–20 message
 * nodes regardless of total conversation length.  Dynamic measurement
 * (`measureElement` + ResizeObserver) handles variable message heights
 * including markdown, citations, and source components.
 *
 * Includes:
 *  - Scroll-to-top / scroll-to-bottom arrows
 *  - Each ChatMessage with follow-ups, sources, edit support
 *  - Advanced-features display after the last assistant message
 *  - Streaming controls (pause / resume / cancel / retry)
 *  - Error banner
 */
export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isStreaming,
  streamingState,
  error,
  isMobile,
  mode,
  conversationId,
  // Advanced features
  lastResponseData,
  queryExpansionEnabled,
  onQueryExpansionEnabledChange,
  queryExpansionSettings,
  onQueryExpansionSettingsChange,
  rerankingEnabled,
  onRerankingEnabledChange,
  rerankingSettings,
  onRerankingSettingsChange,
  previousTokenUsage,
  previousCost,
  // Handlers
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onVersionSelect,
  onCompareVersions,
  onFollowUpClick,
  onExitResearchMode,
  onOpenSources,
  onPauseStreaming,
  onResumeStreaming,
  onCancelStreaming,
  onRetryStreaming,
  onDismissError,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(messages.length);

  // ── Virtualizer (dynamic measurement) ───────────────────────────
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 5,
    getItemKey: (index) => messages[index]?.id ?? index,
  });

  // ── Track whether user is scrolled near bottom ──────────────────
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
  }, []);

  // ── Auto-scroll to bottom ───────────────────────────────────────
  // Fires on every messages/isStreaming change (including each
  // streaming chunk).  Only scrolls if the user was already at the
  // bottom or new messages were appended.
  useEffect(() => {
    // Force "at bottom" when new messages are appended
    if (messages.length > prevMessageCountRef.current) {
      isAtBottomRef.current = true;
    }
    prevMessageCountRef.current = messages.length;

    if (isAtBottomRef.current && messages.length > 0) {
      // rAF lets the virtualizer + ResizeObserver settle first
      requestAnimationFrame(() => {
        const el = parentRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages, isStreaming]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className="flex-1 min-w-0 overflow-y-auto relative"
    >
      {/* Scroll to top / bottom arrows for long conversations */}
      {messages.length > 3 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="p-1.5 rounded bg-white/90 border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-600 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              parentRef.current?.scrollTo({
                top: parentRef.current.scrollHeight,
                behavior: 'smooth',
              })
            }
            className="p-1.5 rounded bg-white/90 border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-600 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Content wrapper (centring + padding — same layout as before) */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 pb-6 w-full">

        {/* Virtualised height container */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const index = virtualItem.index;
            const message = messages[index];

            const userQuestion =
              index > 0 && message.role === 'assistant'
                ? messages[index - 1]?.content
                : undefined;

            const previousAssistantMessage =
              index > 0
                ? messages.slice(0, index).reverse().find((m) => m.role === 'assistant')
                : undefined;
            const previousResponseTime = previousAssistantMessage?.responseTime;

            const isLastMessage = index === messages.length - 1;
            const showControls =
              isLastMessage &&
              message.role === 'assistant' &&
              (streamingState === 'streaming' || streamingState === 'paused' || streamingState === 'error');

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ChatMessage
                  message={message}
                  previousResponseTime={previousResponseTime}
                  onEdit={onEditMessage}
                  onFollowUpClick={(question) => onFollowUpClick(question)}
                  userQuestion={userQuestion}
                  onExitResearchMode={onExitResearchMode}
                  onOpenSources={
                    message.sources && message.sources.length > 0
                      ? (sources, query) => onOpenSources(sources, query ?? '')
                      : undefined
                  }
                  isStreaming={isStreaming && isLastMessage}
                  onDelete={onDeleteMessage}
                  onRegenerate={onRegenerateMessage}
                  onVersionSelect={onVersionSelect}
                  onCompareVersions={onCompareVersions}
                  conversationId={conversationId}
                  mode={mode}
                  isFirstAssistantMessage={message.role === 'assistant' && messages.findIndex(m => m.role === 'assistant') === virtualItem.index}
                />

                {/* Advanced features after the last assistant message */}
                {isLastMessage && message.role === 'assistant' && !isStreaming && lastResponseData && (
                  <div className={cn('mt-4', isMobile ? 'space-y-4' : 'space-y-3')}>
                    {lastResponseData.queryExpansion && (
                      <QueryExpansionDisplay
                        originalQuery={userQuestion || ''}
                        expandedQuery={lastResponseData.queryExpansion.expanded}
                        expansionReasoning={lastResponseData.queryExpansion.reasoning}
                        enabled={queryExpansionEnabled}
                        onToggle={onQueryExpansionEnabledChange}
                        onSettingsChange={onQueryExpansionSettingsChange}
                        settings={queryExpansionSettings}
                      />
                    )}

                    {lastResponseData.reranking && (
                      <RerankingControls
                        enabled={rerankingEnabled}
                        onToggle={onRerankingEnabledChange}
                        onSettingsChange={onRerankingSettingsChange}
                        settings={rerankingSettings}
                        impact={lastResponseData.reranking.impact}
                        preview={lastResponseData.reranking.preview}
                      />
                    )}

                    {lastResponseData.contextChunks && lastResponseData.contextChunks.length > 0 && (
                      <ContextVisualization
                        chunks={lastResponseData.contextChunks}
                        tokenUsage={{
                          total: lastResponseData.usage?.totalTokens || 0,
                          prompt: lastResponseData.usage?.promptTokens || 0,
                          completion: lastResponseData.usage?.completionTokens || 0,
                          context: lastResponseData.contextChunks.reduce(
                            (sum: number, chunk: { tokens: number }) => sum + chunk.tokens,
                            0,
                          ),
                        }}
                        selectionReasoning={lastResponseData.selectionReasoning}
                      />
                    )}

                    {lastResponseData.usage && (
                      <TokenUsageDisplay
                        tokenUsage={{
                          promptTokens: lastResponseData.usage.promptTokens,
                          completionTokens: lastResponseData.usage.completionTokens,
                          totalTokens: lastResponseData.usage.totalTokens,
                        }}
                        previousUsage={previousTokenUsage || undefined}
                        showAlerts={true}
                      />
                    )}

                    {lastResponseData.cost && (
                      <CostEstimation
                        cost={lastResponseData.cost}
                        previousCost={previousCost || undefined}
                        showAlerts={true}
                      />
                    )}
                  </div>
                )}

                {showControls && (
                  <div className="flex justify-start mb-4">
                    <StreamingControls
                      state={streamingState}
                      onPause={onPauseStreaming}
                      onResume={onResumeStreaming}
                      onCancel={onCancelStreaming}
                      onRetry={onRetryStreaming}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-1 flex flex-col gap-2">
                <p className="text-sm text-red-800">{error}</p>
                {(error.includes('limit') ||
                  error.includes('Upgrade') ||
                  error.includes('plan') ||
                  error.includes('subscription') ||
                  error.includes('tier')) && (
                    <a
                      href="/dashboard/settings/subscription"
                      className="text-sm text-orange-600 hover:text-orange-800 underline font-medium self-start"
                    >
                      Upgrade your plan →
                    </a>
                  )}
              </div>
              {onDismissError && (
                <button
                  onClick={onDismissError}
                  className="flex-shrink-0 p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
