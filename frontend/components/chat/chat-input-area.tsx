'use client';

import React from 'react';
import { ChatInput } from './chat-input';
import { MessageSquare } from 'lucide-react';
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
  ragSettings,
  onRagSettingsChange,
  mode,
}) => {
  const isChatMode = mode === 'chat';
  const webEnabled = ragSettings?.enableWebSearch !== false;

  const handleWebToggle = (enabled: boolean) => {
    if (onRagSettingsChange && ragSettings) {
      onRagSettingsChange({
        ...ragSettings,
        enableWebSearch: enabled,
      });
    }
  };

  // ── Empty-state variant ──────────────────────────────────────────────────
  if (variant === 'empty') {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
          </div>

          {/* Input */}
          <ChatInput
            onSend={onSend}
            disabled={disabled}
            placeholder={isChatMode ? 'Type a message...' : 'Ask me anything...'}
            showQueueOption={isChatMode ? false : showQueueOption}
            onSendToQueue={isChatMode ? undefined : onSendToQueue}
            activeQueueJobId={activeQueueJobId}
            onCancelQueueJob={onCancelQueueJob}
            onFileSelect={isChatMode ? undefined : onFileSelect}
            onFilesSelect={isChatMode ? undefined : onFilesSelect}
            uploadStatus={isChatMode ? null : uploadStatus}
            onCancelUpload={isChatMode ? undefined : onCancelUpload}
            onRetryUpload={isChatMode ? undefined : onRetryUpload}
            onDismissUpload={isChatMode ? undefined : onDismissUpload}
            webEnabled={isChatMode ? undefined : webEnabled}
            onWebToggle={isChatMode ? undefined : handleWebToggle}
            mode={mode}
          />
        </div>
      </div>
    );
  }

  // ── Conversation-mode variant (bottom bar) ───────────────────────────────
  return (
    <div className="bg-white border-t border-gray-200 shadow-lg relative flex justify-center">
      <div className="w-full max-w-4xl mx-auto px-4 pb-4">
        <ChatInput
          onSend={onSend}
          disabled={disabled}
          placeholder={isChatMode ? 'Type a message...' : 'Ask me anything...'}
          showQueueOption={isChatMode ? false : showQueueOption}
          onSendToQueue={isChatMode ? undefined : onSendToQueue}
          activeQueueJobId={activeQueueJobId}
          onCancelQueueJob={onCancelQueueJob}
          onFileSelect={isChatMode ? undefined : onFileSelect}
          onFilesSelect={isChatMode ? undefined : onFilesSelect}
          uploadStatus={isChatMode ? null : uploadStatus}
          onCancelUpload={isChatMode ? undefined : onCancelUpload}
          onRetryUpload={isChatMode ? undefined : onRetryUpload}
          onDismissUpload={isChatMode ? undefined : onDismissUpload}
          webEnabled={isChatMode ? undefined : webEnabled}
          onWebToggle={isChatMode ? undefined : handleWebToggle}
          mode={mode}
        />
      </div>
    </div>
  );
};
