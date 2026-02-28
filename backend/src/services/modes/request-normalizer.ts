import { type ConversationMode, resolveModeSearchFlags } from './mode-config';

export interface ModeNormalizationInput {
  mode?: ConversationMode;
  enableSearch?: boolean;
  enableWebSearch?: boolean;
}

export interface ModeNormalizationResult {
  mode: ConversationMode;
  enableSearch: boolean;
  enableWebSearch: boolean;
}

/**
 * Enforce server-authoritative mode behavior:
 * - Missing/invalid mode defaults to chat.
 * - Chat mode always disables search and web search.
 * - Research mode enables search by default unless explicitly disabled.
 */
export function normalizeModeAndSearchFlags(
  input: ModeNormalizationInput
): ModeNormalizationResult {
  return resolveModeSearchFlags(input);
}
