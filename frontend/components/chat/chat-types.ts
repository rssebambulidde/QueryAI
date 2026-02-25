/**
 * Shared types and utilities for the chat interface components.
 *
 * Centralises the ApiMessage shape, the UI-message mapper, and
 * common prop interfaces so every sub-component can import from
 * a single location without circular dependencies.
 */

import type { Source, QuestionResponse } from '@/lib/api';
import type { Message, RegenerateOptions, MessageVersionSummary } from './chat-message';
import type { StreamingState } from './streaming-controls';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';
import type { UnifiedFilters } from './unified-filter-panel';
import type { RAGSettings } from './rag-source-selector';

// ─── Inline chat attachment ──────────────────────────────────────────────────

/** An ephemeral file/image attached to a single chat message (never persisted to storage). */
export interface ChatAttachment {
  id: string;
  /** 'image' for images, 'document' for PDF/DOC/TXT/CSV */
  type: 'image' | 'document';
  name: string;
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Base64-encoded file data (data URI for images, raw base64 for docs) */
  data: string;
  /** Object URL for local preview — only valid in the browser session */
  previewUrl?: string;
  /** Server-side attachment ID from upload-then-reference flow */
  fileId?: string;
  /** Extraction result from the backend (set after SSE extractionStatus event) */
  extractionStatus?: 'success' | 'truncated' | 'failed';
  /** Number of characters extracted (0 for failed) */
  extractionChars?: number;
  /** Human-readable reason (populated for truncated/failed) */
  extractionReason?: string;
}

/** Per-file extraction status item received via SSE. */
export interface ExtractionStatusItem {
  name: string;
  status: 'success' | 'truncated' | 'failed';
  chars: number;
  reason?: string;
}

// ─── Shared regex / helpers ──────────────────────────────────────────────────

/** Regex to extract follow-up questions from assistant response text. */
export const FOLLOW_UP_REGEX =
  /(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i;

/** Parse follow-up questions from raw assistant text, returning cleaned array (max 4). */
export function parseFollowUpQuestions(text: string): { cleanedText: string; questions: string[] } | null {
  const m = text.match(FOLLOW_UP_REGEX);
  if (!m) return null;
  const cleanedText = text.substring(0, m.index).trim();
  const questions = m[1]
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s+/, '').trim())
    .filter((q) => q.length > 0)
    .slice(0, 4);
  return { cleanedText, questions };
}

/**
 * Generate a concise conversation title from a user message.
 * Strips trailing punctuation, truncates at word boundary to 60 chars.
 */
export function generateConversationTitle(
  userMessage: string,
  fallbackTopicName?: string | null,
): string {
  let title = userMessage.trim().replace(/[?]+$/, '').trim();
  if (title.length > 60) {
    const cut = title.substring(0, 60).lastIndexOf(' ');
    title = cut > 20 ? title.substring(0, cut) + '...' : title.substring(0, 57) + '...';
  }
  if (!title) title = fallbackTopicName || 'New Conversation';
  return title;
}

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
    qualityScore?: number;
    queryExpansion?: QuestionResponse['queryExpansion'];
    reranking?: QuestionResponse['reranking'];
    contextChunks?: QuestionResponse['contextChunks'];
    selectionReasoning?: string;
    usage?: QuestionResponse['usage'];
    cost?: QuestionResponse['cost'];
    versions?: MessageVersionSummary[];
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  version?: number;
  parent_message_id?: string | null;
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
      const parsed = parseFollowUpQuestions(content);
      if (parsed) {
        content = parsed.cleanedText;
        followUpQuestions = parsed.questions;
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
      qualityScore: msg.metadata?.qualityScore,
      version: msg.version,
      parentMessageId: msg.parent_message_id,
      versions: msg.metadata?.versions as MessageVersionSummary[] | undefined,
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
  isMobile: boolean;
  /** Current conversation ID for citation click-through tracking. */
  conversationId?: string;
  /** Conversation mode — controls which UI elements are shown per message. */
  mode?: 'research' | 'chat';
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
  onDeleteMessage: (messageId: string) => void;
  onRegenerateMessage: (messageId: string, options?: RegenerateOptions) => void;
  onVersionSelect: (messageId: string, version: MessageVersionSummary) => void;
  onCompareVersions: (messageId: string, versions: MessageVersionSummary[]) => void;
  onFollowUpClick: (question: string) => void;
  onExitResearchMode: () => void;
  onOpenSources: (sources: Source[], query: string) => void;
  // Streaming handlers
  onPauseStreaming: () => void;
  onResumeStreaming: () => void;
  onCancelStreaming: () => void;
  onRetryStreaming: () => void;
  /** Dismiss the error banner. */
  onDismissError?: () => void;
}

export interface DocumentInfo {
  totalCount: number;
  processedCount: number;
  processingCount: number;
}

export interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  /** Estimated time remaining in seconds */
  eta?: number;
  /** Upload speed in bytes per second */
  speed?: number;
}

export interface ChatInputAreaProps {
  onSend: (content: string, attachments?: ChatAttachment[]) => void;
  disabled: boolean;
  dynamicStarters: string[] | null;
  isLoading: boolean;
  isStreaming: boolean;
  onOpenCitationSettings: () => void;
  /** Render the "empty-state" centred variant instead of the bottom-bar variant */
  variant: 'empty' | 'conversation';
  /** Document count information for search status display */
  documentInfo?: DocumentInfo;
  /** Callback when files are dropped onto the input */
  onFilesDrop?: (files: File[]) => void;
  /** Current upload status to display inline */
  uploadStatus?: UploadStatus | null;
  /** Dismiss upload status display */
  onDismissUpload?: () => void;
  /** Callback when user selects a file for upload */
  onFileSelect?: (file: File) => void;
  /** Callback when user selects multiple files for upload */
  onFilesSelect?: (files: File[]) => void;
  /** Cancel current upload */
  onCancelUpload?: () => void;
  /** Retry failed upload */
  onRetryUpload?: () => void;
  /** Whether to show the "Send to queue" option */
  showQueueOption?: boolean;
  /** Callback to send a message via queue */
  onSendToQueue?: (content: string) => void;
  /** Active queue job ID for cancel button */
  activeQueueJobId?: string | null;
  /** Cancel active queue job */
  onCancelQueueJob?: () => void;
  /** RAG settings (web search toggle) */
  ragSettings?: RAGSettings;
  /** Callback to update RAG settings */
  onRagSettingsChange?: (settings: RAGSettings) => void;
  /** Conversation mode — controls which input controls are shown. */
  mode?: 'research' | 'chat';
  /** Callback to change the conversation mode. */
  onModeChange?: (mode: 'research' | 'chat') => void;
  /** Attachments that are active for the entire conversation (persisted across messages). */
  activeConversationAttachments?: ChatAttachment[];
  /** Remove a single conversation-level attachment by ID. */
  onClearConversationAttachment?: (id: string) => void;
}

export interface SourcesSidebarProps {
  sourcePanelContext: { sources: Source[]; query: string } | null;
  onClose: () => void;
  className?: string;
}

export interface ResearchModeBarProps {
  dynamicStarters: string[] | null;
  onSend: (question: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  /** Use centred + wrapping layout (empty-state) vs horizontal scroll (bottom bar) */
  centered?: boolean;
  className?: string;
}
