'use client';

import React from 'react';
import { ChatInput } from './chat-input';
import { ResearchModeBar } from './research-mode-bar';
import { MessageSquare, Settings } from 'lucide-react';
import type { ChatInputAreaProps } from './chat-types';

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
}) => {
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
          <ChatInput onSend={onSend} disabled={disabled} placeholder="Ask me anything..." />
        </div>
      </div>
    );
  }

  // ── Conversation-mode variant (bottom bar) ───────────────────────────────
  return (
    <div className="bg-white border-t border-gray-200 shadow-lg relative flex justify-center">
      <div className="w-full max-w-3xl mx-auto px-4 pb-4">
        {/* Citation settings button */}
        <div className="flex items-center justify-end px-4 pt-2 pb-1">
          <button
            onClick={onOpenCitationSettings}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Citation settings"
          >
            <Settings className="w-3.5 h-3.5" />
            Citation Settings
          </button>
        </div>

        {/* Research-mode starters (horizontal scroll) */}
        <ResearchModeBar
          selectedTopic={selectedTopic}
          dynamicStarters={dynamicStarters}
          onSend={onSend}
          isLoading={isLoading}
          isStreaming={isStreaming}
          className="px-4 pt-3 pb-1"
        />

        <ChatInput onSend={onSend} disabled={disabled} placeholder="Ask me anything..." />
      </div>
    </div>
  );
};
