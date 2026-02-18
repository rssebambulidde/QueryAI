'use client';

import React from 'react';
import { ChatInput } from './chat-input';
import { ResearchModeBar } from './research-mode-bar';
import { MessageSquare, FileText, Loader2 } from 'lucide-react';
import type { ChatInputAreaProps } from './chat-types';
import { cn } from '@/lib/utils';

/**
 * Chat input area — used in two layouts:
 *
 *  • `variant="empty"` — centred greeting + starters + input (empty state)
 *  • `variant="conversation"` — sticky bottom bar with citation button,
 *     starters, and the input field
 */
export const ChatInputArea: React.FC<
  ChatInputAreaProps & { welcomeGreeting?: string }
> = ({
  onSend,
  disabled,
  selectedTopic,
  dynamicStarters,
  isLoading,
  isStreaming,
  onOpenCitationSettings,
  variant,
  welcomeGreeting,
  documentInfo,
  onFilesDrop,
  uploadStatus,
  onDismissUpload,
  onFileSelect,
  onFilesSelect,
  onCancelUpload,
  onRetryUpload,
  showQueueOption,
  onSendToQueue,
  activeQueueJobId,
  onCancelQueueJob,
}) => {
  const docStatus = documentInfo && documentInfo.processedCount > 0
    ? `Searching across ${documentInfo.processedCount} document${documentInfo.processedCount !== 1 ? 's' : ''}`
    : documentInfo && documentInfo.totalCount > 0
      ? 'Documents processing...'
      : null;
  // ── Empty-state variant ──────────────────────────────────────────────────
  if (variant === 'empty') {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Greeting */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full mb-4">
              <MessageSquare className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              {welcomeGreeting ?? 'Hi there!'}
            </h3>
            <p className="text-gray-500">
              I can search your documents and the web to provide comprehensive answers with sources.
            </p>
            {docStatus && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-400">
                {documentInfo!.processingCount > 0 ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {selectedTopic ? `Topic: ${selectedTopic.name} \u2014 ${docStatus}` : docStatus}
                {documentInfo!.processingCount > 0 && (
                  <span className="text-amber-500">({documentInfo!.processingCount} processing)</span>
                )}
              </div>
            )}
          </div>

          {/* Research-mode starters (centred) */}
          <ResearchModeBar
            selectedTopic={selectedTopic}
            dynamicStarters={dynamicStarters}
            onSend={onSend}
            isLoading={isLoading}
            isStreaming={isStreaming}
            centered
            className="px-4 pt-1 pb-2"
          />

          {/* Centred input */}
          <ChatInput
            onSend={onSend}
            disabled={disabled}
            placeholder="Ask me anything..."
            showQueueOption={showQueueOption}
            onSendToQueue={onSendToQueue}
            activeQueueJobId={activeQueueJobId}
            onCancelQueueJob={onCancelQueueJob}
            onFileSelect={onFileSelect}
            onFilesSelect={onFilesSelect}
            uploadStatus={uploadStatus}
            onCancelUpload={onCancelUpload}
            onRetryUpload={onRetryUpload}
            onDismissUpload={onDismissUpload}
          />
        </div>
      </div>
    );
  }

  // ── Conversation-mode variant (bottom bar) ───────────────────────────────
  return (
    <div className="bg-white border-t border-gray-200 shadow-lg relative flex justify-center">
      <div className="w-full max-w-3xl mx-auto px-4 pb-4">
        {/* Document status */}
        {docStatus && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 px-4 pt-2 pb-1">
            {documentInfo!.processingCount > 0 ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileText className="w-3 h-3" />
            )}
            {selectedTopic ? `Topic: ${selectedTopic.name} \u2014 ${docStatus}` : docStatus}
            {documentInfo!.processingCount > 0 && (
              <span className="text-amber-500">({documentInfo!.processingCount} processing)</span>
            )}
          </div>
        )}

        {/* Research-mode starters (horizontal scroll) */}
        <ResearchModeBar
          selectedTopic={selectedTopic}
          dynamicStarters={dynamicStarters}
          onSend={onSend}
          isLoading={isLoading}
          isStreaming={isStreaming}
          className="px-4 pt-3 pb-1"
        />

        <ChatInput
          onSend={onSend}
          disabled={disabled}
          placeholder="Ask me anything..."
          showQueueOption={showQueueOption}
          onSendToQueue={onSendToQueue}
          activeQueueJobId={activeQueueJobId}
          onCancelQueueJob={onCancelQueueJob}
          onFileSelect={onFileSelect}
          onFilesSelect={onFilesSelect}
          uploadStatus={uploadStatus}
          onCancelUpload={onCancelUpload}
          onRetryUpload={onRetryUpload}
          onDismissUpload={onDismissUpload}
        />
      </div>
    </div>
  );
};
