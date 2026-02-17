'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Message } from './chat-message';
import type { RAGSettings } from './rag-source-selector';
import { aiApi, conversationApi, topicApi, documentApi, searchApi, queueApi, QuestionRequest, Source } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useConversationStore } from '@/lib/store/conversation-store';
import { useFilterStore } from '@/lib/store/filter-store';
import { useAuthStore } from '@/lib/store/auth-store';
import type { UnifiedFilters } from './unified-filter-panel';
import { useMobile } from '@/lib/hooks/use-mobile';
import { ResearchModeBanner } from './research-mode-banner';
import { ResearchSessionSummaryModal } from './research-session-summary-modal';
import type { StreamingState } from './streaming-controls';
import { CitationSettings } from './citation-settings';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';

import { mapApiMessagesToUi, type ApiMessage, type LastResponseData } from './chat-types';
import { ChatMessageList } from './chat-message-list';
import { ChatInputArea } from './chat-input-area';
import { SourcesSidebar } from './sources-sidebar';
import { ConversationExportDialog } from './conversation-export-dialog';
import { Download, HelpCircle } from 'lucide-react';
import { useChatKeyboardShortcuts, SHORTCUT_LIST } from '@/lib/hooks/useChatKeyboardShortcuts';
import { useChatSend } from '@/lib/hooks/useChatSend';
import { useDocumentUpload } from '@/lib/hooks/use-document-upload';
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
    createConversation,
    refreshConversations,
    conversations,
    updateConversationFilters,
    updateConversation,
  } = useConversationStore();
  const { unifiedFilters, setUnifiedFilters, selectedTopic, setSelectedTopic } = useFilterStore();

  // RAG settings (prop-controlled or localStorage)
  const [ragSettings, setRagSettings] = useState<RAGSettings>(() => {
    if (propRagSettings) return propRagSettings;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ragSettings');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* use defaults */ }
      }
    }
    return { enableDocumentSearch: true, enableWebSearch: true, maxDocumentChunks: 5, minScore: 0.5, maxWebResults: 5 };
  });

  const [showResearchSummaryModal, setShowResearchSummaryModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShortcutCard, setShowShortcutCard] = useState(false);
  const [dynamicStarters, setDynamicStarters] = useState<string[] | null>(null);
  const [documentInfo, setDocumentInfo] = useState<{ totalCount: number; processedCount: number; processingCount: number }>({ totalCount: 0, processedCount: 0, processingCount: 0 });
  const [inlineUploadStatus, setInlineUploadStatus] = useState<UploadStatus | null>(null);

  // ── Document drag-and-drop upload ──────────────────────────────────────

  const { uploadFile } = useDocumentUpload({
    topicId: selectedTopic?.id,
    onSuccess: () => {
      setInlineUploadStatus((prev) => prev ? { ...prev, status: 'completed' } : null);
      setTimeout(() => setInlineUploadStatus(null), 3000);
      toast.success('Document uploaded — it will be available for search shortly');
    },
    onError: (err) => {
      setInlineUploadStatus((prev) => prev ? { ...prev, status: 'error', error: err.message } : null);
    },
  });

  const handleFilesDrop = async (files: File[]) => {
    for (const file of files) {
      setInlineUploadStatus({ fileName: file.name, progress: 0, status: 'uploading' });
      try {
        await uploadFile(file);
      } catch {
        // Error handled by onError callback
      }
    }
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

  // Fetch dynamic starters when entering research mode
  useEffect(() => {
    if (!selectedTopic?.id) { setDynamicStarters(null); return; }
    let cancelled = false;
    aiApi.suggestedStarters(selectedTopic.id)
      .then((r) => { if (!cancelled && r.success && r.data?.starters?.length) setDynamicStarters(r.data.starters); })
      .catch(() => { if (!cancelled) setDynamicStarters(null); });
    return () => { cancelled = true; };
  }, [selectedTopic?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Topic-change messages
  const prevTopicIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const nextId = selectedTopic?.id ?? null;
    if (prevTopicIdRef.current === undefined) { prevTopicIdRef.current = nextId; return; }
    if (prevTopicIdRef.current === nextId) return;
    const prev = prevTopicIdRef.current;
    if (prev !== null && nextId === null) {
      setMessages((m) => [
        ...m,
        { id: `topic-change-${Date.now()}`, role: 'assistant', content: 'Research mode has been disabled. You can ask about any topic.', timestamp: new Date(), isTopicChangeMessage: true },
      ]);
    } else if (prev !== null && nextId !== null && selectedTopic) {
      setMessages((m) => [
        ...m,
        { id: `topic-change-${Date.now()}`, role: 'assistant', content: `Research topic is now: **${selectedTopic.name}**. I'll focus on that from here.`, timestamp: new Date(), isTopicChangeMessage: true },
      ]);
    }
    prevTopicIdRef.current = nextId;
  }, [selectedTopic]);

  // Load conversation data
  useEffect(() => {
    const loadConversationData = async () => {
      if (currentConversationId) {
        setSourcePanelContext(null);
        try {
          const messagesResponse = await conversationApi.getMessages(currentConversationId);
          if (messagesResponse.success && messagesResponse.data) {
            setMessages(mapApiMessagesToUi(messagesResponse.data as ApiMessage[]));
          }
          const conversationResponse = await conversationApi.get(currentConversationId);
          if (conversationResponse.success && conversationResponse.data) {
            const conversation = conversationResponse.data;
            let loadedTopic = null;
            if (conversation.topic_id) {
              try {
                const topicResponse = await topicApi.get(conversation.topic_id);
                if (topicResponse.success && topicResponse.data) { loadedTopic = topicResponse.data; setSelectedTopic(loadedTopic); }
              } catch (err) { console.error('Failed to load topic:', err); setSelectedTopic(null); }
            } else { setSelectedTopic(null); }
            const oldFilters = conversation.metadata?.filters || {};
            setUnifiedFilters({
              topicId: loadedTopic?.id || null,
              topic: loadedTopic,
              keyword: oldFilters.topic,
              timeRange: oldFilters.timeRange,
              startDate: oldFilters.startDate,
              endDate: oldFilters.endDate,
              country: oldFilters.country,
            });
          }
        } catch (err) {
          console.error('Failed to load conversation:', err);
          toast.error('Failed to load conversation data');
          setMessages([]);
          setUnifiedFilters({ topicId: null, topic: null });
          setSelectedTopic(null);
        }
      } else {
        setMessages([]);
        setUnifiedFilters({ topicId: null, topic: null });
        setSelectedTopic(null);
        setSourcePanelContext(null);
      }
    };
    loadConversationData();
  }, [currentConversationId, setUnifiedFilters, setSelectedTopic]);

  // Persist RAG settings
  useEffect(() => {
    if (typeof window !== 'undefined' && !propRagSettings) {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings, propRagSettings]);

  // Load document count for search status display
  useEffect(() => {
    const loadDocumentInfo = async () => {
      try {
        const response = await documentApi.list();
        if (response.success && response.data) {
          const docs = response.data;
          const processed = docs.filter((d) => d.status === 'processed' || d.status === 'embedded');
          const processing = docs.filter((d) => d.status === 'processing' || d.status === 'embedding' || d.status === 'extracted');
          setDocumentInfo({ totalCount: docs.length, processedCount: processed.length, processingCount: processing.length });
        }
      } catch (err) { console.error('Failed to load document info:', err); }
    };
    loadDocumentInfo();
    const interval = setInterval(loadDocumentInfo, 30000);
    return () => clearInterval(interval);
  }, []);

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
      toast.error(err.message || 'Document search failed');
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: 'Document search failed. Please try again.',
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
      toast.error(err.message || 'Failed to queue request');
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = { ...u[u.length - 1], content: 'Failed to process queued request. Try sending normally instead.', isStreaming: false };
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

  // ── Research mode ────────────────────────────────────────────────────────

  const handleExitResearchMode = () => {
    const hasEligible = currentConversationId && selectedTopic && messages.some((m) => m.role === 'assistant' && (m.content?.length || 0) > 100);
    if (hasEligible) { setShowResearchSummaryModal(true); }
    else {
      if (currentConversationId) conversationApi.update(currentConversationId, { topicId: null }).then(() => refreshConversations()).catch(console.warn);
      setSelectedTopic(null);
    }
  };

  const handleCloseResearchSummaryModal = () => {
    setShowResearchSummaryModal(false);
    if (currentConversationId) conversationApi.update(currentConversationId, { topicId: null as any }).then(() => refreshConversations()).catch(console.warn);
    setSelectedTopic(null);
  };

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

  // ── Action response (summary / essay / report) ──────────────────────────

  const handleActionResponse = async (content: string, actionType: string, messageSources?: Source[]) => {
    const actionMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      sources: messageSources,
      isActionResponse: true,
    };
    setMessages((prev) => [...prev, actionMessage]);
    if (currentConversationId && actionType) {
      try {
        await conversationApi.saveMessage(currentConversationId, {
          role: 'assistant',
          content,
          sources: messageSources,
          metadata: { isActionResponse: true, actionType },
        });
      } catch {
        toast.error('Could not save to conversation');
      }
    }
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useChatKeyboardShortcuts({
    focusInput: () => {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]');
      if (ta) ta.focus();
    },
    sendMessage: () => {
      const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]');
      if (ta) {
        ta.form?.requestSubmit?.();
        const enterEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
        ta.dispatchEvent(enterEvent);
      }
    },
    cancelStreaming: () => {
      if (isStreaming) handleCancelStreaming();
    },
    copyLastResponse: () => {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        navigator.clipboard.writeText(lastAssistant.content).then(() => toast.success('Copied last response')).catch(() => toast.error('Failed to copy'));
      }
    },
    closeModal: () => {
      setShowExportDialog(false);
      setShowResearchSummaryModal(false);
      setShowShortcutCard(false);
      setSourcePanelContext(null);
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-white">
      <ResearchModeBanner onExit={handleExitResearchMode} />

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
          documentInfo={documentInfo}
          onFilesDrop={handleFilesDrop}
          uploadStatus={inlineUploadStatus}
          onDismissUpload={() => setInlineUploadStatus(null)}
          showQueueOption={documentInfo.processedCount >= 20 || !!selectedTopic}
          onSendToQueue={handleQueueSend}
          activeQueueJobId={activeQueueJobId}
          onCancelQueueJob={handleCancelQueueJob}
        />
      )}

      {/* Conversation mode */}
      {!isEmpty && (
        <>
          {/* Chat toolbar */}
          <div className="flex items-center justify-end gap-1 px-4 py-1.5 border-b border-gray-100 bg-gray-50/50">
            <button
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Export conversation"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <div className="relative">
              <button
                onClick={() => setShowShortcutCard((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Keyboard shortcuts"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              {showShortcutCard && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-50 p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Keyboard Shortcuts</div>
                  <div className="space-y-1.5">
                    {SHORTCUT_LIST.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{s.description}</span>
                        <span className="flex gap-0.5">
                          {s.keys.map((k) => (
                            <kbd key={k} className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-mono text-gray-600">{k}</kbd>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingState={streamingState}
              error={error}
              selectedTopic={selectedTopic}
              isMobile={isMobile}
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
              onFollowUpClick={(q) => handleSend(q)}
              onExitResearchMode={handleExitResearchMode}
              onOpenSources={(sources, query) => setSourcePanelContext({ sources, query })}
              onActionResponse={handleActionResponse}
              onPauseStreaming={handlePauseStreaming}
              onResumeStreaming={handleResumeStreaming}
              onCancelStreaming={handleCancelStreaming}
              onRetryStreaming={handleRetryStreaming}
            />

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
            documentInfo={documentInfo}
            onFilesDrop={handleFilesDrop}
            uploadStatus={inlineUploadStatus}
            onDismissUpload={() => setInlineUploadStatus(null)}
            showQueueOption={documentInfo.processedCount >= 20 || !!selectedTopic}
            onSendToQueue={handleQueueSend}
            activeQueueJobId={activeQueueJobId}
            onCancelQueueJob={handleCancelQueueJob}
          />
        </>
      )}

      {/* Modals */}
      <ResearchSessionSummaryModal
        open={showResearchSummaryModal}
        onClose={handleCloseResearchSummaryModal}
        onRequestSummary={async () => {
          if (!currentConversationId || !selectedTopic) return null;
          const r = await aiApi.researchSessionSummary(currentConversationId, selectedTopic.name);
          return r.success && r.data ? r.data.summary : null;
        }}
        topicName={selectedTopic?.name || ''}
      />
      <CitationSettings isOpen={isCitationSettingsOpen} onClose={() => setIsCitationSettingsOpen(false)} />
      {currentConversationId && (
        <ConversationExportDialog
          conversation={conversations.find((c) => c.id === currentConversationId) || { id: currentConversationId, user_id: '', title: 'Conversation', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }}
          messages={messages as any}
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
};
