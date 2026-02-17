'use client';

import React, { useRef } from 'react';
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

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-800">{error}</p>
              {(error.includes('limit') ||
                error.includes('subscription') ||
                error.includes('tier') ||
                error.includes('plan')) && (
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
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
