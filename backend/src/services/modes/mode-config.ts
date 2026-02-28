export type ConversationMode = 'chat' | 'research';

export interface ModeSearchFlagInput {
  mode?: string;
  enableSearch?: boolean;
  enableWebSearch?: boolean;
}

export interface ModeSearchFlagResult {
  mode: ConversationMode;
  enableSearch: boolean;
  enableWebSearch: boolean;
}

export const DEFAULT_CONVERSATION_MODE: ConversationMode = 'chat';

export function normalizeConversationMode(mode?: string): ConversationMode {
  return mode === 'research' ? 'research' : DEFAULT_CONVERSATION_MODE;
}

export function isResearchMode(mode?: string): mode is 'research' {
  return normalizeConversationMode(mode) === 'research';
}

export function resolveModeSearchFlags(input: ModeSearchFlagInput): ModeSearchFlagResult {
  const mode = normalizeConversationMode(input.mode);

  if (mode === 'chat') {
    return {
      mode,
      enableSearch: false,
      enableWebSearch: false,
    };
  }

  const enableSearch = input.enableSearch !== false;
  const enableWebSearch = enableSearch && input.enableWebSearch !== false;

  return {
    mode,
    enableSearch,
    enableWebSearch,
  };
}
