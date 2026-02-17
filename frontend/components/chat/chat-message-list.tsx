'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from './chat-message';
import { StreamingControls } from './streaming-controls';
import { QueryExpansionDisplay } from '@/components/advanced/query-expansion-display';
import { RerankingControls } from '@/components/advanced/reranking-controls';
import { ContextVisualization } from '@/components/advanced/context-visualization';
import { TokenUsageDisplay } from '@/components/advanced/token-usage-display';
import { CostEstimation } from '@/components/advanced/cost-estimation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessageListProps } from './chat-types';

/**
 * Renders the scrollable message thread, including:
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
  selectedTopic,
  isMobile,
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
  onFollowUpClick,
  onExitResearchMode,
  onOpenSources,
  onActionResponse,
  onPauseStreaming,
  onResumeStreaming,
  onCancelStreaming,
  onRetryStreaming,
}) => {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={messagesContainerRef} className="flex-1 min-w-0 overflow-y-auto relative">
      {/* Scroll to top / bottom arrows for long conversations */}
      {messages.length > 3 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="p-1.5 rounded bg-white/90 border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-600 touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center"
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              messagesContainerRef.current?.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 w-full">
        {messages.map((message, index) => {
          const userQuestion =
            index > 0 && message.role === 'assistant' ? messages[index - 1]?.content : undefined;

          const previousAssistantMessage =
            index > 0 ? messages.slice(0, index).reverse().find((m) => m.role === 'assistant') : undefined;
          const previousResponseTime = previousAssistantMessage?.responseTime;

          const isLastMessage = index === messages.length - 1;
          const showControls =
            isLastMessage &&
            message.role === 'assistant' &&
            (streamingState === 'streaming' || streamingState === 'paused' || streamingState === 'error');

          return (
            <div key={message.id}>
              <ChatMessage
                message={message}
                previousResponseTime={previousResponseTime}
                onEdit={onEditMessage}
                onFollowUpClick={(question) => onFollowUpClick(question)}
                userQuestion={userQuestion}
                selectedTopicName={selectedTopic?.name ?? null}
                onExitResearchMode={onExitResearchMode}
                onActionResponse={async (content, actionType) => {
                  await onActionResponse(content, actionType ?? '', message.sources);
                }}
                onOpenSources={
                  message.sources && message.sources.length > 0
                    ? (sources, query) => onOpenSources(sources, query ?? '')
                    : undefined
                }
                isStreaming={isStreaming && isLastMessage}
                onDelete={onDeleteMessage}
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
                    <RerankingControls />
                  )}
                  {/* Error banner */}
                  {error && (
                    <EnhancedErrorBanner error={error} onRetry={onRetryStreaming} />
                  )}
        // Enhanced error banner component
        function EnhancedErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
          const [countdown, setCountdown] = React.useState<number | null>(null);
          React.useEffect(() => {
            if (error.includes('429') || error.toLowerCase().includes('rate limit')) {
              // Extract seconds from error message if present, else default to 30
              const match = error.match(/(\d+)(s| seconds?)/i);
              const seconds = match ? parseInt(match[1], 10) : 30;
              setCountdown(seconds);
              if (seconds > 0) {
                const interval = setInterval(() => {
                  setCountdown((c) => (c && c > 0 ? c - 1 : 0));
                }, 1000);
                return () => clearInterval(interval);
              }
            } else {
              setCountdown(null);
            }
          }, [error]);

          // Streaming interruption detection
          const isStreamingInterrupted = error.toLowerCase().includes('stream') && error.toLowerCase().includes('interrupted');
          const isNetworkError = error.toLowerCase().includes('network');
          const isRateLimit = error.includes('429') || error.toLowerCase().includes('rate limit');
          const isSubscription = error.includes('403') || error.toLowerCase().includes('subscription') || error.toLowerCase().includes('plan') || error.toLowerCase().includes('tier') || error.toLowerCase().includes('limit');

          return (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-800">{error}</p>
                {isRateLimit && (
                  <div className="flex items-center gap-2 text-orange-700 text-sm">
                    <span>Rate limit hit. Try again{countdown !== null ? ` in ${countdown}s` : ''}.</span>
                  </div>
                )}
                {isStreamingInterrupted && (
                  <div className="flex items-center gap-2 text-orange-700 text-sm">
                    <span>Streaming interrupted. Please retry.</span>
                  </div>
                )}
                {isNetworkError && (
                  <div className="flex items-center gap-2 text-orange-700 text-sm">
                    <span>Network error. Please check your connection.</span>
                  </div>
                )}
                {isSubscription && (
                  <div className="flex items-center gap-2 text-orange-700 text-sm">
                    <span>Subscription or plan limit reached.</span>
                  </div>
                )}
                {onRetry && (
                  <button onClick={onRetry} className="mt-2 px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition">Retry</button>
                )}
              </div>
            </div>
          );
        }
        {/* Error banner */}
        {error && (
          <EnhancedErrorBanner error={error} onRetry={onRetryStreaming} />
        )}

// Enhanced error banner component
const EnhancedErrorBanner: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (error.includes('429') || error.toLowerCase().includes('rate limit')) {
      // Extract seconds from error message if present, else default to 30
      const match = error.match(/(\d+)(s| seconds?)/i);
      const seconds = match ? parseInt(match[1], 10) : 30;
      setCountdown(seconds);
      if (seconds > 0) {
        const interval = setInterval(() => {
          setCountdown((c) => (c && c > 0 ? c - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
      }
    } else {
      setCountdown(null);
    }
  }, [error]);

  // Streaming interruption detection
  const isStreamingInterrupted = error.toLowerCase().includes('stream') && error.toLowerCase().includes('interrupted');
  const isNetworkError = error.toLowerCase().includes('network');
  const isRateLimit = error.includes('429') || error.toLowerCase().includes('rate limit');
  const isSubscription = error.includes('403') || error.toLowerCase().includes('subscription') || error.toLowerCase().includes('plan') || error.toLowerCase().includes('tier') || error.toLowerCase().includes('limit');

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-800">{error}</p>
        {isRateLimit && (
          <div className="flex items-center gap-2 text-orange-700 text-sm">
            <span>Rate limit hit. Try again{countdown !== null ? ` in ${countdown}s` : ''}.</span>
          </div>
        )}
        {isSubscription && (
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('navigateToSubscription'));
              }
            }}
            className="text-sm text-orange-600 hover:text-orange-800 underline font-medium self-start mt-1"
          >
            Upgrade your plan →
          </button>
        )}
        {isNetworkError && (
          <button
            onClick={onRetry}
            className="text-sm text-blue-600 hover:text-blue-800 underline font-medium self-start mt-1"
          >
            Retry
          </button>
        )}
        {isStreamingInterrupted && (
          <span className="text-xs text-orange-700">Response interrupted. Partial answer shown above.</span>
        )}
      </div>
    </div>
  );
};

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
