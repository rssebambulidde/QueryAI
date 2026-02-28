'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { Message, MessageVersionSummary } from './chat-message';
import type { RAGSettings } from './rag-source-selector';
import { conversationApi, queueApi, attachmentApi, QuestionRequest, Source } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useConversationStore } from '@/lib/store/conversation-store';
import { useFilterStore } from '@/lib/store/filter-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useMobile } from '@/lib/hooks/use-mobile';
// Topic/document UI retired in Phase 2 (v2 migration)
// import { ResearchModeBanner } from './research-mode-banner';
// import { ResearchSessionSummaryModal } from './research-session-summary-modal';
import type { StreamingState } from './streaming-controls';
import { CitationSettings } from './citation-settings';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';

import { mapApiMessagesToUi, type ApiMessage, type LastResponseData, type ChatAttachment } from './chat-types';
import { ChatMessageList } from './chat-message-list';
import { ChatInputArea } from './chat-input-area';
import { SourcesSidebar } from './sources-sidebar';
import { MessageVersionCompare } from './message-version-compare';
import { ChatErrorBoundary } from './chat-error-boundary';
import { ConversationExportDialog } from './conversation-export-dialog';
// Chat shortcut UI removed from this component
import { useChatSend } from '@/lib/hooks/useChatSend';
import {
  DEFAULT_CONVERSATION_MODE,
  getModeSearchFlags,
  type ConversationMode,
} from '@/lib/chat/mode-config';
// Document upload retired in Phase 2 (v2 migration)
// import { useDocumentUpload } from '@/lib/hooks/use-document-upload';
import type { UploadStatus } from './chat-types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ChatContainerProps {
  ragSettings?: RAGSettings;
}

type SavedAttachmentMeta = {
  name: string;
  mimeType?: string;
  fileId?: string;
  extractionStatus?: ChatAttachment['extractionStatus'];
  extractedText?: string;
};

type ErrorWithResponse = {
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
      };
    };
  };
  status?: number;
  message?: string;
};

const getErrorStatus = (err: unknown): number | undefined => {
  if (typeof err !== 'object' || err === null) return undefined;
  const withResponse = err as ErrorWithResponse;
  return withResponse.response?.status ?? withResponse.status;
};

const getErrorMessage = (err: unknown): string | undefined => {
  if (err instanceof Error) return err.message;
  if (typeof err !== 'object' || err === null) return undefined;
  const candidate = (err as { message?: unknown }).message;
  return typeof candidate === 'string' ? candidate : undefined;
};

const getApiErrorMessage = (err: unknown): string | undefined => {
  if (typeof err !== 'object' || err === null) return undefined;
  const withResponse = err as ErrorWithResponse;
  return withResponse.response?.data?.error?.message;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const ChatContainer: React.FC<ChatContainerProps> = ({ ragSettings: propRagSettings }) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationMode, setConversationMode] = useState<ConversationMode>(DEFAULT_CONVERSATION_MODE);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>('completed');
  const [error, setError] = useState<string | null>(null);
  const [sourcePanelContext, setSourcePanelContext] = useState<{ sources: Source[]; query: string } | null>(null);
  const [isCitationSettingsOpen, setIsCitationSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Advanced features
  const [queryExpansionEnabled, setQueryExpansionEnabled] = useState(false);
  const [queryExpansionSettings, setQueryExpansionSettings] = useState<QueryExpansionSettings>({
    enableExpansion: false,
    expansionMethod: 'hybrid',
    maxExpansions: 5,
    confidenceThreshold: 0.7,
  });
  const [rerankingEnabled, setRerankingEnabled] = useState(false);
  const [rerankingSettings, setRerankingSettings] = useState<RerankingSettings>({
    enableReranking: false,
    rerankingMethod: 'cross-encoder',
    topK: 10,
    diversityWeight: 0.5,
  });
  const [lastResponseData, setLastResponseData] = useState<LastResponseData | null>(null);
  const [previousTokenUsage, setPreviousTokenUsage] = useState<{ totalTokens: number } | null>(null);
  const [previousCost, setPreviousCost] = useState<{ total: number } | null>(null);

  // External stores & hooks
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const { user } = useAuthStore();
  const {
    currentConversationId,
    conversationSelectionVersion,
    createConversation,
    selectConversation,
    refreshConversations,
    conversations,
    updateConversationFilters,
    updateConversation,
  } = useConversationStore();
  const { unifiedFilters, setUnifiedFilters } = useFilterStore();

  // RAG settings — document search always disabled (Phase 2)
  const [ragSettings, setRagSettings] = useState<RAGSettings>(() => {
    if (propRagSettings) return { ...propRagSettings, enableDocumentSearch: false };
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ragSettings');
      if (saved) {
        try { return { ...JSON.parse(saved), enableDocumentSearch: false }; } catch { /* use defaults */ }
      }
    }
    return { enableDocumentSearch: false, enableWebSearch: true, maxDocumentChunks: 5, minScore: 0.5, maxWebResults: 5 };
  });

  // const [showResearchSummaryModal, setShowResearchSummaryModal] = useState(false);
  const [compareVersions, setCompareVersions] = useState<MessageVersionSummary[] | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const [dynamicStarters, setDynamicStarters] = useState<string[] | null>(null);
  // Document state retired in Phase 2 (v2 migration)
  const [inlineUploadStatus, setInlineUploadStatus] = useState<UploadStatus | null>(null);
  const [, setLastUploadFile] = useState<File | null>(null);
  const conversationLoadRequestRef = useRef(0);
  const conversationLoadPrevIdRef = useRef<string | null>(null);
  /** Conversation-level attachments — re-sent with every follow-up message. */
  const [conversationAttachments, setConversationAttachments] = useState<ChatAttachment[]>([]);

  // ── Document drag-and-drop upload (retired in Phase 2) ────────────────

  const handleFilesDrop = async (files: File[]) => {
    void files;
    // Document upload retired in Phase 2
  };

  // Handle file selection from ChatInput
  const handleFileSelect = async (file: File) => {
    void file;
    // Document upload retired in Phase 2
  };

  // Cancel current upload
  const handleCancelUpload = () => {
    setInlineUploadStatus(null);
    setLastUploadFile(null);
  };

  // Retry failed upload
  const handleRetryUpload = async () => {
    // Document upload retired in Phase 2
  };

  // Handle multiple files selection
  const handleFilesSelect = async (files: File[]) => {
    void files;
    // Document upload retired in Phase 2
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Send / streaming hook
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    sendMessage: handleSend,
    cancelStream: handleCancelStreaming,
    pauseStream: handlePauseStreaming,
    resumeStream: handleResumeStreaming,
    retryStream: handleRetryStreaming,
    editMessage: handleEditMessage,
    regenerateMessage: handleRegenerateMessage,
  } = useChatSend({
    messages,
    currentConversationId,
    unifiedFilters,
    ragSettings,
    conversationMode,
    queryExpansionEnabled,
    queryExpansionSettings,
    rerankingEnabled,
    rerankingSettings,
    setMessages,
    setIsLoading,
    setIsStreaming,
    setStreamingState,
    setError,
    setUnifiedFilters,
    setLastResponseData,
    setPreviousTokenUsage,
    setPreviousCost,
    createConversation,
    selectConversation,
    updateConversationFilters,
    updateConversation,
    refreshConversations,
    toast,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Derived values
  // ═══════════════════════════════════════════════════════════════════════════

  const firstName =
    user?.full_name?.trim().split(/\s+/)[0] ||
    (user?.email ? user.email.split('@')[0].replace(/[._-]/g, ' ').split(' ')[0] : null);
  const displayFirstName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : null;

  const welcomeGreeting = (() => {
    const name = displayFirstName || 'there';
    const h = new Date().getHours();
    const isReturning = conversations.length > 0;
    const seed = (h + new Date().getDate()) % 3;
    if (isReturning) {
      const options = [
        `Nice to see you back, ${name}!`,
        `Welcome back, ${name}!`,
        h < 12 ? `Good morning, ${name}!` : h < 17 ? `Good afternoon, ${name}!` : `Good evening, ${name}!`,
      ];
      return options[seed];
    }
    const options = [
      `Hi ${name}!`,
      h < 12 ? `Good morning, ${name}!` : h < 17 ? `Good afternoon, ${name}!` : `Good evening, ${name}!`,
      h < 12 ? `Good morning, ${name}!` : h < 17 ? `Good afternoon, ${name}!` : `Good evening, ${name}!`,
    ];
    return options[seed];
  })();

  const isEmpty = messages.length === 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════════════════════

  // Sync propRagSettings
  useEffect(() => {
    if (propRagSettings) setRagSettings(propRagSettings);
  }, [propRagSettings]);

  // Fetch dynamic starters (disabled — topics retired in Phase 2)
  useEffect(() => {
    setDynamicStarters(null);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Topic-change messages (disabled — topics retired in Phase 2)

  // Load conversation data
  useEffect(() => {
    const requestId = ++conversationLoadRequestRef.current;
    const isStale = () => requestId !== conversationLoadRequestRef.current;

    const loadConversationData = async () => {
      if (currentConversationId) {
        setConversationLoading(true);
        // Guard: if conversations are loaded and the persisted ID isn't among them,
        // it's stale (e.g. from a previous session/user). Clear it instead of fetching.
        if (conversations.length > 0 && !conversations.some(c => c.id === currentConversationId)) {
          console.warn('[ChatContainer] Stale conversationId detected, clearing:', currentConversationId);
          selectConversation(null);
          setConversationLoading(false);
          return;
        }

        setSourcePanelContext(null);
        // Only clear conversation attachments when switching to a genuinely different conversation.
        // When re-selecting the same conversation (e.g. after stream completes), preserve them.
        const prevId = conversationLoadPrevIdRef.current;
        if (currentConversationId !== prevId) {
          setConversationAttachments([]);
        }
        conversationLoadPrevIdRef.current = currentConversationId;
        try {
          const messagesResponse = await conversationApi.getMessages(currentConversationId);
          const conversationResponse = await conversationApi.get(currentConversationId);

          if (!isStale() && messagesResponse.success && messagesResponse.data) {
            let loadedMessages = mapApiMessagesToUi(messagesResponse.data as ApiMessage[]);

            // Restore persisted document attachments and inject into user messages
            const conversation = conversationResponse.success ? conversationResponse.data : null;
            const saved = (conversation?.metadata?.savedAttachments ?? []) as SavedAttachmentMeta[];
            if (saved.length > 0) {
              const restoredAttachments: ChatAttachment[] = saved.map((s, i) => ({
                id: `saved-${i}-${s.name}`,
                type: 'document' as const,
                name: s.name,
                mimeType: s.mimeType || 'application/octet-stream',
                size: 0,
                data: '', // no base64 — backend has the extracted text in metadata
                fileId: s.fileId,
                extractionStatus: s.extractionStatus || 'success',
                extractionChars: s.extractedText?.length ?? 0,
              }));
              setConversationAttachments(restoredAttachments);

              // Inject attachment indicators into user message bubbles
              loadedMessages = loadedMessages.map((m) =>
                m.role === 'user' && !m.attachments?.length
                  ? { ...m, attachments: restoredAttachments }
                  : m
              );
            }

            setMessages(loadedMessages);
            setConversationLoading(false);

            if (conversation) {
              // Set conversation mode from DB
              if (!isStale()) { setConversationMode(conversation.mode || DEFAULT_CONVERSATION_MODE); }
              // Topic hydration retired in Phase 2
              const oldFilters = conversation.metadata?.filters || {};
              if (!isStale()) {
                setUnifiedFilters({
                  timeRange: oldFilters.timeRange,
                  startDate: oldFilters.startDate,
                  endDate: oldFilters.endDate,
                  country: oldFilters.country,
                });
              }
            }
          }
        } catch (err: unknown) {
          if (!isStale()) {
            // If 404/403, the conversation doesn't exist or belong to this user — clear it silently
            const status = getErrorStatus(err);
            if (status === 404 || status === 403) {
              console.warn('[ChatContainer] Conversation not found/forbidden, clearing:', currentConversationId);
              selectConversation(null);
              setConversationLoading(false);
              return;
            }
            console.error('Failed to load conversation:', err);
            toast.error('Failed to load conversation data');
            setMessages([]);
            setUnifiedFilters({});
            setConversationLoading(false);
          }
        }
      } else {
        if (isStale()) return;
        setMessages([]);
        setConversationMode(DEFAULT_CONVERSATION_MODE);
        setUnifiedFilters({});
        setSourcePanelContext(null);
        setConversationAttachments([]);
        conversationLoadPrevIdRef.current = null;
        setConversationLoading(false);
      }
    };
    loadConversationData();
    return () => {
      conversationLoadRequestRef.current += 1;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId, conversationSelectionVersion, setUnifiedFilters]);

  // Persist RAG settings
  useEffect(() => {
    if (typeof window !== 'undefined' && !propRagSettings) {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings, propRagSettings]);

  // Document count loading retired in Phase 2

  // ═══════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  // ── /search command ────────────────────────────────────────────────────

  // handleSemanticSearch retired in v2 (document search removed)

  // ── Queue-based async send ──────────────────────────────────────────────

  const [activeQueueJobId, setActiveQueueJobId] = useState<string | null>(null);

  const handleQueueSend = async (content: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Your request has been queued for processing...',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const modeFlags = getModeSearchFlags(conversationMode);
      const request: QuestionRequest = {
        question: content,
        conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        conversationId: currentConversationId ?? undefined,
        mode: modeFlags.mode,
        enableSearch: modeFlags.enableSearch,
        enableWebSearch: modeFlags.enableWebSearch,
        topic: unifiedFilters.keyword,
        timeRange: unifiedFilters.timeRange,
        startDate: unifiedFilters.startDate,
        endDate: unifiedFilters.endDate,
        country: unifiedFilters.country,
        maxSearchResults: ragSettings.maxWebResults,
      };

      const response = await queueApi.submit(request, 'normal');
      if (!response.success || !response.data?.jobId) {
        throw new Error(response.message || 'Failed to queue request');
      }

      const jobId = response.data.jobId;
      setActiveQueueJobId(jobId);

      // Poll for status
      let completed = false;
      let pollCount = 0;
      const maxPolls = 120; // ~2 minutes at 1s intervals

      while (!completed && pollCount < maxPolls) {
        await new Promise((r) => setTimeout(r, 1000));
        pollCount++;

        try {
          const statusResponse = await queueApi.getStatus(jobId);
          const status = statusResponse.data;
          if (!status) continue;

          if (status.state === 'completed' && status.result) {
            const answer = status.result.answer || 'No answer generated.';
            setMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = {
                ...u[u.length - 1],
                content: answer,
                sources: status.result!.sources,
                isStreaming: false,
              };
              return u;
            });
            completed = true;
          } else if (status.state === 'failed') {
            throw new Error('Queue job failed');
          } else {
            // Update progress
            const progress = status.progress ?? 0;
            setMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = {
                ...u[u.length - 1],
                content: `Processing your request... ${progress > 0 ? `(${progress}%)` : ''}`,
              };
              return u;
            });
          }
        } catch (pollErr) {
          console.error('Queue poll error:', pollErr);
        }
      }

      if (!completed) {
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = { ...u[u.length - 1], content: 'Request is taking longer than expected. It will complete in the background.', isStreaming: false };
          return u;
        });
      }
    } catch (err: unknown) {
      console.error('Queue send failed:', err);
      const baseError = getErrorMessage(err);
      const status = getErrorStatus(err);
      let errorMsg = baseError || 'Failed to queue request.';
      if (status === 429) {
        errorMsg = 'Rate limit exceeded. Try again in 30s.';
      } else if (status === 403) {
        errorMsg = getApiErrorMessage(err) || 'Subscription limit reached. Upgrade your plan to continue.';
      } else if (baseError?.toLowerCase().includes('network')) {
        errorMsg = 'Network error. Please check your connection and retry.';
      } else if (baseError?.toLowerCase().includes('stream')) {
        errorMsg = 'Streaming failure. Response interrupted.';
      }
      setError(errorMsg);
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = { ...u[u.length - 1], content: errorMsg, isStreaming: false };
        return u;
      });
    } finally {
      setIsLoading(false);
      setActiveQueueJobId(null);
    }
  };

  const handleCancelQueueJob = async () => {
    if (!activeQueueJobId) return;
    try {
      await queueApi.cancel(activeQueueJobId);
      toast.success('Queued request cancelled');
      setMessages((prev) => prev.slice(0, -1));
    } catch (err) {
      console.error('Failed to cancel queue job:', err);
      toast.error('Failed to cancel request');
    }
    setActiveQueueJobId(null);
    setIsLoading(false);
  };

  // handleDocumentDelete retired in Phase 2

  /** Remove a single conversation-level attachment (local state + DB metadata + storage).
   *  Accepts an ID or a fileId — the inline strip may pass an ID that differs from the
   *  conversation-level copy, so we fall back to fileId or name matching.
   */
  const removeConversationAttachment = useCallback(async (id: string) => {
    // Find by id first, then fall back to fileId match
    const removed = conversationAttachments.find((a) => a.id === id)
      || conversationAttachments.find((a) => a.fileId && a.fileId === id);

    // Update local state immediately — remove by id OR by fileId/name
    setConversationAttachments((prev) => {
      if (removed) {
        return prev.filter((a) => a.id !== removed.id);
      }
      return prev.filter((a) => a.id !== id);
    });

    // Delete from Supabase Storage + chat_attachments DB row
    if (removed?.fileId) {
      try {
        await attachmentApi.delete(removed.fileId);
      } catch (err) {
        console.warn('[ChatContainer] Failed to delete attachment from server:', err);
      }
    }

    // Persist removal to backend conversation metadata
    if (currentConversationId && removed) {
      try {
        const conversation = await conversationApi.get(currentConversationId);
        if (conversation.success && conversation.data) {
          const dataWithMeta = conversation.data as {
            metadata?: {
              savedAttachments?: SavedAttachmentMeta[];
            };
          };
          const savedAttachments = (dataWithMeta.metadata?.savedAttachments || []).filter(
            (s) => s.name !== removed.name,
          );
          await conversationApi.update(currentConversationId, {
            metadata: { savedAttachments },
          });
        }
      } catch (err) {
        console.error('Failed to remove attachment from conversation metadata:', err);
      }
    }
  }, [conversationAttachments, currentConversationId]);

  /** Intercepts /queue commands, otherwise delegates to the send hook */
  const handleUserInput = async (content: string, attachments?: ChatAttachment[]) => {
    const queueMatch = content.match(/^\/queue\s+(.+)/i);
    if (queueMatch) {
      await handleQueueSend(queueMatch[1].trim());
      return;
    }

    // Store any new inline attachments at the conversation level for follow-ups
    if (attachments && attachments.length > 0) {
      setConversationAttachments((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newOnes = attachments.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newOnes].slice(0, 5); // cap at INLINE_MAX_COUNT
      });
    }

    await handleSend(content, undefined, undefined, attachments);
  };



  // Research mode retired in v2

  // ── Mode change with DB persistence ────────────────────────────────────

  const handleModeChange = useCallback((newMode: ConversationMode) => {
    setConversationMode(newMode);
    // Persist mode to DB for the active conversation so it survives reloads
    if (currentConversationId) {
      conversationApi.update(currentConversationId, { mode: newMode }).catch((err) => {
        console.error('Failed to persist mode change:', err);
      });
    }
  }, [currentConversationId]);

  // ── Delete message (optimistic) ──────────────────────────────────────────

  const handleDeleteMessage = async (messageId: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const deletedMessage = messages[idx];
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (currentConversationId) {
      try {
        await conversationApi.deleteMessage(currentConversationId, messageId);
      } catch (err) {
        console.error('Failed to delete message:', err);
        toast.error('Failed to delete message');
        setMessages((prev) => { const u = [...prev]; u.splice(idx, 0, deletedMessage); return u; });
      }
    }
  };

  // ── Version history ───────────────────────────────────────────────────

  const handleVersionSelect = (messageId: string, version: MessageVersionSummary) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return { ...m, content: version.content, sources: version.sources, version: version.version };
      }),
    );
  };

  const handleCompareVersions = (_messageId: string, versions: MessageVersionSummary[]) => {
    setCompareVersions(versions);
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  // Keyboard shortcuts removed for the chat UI (feature intentionally disabled)

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ResearchModeBanner retired in Phase 2 */}

      {/* Loading state: conversation selected but messages not yet loaded */}
      {isEmpty && currentConversationId && conversationLoading && (
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading conversation…</p>
          </div>
        </div>
      )}

      {/* Empty state: input area with inline mode dropup */}
      {isEmpty && !currentConversationId && (
        <ChatInputArea
          variant="empty"
          mode={conversationMode}
          onModeChange={handleModeChange}
          onSend={(msg, attachments) => handleUserInput(msg, attachments)}
          disabled={isLoading || isStreaming}
          dynamicStarters={dynamicStarters}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onOpenCitationSettings={() => setIsCitationSettingsOpen(true)}
          welcomeGreeting={welcomeGreeting}
          onFilesDrop={handleFilesDrop}
          uploadStatus={inlineUploadStatus}
          onDismissUpload={() => { setInlineUploadStatus(null); setLastUploadFile(null); }}
          onFileSelect={handleFileSelect}
          onFilesSelect={handleFilesSelect}
          onCancelUpload={handleCancelUpload}
          onRetryUpload={handleRetryUpload}
          onSendToQueue={handleQueueSend}
          activeQueueJobId={activeQueueJobId}
          onCancelQueueJob={handleCancelQueueJob}
          ragSettings={ragSettings}
          onRagSettingsChange={setRagSettings}
          activeConversationAttachments={conversationAttachments}
          onClearConversationAttachment={removeConversationAttachment}
        />
      )}

      {/* Conversation mode */}
      {!isEmpty && (
        <>
          {/* Chat toolbar */}
          <div className="flex items-center justify-end gap-1 px-4 py-1.5 border-b border-gray-100 bg-gray-50/50">
            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Export conversation"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            <ChatErrorBoundary scope="chat">
              <ChatMessageList
                messages={messages}
                isStreaming={isStreaming}
                streamingState={streamingState}
                error={error}
                isMobile={isMobile}
                mode={conversationMode}
                conversationId={currentConversationId ?? undefined}
                lastResponseData={lastResponseData}
                queryExpansionEnabled={queryExpansionEnabled}
                onQueryExpansionEnabledChange={setQueryExpansionEnabled}
                queryExpansionSettings={queryExpansionSettings}
                onQueryExpansionSettingsChange={setQueryExpansionSettings}
                rerankingEnabled={rerankingEnabled}
                onRerankingEnabledChange={setRerankingEnabled}
                rerankingSettings={rerankingSettings}
                onRerankingSettingsChange={setRerankingSettings}
                previousTokenUsage={previousTokenUsage}
                previousCost={previousCost}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onRegenerateMessage={handleRegenerateMessage}
                onVersionSelect={handleVersionSelect}
                onCompareVersions={handleCompareVersions}
                onFollowUpClick={(q) => handleSend(q)}
                onExitResearchMode={() => {}}
                onOpenSources={(sources, query) => setSourcePanelContext({ sources, query })}
                onPauseStreaming={handlePauseStreaming}
                onResumeStreaming={handleResumeStreaming}
                onCancelStreaming={handleCancelStreaming}
                onRetryStreaming={handleRetryStreaming}
                onDismissError={() => setError(null)}
              />
            </ChatErrorBoundary>

            <SourcesSidebar
              sourcePanelContext={sourcePanelContext}
              onClose={() => setSourcePanelContext(null)}
            />
          </div>

          <ChatInputArea
            variant="conversation"
            mode={conversationMode}
            onModeChange={handleModeChange}
            onSend={(msg, attachments) => handleUserInput(msg, attachments)}
            disabled={isLoading || isStreaming}
            dynamicStarters={dynamicStarters}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onOpenCitationSettings={() => setIsCitationSettingsOpen(true)}
            onFilesDrop={handleFilesDrop}
            uploadStatus={inlineUploadStatus}
            onDismissUpload={() => { setInlineUploadStatus(null); setLastUploadFile(null); }}
            onFileSelect={handleFileSelect}
            onFilesSelect={handleFilesSelect}
            onCancelUpload={handleCancelUpload}
            onRetryUpload={handleRetryUpload}
            onSendToQueue={handleQueueSend}
            activeQueueJobId={activeQueueJobId}
            onCancelQueueJob={handleCancelQueueJob}          ragSettings={ragSettings}
          onRagSettingsChange={setRagSettings}
          activeConversationAttachments={conversationAttachments}
          onClearConversationAttachment={removeConversationAttachment}
          />
        </>
      )}

      {/* Modals */}
      <CitationSettings isOpen={isCitationSettingsOpen} onClose={() => setIsCitationSettingsOpen(false)} />
      {compareVersions && (
        <MessageVersionCompare versions={compareVersions} onClose={() => setCompareVersions(null)} />
      )}
      {isExportOpen && currentConversationId && (() => {
        const conv = conversations.find(c => c.id === currentConversationId);
        return conv ? (
          <ConversationExportDialog
            conversation={conv}
            messageCount={messages.length}
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
          />
        ) : null;
      })()}
    </div>
  );
};
