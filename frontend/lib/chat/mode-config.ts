export type ConversationMode = 'chat' | 'research';

export const DEFAULT_CONVERSATION_MODE: ConversationMode = 'chat';

export const MODE_LABELS: Record<ConversationMode, string> = {
  chat: 'Express',
  research: 'Deep Research',
};

export const MODE_DESCRIPTIONS: Record<ConversationMode, string> = {
  chat: 'Quick answers and conversation',
  research: 'Sources, citations, and web search',
};

export function normalizeConversationMode(mode?: string | null): ConversationMode {
  return mode === 'research' ? 'research' : 'chat';
}

export function isResearchMode(mode?: string | null): mode is 'research' {
  return normalizeConversationMode(mode) === 'research';
}

export function getModeSearchFlags(mode?: string | null): {
  mode: ConversationMode;
  enableSearch: boolean;
  enableWebSearch: boolean;
} {
  const normalizedMode = normalizeConversationMode(mode);
  const research = normalizedMode === 'research';

  return {
    mode: normalizedMode,
    enableSearch: research,
    enableWebSearch: research,
  };
}
