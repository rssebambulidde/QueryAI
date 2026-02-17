'use client';

import React from 'react';
import type { RAGSettings } from './rag-source-selector';
import { ChatContainer } from './chat-container';

interface ChatInterfaceProps {
  ragSettings?: RAGSettings;
}

/**
 * Thin wrapper — delegates entirely to ChatContainer.
 *
 * Kept as the public export so existing imports throughout the app
 * continue to work without a migration.
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({ ragSettings }) => {
  return <ChatContainer ragSettings={ragSettings} />;
};
