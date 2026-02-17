/**
 * Shared types and utilities for the chat interface components.
 *
 * Centralises the ApiMessage shape, the UI-message mapper, and
 * common prop interfaces so every sub-component can import from
 * a single location without circular dependencies.
 */

import type { Source, QuestionResponse, Topic } from '@/lib/api';
import type { Message } from './chat-message';
import type { StreamingState } from './streaming-controls';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';
import type { UnifiedFilters } from './unified-filter-panel';

// ─── API → UI message mapping ────────────────────────────────────────────────

export type ApiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  metadata?: {
    followUpQuestions?: string[];
    isActionResponse?: boolean;
    actionType?: string;
    isRefusal?: boolean;
    responseTime?: number;
    queryExpansion?: QuestionResponse['queryExpansion'];
    reranking?: QuestionResponse['reranking'];
    contextChunks?: QuestionResponse['contextChunks'];
    selectionReasoning?: string;
    usage?: QuestionResponse['usage'];
    cost?: QuestionResponse['cost'];
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  created_at: string;
};

/**
 * Convert backend API messages into the shape the UI `ChatMessage`
 * component expects.  Also extracts follow-up questions that may be
 * embedded in the assistant's response text.
 */
export function mapApiMessagesToUi(apiMessages: ApiMessage[]): Message[] {
  return apiMessages.map((msg) => {
    let content = msg.content;
    let followUpQuestions: string[] | undefined = msg.metadata?.followUpQuestions;
    if (!followUpQuestions) {
      const followUpMatch = content.match(
        /(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i,
      );
      if (followUpMatch) {
        content = content.substring(0, followUpMatch.index).trim();
        const questionsText = followUpMatch[1];
        followUpQuestions = questionsText
          .split('\n')
          .map((line) => line.replace(/^[-*•]\s+/, '').trim())
          .filter((q) => q.length > 0)
          .slice(0, 4);
      }
    }
    return {
      id: msg.id,
      role: msg.role,
      content,
      timestamp: new Date(msg.created_at),
      sources: msg.sources,
      followUpQuestions,
      isActionResponse: msg.metadata?.isActionResponse,
      isRefusal: msg.metadata?.isRefusal,
      responseTime: msg.metadata?.responseTime,
    };
  });
}

// ─── Shared state shapes ─────────────────────────────────────────────────────

export interface LastResponseData {
  queryExpansion?: QuestionResponse['queryExpansion'];
  reranking?: QuestionResponse['reranking'];
  contextChunks?: QuestionResponse['contextChunks'];
  selectionReasoning?: string;
  usage?: QuestionResponse['usage'];
  cost?: QuestionResponse['cost'];
}

export interface SendOptions {
  isResend?: boolean;
  resendUserMessageId?: string;
  resendHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ─── Component prop interfaces ───────────────────────────────────────────────

export interface ChatMessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingState: StreamingState;
  error: string | null;
  selectedTopic: Topic | null;
  isMobile: boolean;
  // Advanced features
  lastResponseData: LastResponseData | null;
  queryExpansionEnabled: boolean;
  onQueryExpansionEnabledChange: (v: boolean) => void;
  queryExpansionSettings: QueryExpansionSettings;
  onQueryExpansionSettingsChange: (s: QueryExpansionSettings) => void;
  rerankingEnabled: boolean;
  onRerankingEnabledChange: (v: boolean) => void;
  rerankingSettings: RerankingSettings;
  onRerankingSettingsChange: (s: RerankingSettings) => void;
  previousTokenUsage: { totalTokens: number } | null;
  previousCost: { total: number } | null;
  // Message handlers
  onEditMessage: (messageId: string, newContent: string) => void;
  onFollowUpClick: (question: string) => void;
  onExitResearchMode: () => void;
  onOpenSources: (sources: Source[], query: string) => void;
  onActionResponse: (content: string, actionType: string, messageSources?: Source[]) => Promise<void>;
  // Streaming handlers
  onPauseStreaming: () => void;
  onResumeStreaming: () => void;
  onCancelStreaming: () => void;
  onRetryStreaming: () => void;
}

export interface ChatInputAreaProps {
  onSend: (content: string) => void;
  disabled: boolean;
  selectedTopic: Topic | null;
  dynamicStarters: string[] | null;
  isLoading: boolean;
  isStreaming: boolean;
  onOpenCitationSettings: () => void;
  /** Render the "empty-state" centred variant instead of the bottom-bar variant */
  variant: 'empty' | 'conversation';
}

export interface SourcesSidebarProps {
  sourcePanelContext: { sources: Source[]; query: string } | null;
  onClose: () => void;
  className?: string;
}

export interface ResearchModeBarProps {
  selectedTopic: Topic | null;
  dynamicStarters: string[] | null;
  onSend: (question: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  /** Use centred + wrapping layout (empty-state) vs horizontal scroll (bottom bar) */
  centered?: boolean;
  className?: string;
}
