'use client';

import { useEffect, useCallback } from 'react';

export interface ChatKeyboardActions {
  focusInput: () => void;
  sendMessage: () => void;
  cancelStreaming: () => void;
  copyLastResponse: () => void;
  closeModal: () => void;
}

/**
 * Global keyboard shortcuts for the chat interface.
 *
 * Ctrl/Cmd + K       — Focus search / new conversation
 * Ctrl/Cmd + Enter   — Send message (delegates to form submit)
 * Escape             — Cancel streaming or close modals
 * Ctrl/Cmd + Shift + C — Copy last AI response
 */
export function useChatKeyboardShortcuts(
  actions: ChatKeyboardActions,
  enabled = true,
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + K — focus search / new conversation
      if (mod && e.key === 'k') {
        e.preventDefault();
        actions.focusInput();
        return;
      }

      // Ctrl/Cmd + Enter — send message
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        actions.sendMessage();
        return;
      }

      // Escape — cancel streaming, close modals
      if (e.key === 'Escape') {
        actions.cancelStreaming();
        actions.closeModal();
        return;
      }

      // Ctrl/Cmd + Shift + C — copy last AI response
      if (mod && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        actions.copyLastResponse();
        return;
      }
    },
    [actions, enabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/** Data for the shortcut reference card */
export const SHORTCUT_LIST = [
  { keys: ['Ctrl', 'K'], description: 'Focus input / New conversation' },
  { keys: ['Ctrl', 'Enter'], description: 'Send message' },
  { keys: ['Esc'], description: 'Cancel streaming / Close modals' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Copy last AI response' },
] as const;
