'use client';

import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { Message } from './chat-message';
import type { RAGSettings } from './rag-source-selector';
import { aiApi, QuestionRequest, QuestionResponse, documentApi, conversationApi, topicApi, Source } from '@/lib/api';
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

import { mapApiMessagesToUi, type ApiMessage, type LastResponseData, type SendOptions } from './chat-types';
import { ChatMessageList } from './chat-message-list';
import { ChatInputArea } from './chat-input-area';
import { SourcesSidebar } from './sources-sidebar';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const pausedChunksRef = useRef<string[]>([]);
  const responseTimeStartRef = useRef<number | null>(null);
  const previousResponseTimeRef = useRef<number | null>(null);

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

  const [documentCount, setDocumentCount] = useState(0);
  const [hasProcessedDocuments, setHasProcessedDocuments] = useState(false);
  const [showResearchSummaryModal, setShowResearchSummaryModal] = useState(false);
  const [dynamicStarters, setDynamicStarters] = useState<string[] | null>(null);

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

  // Track conversation-load to avoid auto-opening sources
  const justLoadedConversationRef = useRef(false);

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
        justLoadedConversationRef.current = true;
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
              } catch { setSelectedTopic(null); }
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
        } catch {
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

  // Load document count
  useEffect(() => {
    const loadDocumentCount = async () => {
      try {
        const response = await documentApi.list();
        if (response.success && response.data) {
          const processedDocs = response.data.filter((doc) => doc.status === 'processed' || doc.status === 'embedded');
          setDocumentCount(processedDocs.length);
          setHasProcessedDocuments(processedDocs.length > 0);
        }
      } catch { /* silent */ }
    };
    loadDocumentCount();
    const interval = setInterval(loadDocumentCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Persist RAG settings
  useEffect(() => {
    if (typeof window !== 'undefined' && !propRagSettings) {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings, propRagSettings]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSend = async (content: string, filters?: UnifiedFilters, options?: SendOptions) => {
    if (!content.trim() || isLoading) return;

    const isResend = options?.isResend === true;
    const activeFilters: UnifiedFilters = filters !== undefined ? filters : unifiedFilters;

    const searchFilters = {
      topic: activeFilters.topic?.name || activeFilters.keyword,
      timeRange: activeFilters.timeRange,
      startDate: activeFilters.startDate,
      endDate: activeFilters.endDate,
      country: activeFilters.country,
    };

    if (currentConversationId) {
      try { await updateConversationFilters(currentConversationId, searchFilters); setUnifiedFilters(activeFilters); }
      catch { /* continue */ }
    } else { setUnifiedFilters(activeFilters); }

    let conversationId = currentConversationId;
    if (!conversationId && !isResend) {
      try {
        let title = content.trim().replace(/[?]+$/, '').trim();
        if (title.length > 60) { const c = title.substring(0, 60).lastIndexOf(' '); title = c > 20 ? title.substring(0, c) + '...' : title.substring(0, 57) + '...'; }
        if (!title) title = activeFilters.topic?.name || 'New Conversation';
        const newConversation = await createConversation(title, activeFilters.topicId || undefined);
        conversationId = newConversation.id;
        if (Object.keys(searchFilters).length > 0) {
          try { await updateConversationFilters(conversationId, searchFilters); setUnifiedFilters(activeFilters); } catch { /* silent */ }
        }
      } catch (err: any) { toast.error(err.message || 'Failed to create conversation'); return; }
    }

    if (!isResend) {
      const userMessage: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
      const isFirstMessage = messages.length === 0;
      setMessages((prev) => [...prev, userMessage]);
      if (conversationId && isFirstMessage) {
        try {
          let title = content.trim().replace(/[?]+$/, '').trim();
          if (!title && activeFilters.topic?.name) title = activeFilters.topic.name;
          if (!title) title = content.trim().slice(0, 50) || 'New Conversation';
          if (title.length > 60) { const c = title.substring(0, 60).lastIndexOf(' '); title = c > 20 ? title.substring(0, c) + '...' : title.substring(0, 57) + '...'; }
          if (title) await updateConversation(conversationId, title);
        } catch { /* silent */ }
      }
    }
    setIsLoading(true);
    setError(null);

    try {
      const conversationHistory = isResend && options?.resendHistory
        ? options.resendHistory
        : messages.map((msg) => ({ role: msg.role, content: msg.content }));

      setIsStreaming(true);
      setStreamingState('streaming');
      isPausedRef.current = false;
      pausedChunksRef.current = [];
      abortControllerRef.current = new AbortController();

      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      responseTimeStartRef.current = Date.now();
      setMessages((prev) => [...prev, assistantMessage]);

      const request: QuestionRequest = {
        question: content,
        conversationHistory,
        conversationId: conversationId ?? undefined,
        enableDocumentSearch: ragSettings.enableDocumentSearch,
        enableWebSearch: ragSettings.enableWebSearch,
        documentIds: ragSettings.documentIds,
        maxDocumentChunks: ragSettings.maxDocumentChunks,
        minScore: ragSettings.minScore,
        topicId: activeFilters.topicId || activeFilters.topic?.id,
        enableSearch: ragSettings.enableWebSearch,
        topic: activeFilters.topic?.name || activeFilters.keyword,
        timeRange: activeFilters.timeRange,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate,
        country: activeFilters.country,
        maxSearchResults: ragSettings.maxWebResults,
        ...(isResend && options?.resendUserMessageId && { resendUserMessageId: options.resendUserMessageId }),
        enableQueryExpansion: queryExpansionEnabled,
        queryExpansionSettings: queryExpansionEnabled ? queryExpansionSettings : undefined,
        enableReranking: rerankingEnabled,
        rerankingSettings: rerankingEnabled ? rerankingSettings : undefined,
      };

      try {
        let followUpQuestions: string[] | undefined;
        let isRefusal = false;

        const handleStreamError = (streamErr: Error) => {
          console.error('Stream error:', streamErr);
          if (streamErr.name !== 'AbortError') { setStreamingState('error'); setError(streamErr.message || 'Streaming error occurred'); }
        };

        for await (const chunk of aiApi.askStream(request, {
          signal: abortControllerRef.current.signal,
          onError: handleStreamError,
          maxRetries: 3,
          retryDelay: 1000,
        })) {
          if (isPausedRef.current) { if (typeof chunk === 'string') pausedChunksRef.current.push(chunk); continue; }

          if (pausedChunksRef.current.length > 0) {
            const paused = pausedChunksRef.current.splice(0);
            for (const p of paused) assistantMessage = { ...assistantMessage, content: assistantMessage.content + p };
            setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
          }

          if (typeof chunk === 'object' && 'followUpQuestions' in chunk) {
            followUpQuestions = chunk.followUpQuestions;
            if ((chunk as { refusal?: boolean }).refusal) isRefusal = true;
            continue;
          }

          if (typeof chunk === 'string') {
            assistantMessage = { ...assistantMessage, content: assistantMessage.content + chunk };
            setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
          }
        }

        // Flush remaining paused chunks
        if (pausedChunksRef.current.length > 0) {
          const paused = pausedChunksRef.current.splice(0);
          for (const p of paused) assistantMessage = { ...assistantMessage, content: assistantMessage.content + p };
          setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
        }

        // Extract follow-ups from text if not received via structured chunk
        if (!followUpQuestions) {
          const m = assistantMessage.content.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
          if (m) {
            assistantMessage.content = assistantMessage.content.substring(0, m.index).trim();
            followUpQuestions = m[1].split('\n').map((l) => l.replace(/^[-*•]\s+/, '').trim()).filter((q) => q.length > 0).slice(0, 4);
          }
        }

        assistantMessage = { ...assistantMessage, followUpQuestions, isStreaming: false, isRefusal: isRefusal || undefined };
        setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });

        setIsStreaming(false);
        setIsLoading(false);
        setStreamingState('completed');
        abortControllerRef.current = null;

        const responseTime = responseTimeStartRef.current ? Date.now() - responseTimeStartRef.current : null;
        if (responseTime !== null) previousResponseTimeRef.current = responseTime;

        setMessages((prev) => {
          const u = [...prev];
          if (u.length > 0 && u[u.length - 1].role === 'assistant') {
            u[u.length - 1] = { ...u[u.length - 1], isStreaming: false, responseTime: responseTime || undefined };
          }
          return u;
        });
        responseTimeStartRef.current = null;

        // Reload persisted messages
        if (conversationId) {
          try {
            const messagesResponse = await conversationApi.getMessages(conversationId);
            if (messagesResponse.success && messagesResponse.data) {
              setMessages(mapApiMessagesToUi(messagesResponse.data));
              const lastMsg = messagesResponse.data[messagesResponse.data.length - 1];
              if (lastMsg?.metadata) {
                const md = lastMsg.metadata;
                setLastResponseData({ queryExpansion: md.queryExpansion, reranking: md.reranking, contextChunks: md.contextChunks, selectionReasoning: md.selectionReasoning, usage: md.usage, cost: md.cost });
                if (md.usage) setPreviousTokenUsage({ totalTokens: md.usage.totalTokens });
                if (md.cost) setPreviousCost({ total: md.cost.total });
              }
            }
          } catch { /* continue — messages already in local state */ }
        }

        refreshConversations();
      } catch (streamError: any) {
        if (streamError.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
          setStreamingState('cancelled'); setIsStreaming(false); setIsLoading(false);
          setMessages((prev) => prev.slice(0, -1));
          abortControllerRef.current = null;
          return;
        }

        // Non-streaming fallback
        console.warn('Streaming failed, falling back to non-streaming:', streamError);
        setIsStreaming(false);
        setStreamingState('error');

        const fallbackResponse = await aiApi.ask(request);
        if (fallbackResponse.success && fallbackResponse.data) {
          let answer = fallbackResponse.data.answer;
          let followUpQuestions = fallbackResponse.data.followUpQuestions;
          if (!followUpQuestions) {
            const m = answer.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
            if (m) { answer = answer.substring(0, m.index).trim(); followUpQuestions = m[1].split('\n').map((l) => l.replace(/^[-*•]\s+/, '').trim()).filter((q) => q.length > 0).slice(0, 4); }
          }
          const fallbackTime = responseTimeStartRef.current ? Date.now() - responseTimeStartRef.current : null;
          if (fallbackTime !== null) previousResponseTimeRef.current = fallbackTime;

          let assistantMessage: Message = {
            id: (Date.now() + 1).toString(), role: 'assistant', content: answer, timestamp: new Date(),
            sources: fallbackResponse.data.sources, followUpQuestions,
            isRefusal: fallbackResponse.data?.refusal ? true : undefined,
            responseTime: fallbackTime || undefined,
          };
          setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
          setIsLoading(false);
          responseTimeStartRef.current = null;

          const md = (fallbackResponse.data as any).metadata || {};
          setLastResponseData({ queryExpansion: md.queryExpansion, reranking: md.reranking, contextChunks: md.contextChunks, selectionReasoning: md.selectionReasoning, usage: fallbackResponse.data.usage, cost: md.cost });
          if (fallbackResponse.data.usage) setPreviousTokenUsage({ totalTokens: fallbackResponse.data.usage.totalTokens });
          if (md.cost) setPreviousCost({ total: md.cost.total });

          if (conversationId) {
            try {
              const messagesResponse = await conversationApi.getMessages(conversationId);
              if (messagesResponse.success && messagesResponse.data) {
                setMessages(mapApiMessagesToUi(messagesResponse.data));
                const lastMsg = messagesResponse.data[messagesResponse.data.length - 1];
                if (lastMsg?.metadata) {
                  const lmd = lastMsg.metadata;
                  setLastResponseData({ queryExpansion: lmd.queryExpansion, reranking: lmd.reranking, contextChunks: lmd.contextChunks, selectionReasoning: lmd.selectionReasoning, usage: lmd.usage, cost: lmd.cost });
                  if (lmd.usage) setPreviousTokenUsage({ totalTokens: lmd.usage.totalTokens });
                  if (lmd.cost) setPreviousCost({ total: lmd.cost.total });
                }
              }
            } catch { /* continue */ }
          }
          refreshConversations();
        } else {
          throw streamError;
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingState('error');
      abortControllerRef.current = null;

      let errorMessage = 'Failed to get AI response';
      let showUpgradeLink = false;

      if (err.response?.status === 429) {
        const ed = err.response?.data?.error;
        const tier = ed?.tier || 'free';
        const limit = ed?.limit || 0;
        const retryAfter = ed?.retryAfter;
        errorMessage = `Rate limit exceeded. Your ${tier} tier allows ${limit} requests per 15 minutes.`;
        if (retryAfter) errorMessage += ` Please try again in ${Math.ceil(retryAfter / 60)} minutes.`;
        if (tier === 'free') errorMessage += ' Upgrade to premium for higher limits.';
        showUpgradeLink = true;
      } else if (err.response?.status === 403) {
        const ed = err.response?.data?.error;
        const code = ed?.code || 'FORBIDDEN';
        if (code === 'QUERY_LIMIT_EXCEEDED') { errorMessage = `You have reached your query limit. You've used ${ed?.used || 0} of ${ed?.limit || 0} queries this month.`; showUpgradeLink = true; }
        else if (code === 'DOCUMENT_UPLOAD_LIMIT_EXCEEDED') { errorMessage = `Document upload limit reached. You've uploaded ${ed?.used || 0} of ${ed?.limit || 0} documents this month.`; showUpgradeLink = true; }
        else if (code === 'TOPIC_LIMIT_EXCEEDED') { errorMessage = `Topic limit reached. You've created ${ed?.used || 0} of ${ed?.limit || 0} topics.`; showUpgradeLink = true; }
        else if (code === 'FEATURE_NOT_AVAILABLE') { errorMessage = `This feature requires a ${ed?.requiredTier || 'premium'} subscription. Your current tier is ${ed?.currentTier || 'free'}.`; showUpgradeLink = true; }
        else { errorMessage = ed?.message || 'Access denied. This feature may require a premium subscription.'; showUpgradeLink = true; }
      } else if (err.message) { errorMessage = err.message; }
      else if (err.response?.data?.error?.message) { errorMessage = err.response.data.error.message; }

      setError(errorMessage);
      toast.error(errorMessage);
      setMessages((prev) => prev.slice(0, -1));

      if (showUpgradeLink && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('navigateToSubscription'));
      }
    }
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

  // ── Streaming controls ───────────────────────────────────────────────────

  const handlePauseStreaming = () => { if (streamingState === 'streaming') { isPausedRef.current = true; setStreamingState('paused'); } };
  const handleResumeStreaming = () => { if (streamingState === 'paused') { isPausedRef.current = false; setStreamingState('streaming'); } };
  const handleCancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); setStreamingState('cancelled'); setIsStreaming(false); setIsLoading(false);
      setMessages((prev) => prev.slice(0, -1)); abortControllerRef.current = null;
    }
  };
  const handleRetryStreaming = async () => {
    if (messages.length === 0) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.isStreaming)));
    setStreamingState('streaming'); setError(null);
    await handleSend(lastUser.content);
  };

  // ── Edit message ─────────────────────────────────────────────────────────

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const msg = messages[idx];
    if (msg.role !== 'user') return;
    const resendHistory = messages.slice(0, idx).map((m) => ({ role: m.role, content: m.content }));
    flushSync(() => {
      setMessages((prev) => { const u = prev.slice(0, idx + 1); u[idx] = { ...msg, content: newContent }; return u; });
    });
    await handleSend(newContent, undefined, { isResend: true, resendUserMessageId: msg.id, resendHistory });
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
          onSend={(msg) => handleSend(msg)}
          disabled={isLoading || isStreaming}
          selectedTopic={selectedTopic}
          dynamicStarters={dynamicStarters}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onOpenCitationSettings={() => setIsCitationSettingsOpen(true)}
          welcomeGreeting={welcomeGreeting}
        />
      )}

      {/* Conversation mode */}
      {!isEmpty && (
        <>
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
            onSend={(msg) => handleSend(msg)}
            disabled={isLoading || isStreaming}
            selectedTopic={selectedTopic}
            dynamicStarters={dynamicStarters}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onOpenCitationSettings={() => setIsCitationSettingsOpen(true)}
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
    </div>
  );
};
