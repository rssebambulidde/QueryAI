'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import type { Message, MessageVersionSummary } from './chat-message';
import type { RAGSettings } from './rag-source-selector';
import { aiApi, conversationApi, searchApi, queueApi, QuestionRequest, Source } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useConversationStore } from '@/lib/store/conversation-store';
import { useFilterStore } from '@/lib/store/filter-store';
import { useAuthStore } from '@/lib/store/auth-store';
import type { UnifiedFilters } from './unified-filter-panel';
import { useMobile } from '@/lib/hooks/use-mobile';
// Topic/document UI retired in Phase 2 (v2 migration)
// import { ResearchModeBanner } from './research-mode-banner';
// import { ResearchSessionSummaryModal } from './research-session-summary-modal';
import type { StreamingState } from './streaming-controls';
import { CitationSettings } from './citation-settings';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';

import { mapApiMessagesToUi, type ApiMessage, type LastResponseData } from './chat-types';
import { ChatMessageList } from './chat-message-list';
import { ChatInputArea } from './chat-input-area';
import { SourcesSidebar } from './sources-sidebar';
import { MessageVersionCompare } from './message-version-compare';
import { ChatErrorBoundary } from './chat-error-boundary';
import { ConversationExportDialog } from './conversation-export-dialog';
// Chat shortcut UI removed from this component
import { useChatSend } from '@/lib/hooks/useChatSend';
// Document upload retired in Phase 2 (v2 migration)
// import { useDocumentUpload } from '@/lib/hooks/use-document-upload';
import type { UploadStatus } from './chat-types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ChatContainerProps {
  ragSettings?: RAGSettings;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ChatContainer: React.FC<ChatContainerProps> = ({ ragSettings: propRagSettings }) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  const [messages, setMessages] = useState<Message[]>([]);
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
  const { unifiedFilters, setUnifiedFilters, selectedTopic, setSelectedTopic } = useFilterStore();

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
  const [lastUploadFile, setLastUploadFile] = useState<File | null>(null);
  const conversationLoadRequestRef = useRef(0);

  // ── Document drag-and-drop upload (retired in Phase 2) ────────────────

  const handleFilesDrop = async (_files: File[]) => {
    // Document upload retired in Phase 2
  };

  // Handle file selection from ChatInput
  const handleFileSelect = async (_file: File) => {
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
  const handleFilesSelect = async (_files: File[]) => {
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
    previousResponseTimeRef,
  } = useChatSend({
    messages,
    currentConversationId,
    unifiedFilters,
    ragSettings,
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
        setSourcePanelContext(null);
        try {
          const messagesResponse = await conversationApi.getMessages(currentConversationId);
          if (!isStale() && messagesResponse.success && messagesResponse.data) {
            setMessages(mapApiMessagesToUi(messagesResponse.data as ApiMessage[]));
          }
          const conversationResponse = await conversationApi.get(currentConversationId);
          if (!isStale() && conversationResponse.success && conversationResponse.data) {
            const conversation = conversationResponse.data;
            // Topic hydration retired in Phase 2
            if (!isStale()) { setSelectedTopic(null); }
            const oldFilters = conversation.metadata?.filters || {};
            if (!isStale()) {
              setUnifiedFilters({
                topicId: null,
                topic: null,
                keyword: oldFilters.topic,
                timeRange: oldFilters.timeRange,
                startDate: oldFilters.startDate,
                endDate: oldFilters.endDate,
                country: oldFilters.country,
              });
            }
          }
        } catch (err) {
          if (!isStale()) {
            console.error('Failed to load conversation:', err);
            toast.error('Failed to load conversation data');
            setMessages([]);
            setUnifiedFilters({ topicId: null, topic: null });
            setSelectedTopic(null);
          }
        }
      } else {
        if (isStale()) return;
        setMessages([]);
        setUnifiedFilters({ topicId: null, topic: null });
        setSelectedTopic(null);
        setSourcePanelContext(null);
      }
    };
    loadConversationData();
    return () => {
      conversationLoadRequestRef.current += 1;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId, conversationSelectionVersion, setUnifiedFilters, setSelectedTopic]);

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

  const handleSemanticSearch = async (query: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: `/search ${query}`, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchApi.semantic(query, {
        topK: 10,
        topicId: selectedTopic?.id,
        minScore: 0.5,
      });
      const searchResults = (result.data?.results || []).map((r: any) => ({
        id: r.id,
        documentId: r.documentId || r.metadata?.documentId,
        title: r.metadata?.title || r.metadata?.filename || r.title,
        content: r.content || r.metadata?.text || '',
        score: r.score,
      }));
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: searchResults.length > 0
          ? `Found ${searchResults.length} document result${searchResults.length !== 1 ? 's' : ''} for "${query}":`
          : `No documents found matching "${query}". Try a different query or upload more documents.`,
        timestamp: new Date(),
        searchResults: searchResults.length > 0 ? searchResults : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Semantic search failed:', err);
      let errorMsg = err.message || 'Document search failed.';
      if (err.response?.status === 429) {
        errorMsg = 'Rate limit exceeded. Try again in 30s.';
      } else if (err.response?.status === 403) {
        errorMsg = err.response?.data?.error?.message || 'Subscription limit reached. Upgrade your plan to continue.';
      } else if (err.message?.toLowerCase().includes('network')) {
        errorMsg = 'Network error. Please check your connection and retry.';
      }
      setError(errorMsg);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

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
      const request: QuestionRequest = {
        question: content,
        conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        conversationId: currentConversationId ?? undefined,
        enableDocumentSearch: ragSettings.enableDocumentSearch,
        enableWebSearch: ragSettings.enableWebSearch,
        topicId: selectedTopic?.id,
        topic: selectedTopic?.name || unifiedFilters.keyword,
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
    } catch (err: any) {
      console.error('Queue send failed:', err);
      let errorMsg = err.message || 'Failed to queue request.';
      if (err.response?.status === 429) {
        errorMsg = 'Rate limit exceeded. Try again in 30s.';
      } else if (err.response?.status === 403) {
        errorMsg = err.response?.data?.error?.message || 'Subscription limit reached. Upgrade your plan to continue.';
      } else if (err.message?.toLowerCase().includes('network')) {
        errorMsg = 'Network error. Please check your connection and retry.';
      } else if (err.message?.toLowerCase().includes('stream')) {
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

  /** Intercepts /search and /queue commands, otherwise delegates to the send hook */
  const handleUserInput = async (content: string) => {
    const searchMatch = content.match(/^\/search\s+(.+)/i);
    if (searchMatch) {
      await handleSemanticSearch(searchMatch[1].trim());
      return;
    }
    const queueMatch = content.match(/^\/queue\s+(.+)/i);
    if (queueMatch) {
      await handleQueueSend(queueMatch[1].trim());
      return;
    }
    await handleSend(content);
  };

  // Research mode retired in v2

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

      {/* Empty state */}
      {isEmpty && (
        <ChatInputArea
          variant="empty"
          onSend={(msg) => handleUserInput(msg)}
          disabled={isLoading || isStreaming}
          selectedTopic={selectedTopic}
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
                selectedTopic={selectedTopic}
                isMobile={isMobile}
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
              />
            </ChatErrorBoundary>

            <SourcesSidebar
              sourcePanelContext={sourcePanelContext}
              onClose={() => setSourcePanelContext(null)}
            />
          </div>

          <ChatInputArea
            variant="conversation"
            onSend={(msg) => handleUserInput(msg)}
            disabled={isLoading || isStreaming}
            selectedTopic={selectedTopic}
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
