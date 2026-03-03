'use client';

import { ChatInput } from './chat-input';
import { Search, MessageCircle } from 'lucide-react';
import type { ChatInputAreaProps } from './chat-types';
import { cn } from '@/lib/utils';
import { useMobileNavStore } from '@/lib/store/mobile-nav-store';

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
  variant,
  welcomeGreeting,
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
  onModeChange,
  activeConversationAttachments,
  onClearConversationAttachment,
}) => {
    const isChatMode = mode === 'chat';
    const webEnabled = ragSettings?.enableWebSearch !== false;
    const isNavVisible = useMobileNavStore((state) => state.isNavVisible);

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
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Greeting */}
            <div className="text-center mb-8">
              <div className={cn(
                'inline-flex items-center justify-center w-16 h-16 rounded-full mb-4',
                isChatMode
                  ? 'bg-gradient-to-br from-purple-100 to-purple-200'
                  : 'bg-gradient-to-br from-blue-100 to-blue-200'
              )}>
                {isChatMode
                  ? <MessageCircle className="w-8 h-8 text-purple-600" />
                  : <Search className="w-8 h-8 text-blue-600" />
                }
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                {welcomeGreeting ?? 'Hi there!'}
              </h3>
              <p className="text-gray-500">
                {isChatMode
                  ? 'Fast AI answers — quick and conversational.'
                  : 'In-depth research with cited sources and web search.'
                }
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
              onModeChange={onModeChange}
              activeConversationAttachments={activeConversationAttachments}
              onClearConversationAttachment={onClearConversationAttachment}
              minHeight={120}
            />
          </div>
        </div>
      );
    }

    // ── Conversation-mode variant (bottom bar) ───────────────────────────────
    return (
      <div
        className={cn(
          "bg-white border-t border-gray-200 shadow-lg relative flex justify-center flex-shrink-0 transition-transform duration-300",
          !isNavVisible && "translate-y-14" // Translate down by the bottom nav's height (3.5rem/56px) so it touches the bottom of the screen
        )}
      >
        <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 pb-2 sm:pb-4">
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
            onModeChange={onModeChange}
            activeConversationAttachments={activeConversationAttachments}
            onClearConversationAttachment={onClearConversationAttachment}
          />
        </div>
      </div>
    );
  };
