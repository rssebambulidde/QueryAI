'use client';

import { useRef, useCallback } from 'react';
import type { Message } from '@/components/chat/chat-message';
import { aiApi, QuestionRequest, conversationApi, Source } from '@/lib/api';
import {
  mapApiMessagesToUi,
  parseFollowUpQuestions,
  generateConversationTitle,
  type ApiMessage,
  type LastResponseData,
  type SendOptions,
} from '@/components/chat/chat-types';
import type { UnifiedFilters } from '@/components/chat/unified-filter-panel';
import type { RAGSettings } from '@/components/chat/rag-source-selector';
import type { StreamingState } from '@/components/chat/streaming-controls';
import type { QueryExpansionSettings } from '@/components/advanced/query-expansion-display';
import type { RerankingSettings } from '@/components/advanced/reranking-controls';

// ─── Config passed by the host component ────────────────────────────────────

export interface UseChatSendDeps {
  // Current state (read)
  messages: Message[];
  currentConversationId: string | null;
  unifiedFilters: UnifiedFilters;
  ragSettings: RAGSettings;
  queryExpansionEnabled: boolean;
  queryExpansionSettings: QueryExpansionSettings;
  rerankingEnabled: boolean;
  rerankingSettings: RerankingSettings;

  // State setters
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: (v: boolean) => void;
  setIsStreaming: (v: boolean) => void;
  setStreamingState: (v: StreamingState) => void;
  setError: (v: string | null) => void;
  setUnifiedFilters: (f: UnifiedFilters) => void;
  setLastResponseData: (d: LastResponseData | null) => void;
  setPreviousTokenUsage: (u: { totalTokens: number } | null) => void;
  setPreviousCost: (c: { total: number } | null) => void;

  // Store actions
  createConversation: (title?: string, topicId?: string) => Promise<{ id: string }>;
  updateConversationFilters: (id: string, filters: Record<string, any>) => Promise<void>;
  updateConversation: (id: string, title: string) => Promise<void>;
  refreshConversations: () => void;

  // Notifications
  toast: { success: (msg: string) => void; error: (msg: string) => void };
}

// ─── Return interface ───────────────────────────────────────────────────────

export interface UseChatSendReturn {
  sendMessage: (content: string, filters?: UnifiedFilters, options?: SendOptions) => Promise<void>;
  cancelStream: () => void;
  pauseStream: () => void;
  resumeStream: () => void;
  retryStream: () => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  /** Refs exposed so streaming-controls can read isPaused state */
  isPausedRef: React.MutableRefObject<boolean>;
  previousResponseTimeRef: React.MutableRefObject<number | null>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useChatSend(deps: UseChatSendDeps): UseChatSendReturn {
  const {
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
  } = deps;

  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const pausedChunksRef = useRef<string[]>([]);
  const responseTimeStartRef = useRef<number | null>(null);
  const previousResponseTimeRef = useRef<number | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const extractResponseMetadata = (metadata: any) => {
    setLastResponseData({
      queryExpansion: metadata.queryExpansion,
      reranking: metadata.reranking,
      contextChunks: metadata.contextChunks,
      selectionReasoning: metadata.selectionReasoning,
      usage: metadata.usage,
      cost: metadata.cost,
    });
    if (metadata.usage) setPreviousTokenUsage({ totalTokens: metadata.usage.totalTokens });
    if (metadata.cost) setPreviousCost({ total: metadata.cost.total });
  };

  const reloadPersistedMessages = async (conversationId: string) => {
    try {
      const messagesResponse = await conversationApi.getMessages(conversationId);
      if (messagesResponse.success && messagesResponse.data) {
        setMessages(mapApiMessagesToUi(messagesResponse.data));
        const lastMsg = messagesResponse.data[messagesResponse.data.length - 1];
        if (lastMsg?.metadata) extractResponseMetadata(lastMsg.metadata);
      }
    } catch (err) {
      console.error('Failed to reload messages:', err);
    }
  };

  const buildSearchFilters = (filters: UnifiedFilters) => ({
    topic: filters.topic?.name || filters.keyword,
    timeRange: filters.timeRange,
    startDate: filters.startDate,
    endDate: filters.endDate,
    country: filters.country,
  });

  // ── Core send pipeline ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, filters?: UnifiedFilters, options?: SendOptions) => {
      if (!content.trim()) return;

      const isResend = options?.isResend === true;
      const activeFilters: UnifiedFilters = filters !== undefined ? filters : unifiedFilters;
      const searchFilters = buildSearchFilters(activeFilters);

      // Persist filters
      if (currentConversationId) {
        try {
          await updateConversationFilters(currentConversationId, searchFilters);
          setUnifiedFilters(activeFilters);
        } catch (err) {
          console.error('Failed to save filters:', err);
          toast.error('Failed to save filters');
        }
      } else {
        setUnifiedFilters(activeFilters);
      }

      // Create conversation if needed
      let conversationId = currentConversationId;
      if (!conversationId && !isResend) {
        try {
          const title = generateConversationTitle(content, activeFilters.topic?.name);
          const newConversation = await createConversation(title, activeFilters.topicId || undefined);
          conversationId = newConversation.id;
          if (Object.keys(searchFilters).length > 0) {
            try {
              await updateConversationFilters(conversationId, searchFilters);
              setUnifiedFilters(activeFilters);
            } catch (err) {
              console.error('Failed to save filters:', err);
            }
          }
        } catch (err: any) {
          toast.error(err.message || 'Failed to create conversation');
          return;
        }
      }

      // Add user message
      if (!isResend) {
        const userMessage: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
        const isFirstMessage = messages.length === 0;
        setMessages((prev) => [...prev, userMessage]);
        if (conversationId && isFirstMessage) {
          try {
            const title = generateConversationTitle(content, activeFilters.topic?.name);
            if (title) await updateConversation(conversationId, title);
          } catch (err) {
            console.error('Failed to update conversation title:', err);
          }
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
          let qualityScore: number | undefined;

          const handleStreamError = (streamErr: Error) => {
            console.error('Stream error:', streamErr);
            if (streamErr.name !== 'AbortError') {
              setStreamingState('error');
              setError(streamErr.message || 'Streaming error occurred');
            }
          };

          for await (const chunk of aiApi.askStream(request, {
            signal: abortControllerRef.current.signal,
            onError: handleStreamError,
            maxRetries: 3,
            retryDelay: 1000,
          })) {
            if (isPausedRef.current) {
              if (typeof chunk === 'string') pausedChunksRef.current.push(chunk);
              continue;
            }

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
            if (typeof chunk === 'object' && 'qualityScore' in chunk) {
              qualityScore = (chunk as { qualityScore?: number }).qualityScore;
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
            const parsed = parseFollowUpQuestions(assistantMessage.content);
            if (parsed) {
              assistantMessage.content = parsed.cleanedText;
              followUpQuestions = parsed.questions;
            }
          }

          assistantMessage = { ...assistantMessage, followUpQuestions, isStreaming: false, isRefusal: isRefusal || undefined, qualityScore };
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

          if (conversationId) await reloadPersistedMessages(conversationId);
          refreshConversations();
        } catch (streamError: any) {
          if (streamError.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
            setStreamingState('cancelled');
            setIsStreaming(false);
            setIsLoading(false);
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
              const parsed = parseFollowUpQuestions(answer);
              if (parsed) { answer = parsed.cleanedText; followUpQuestions = parsed.questions; }
            }
            const fallbackTime = responseTimeStartRef.current ? Date.now() - responseTimeStartRef.current : null;
            if (fallbackTime !== null) previousResponseTimeRef.current = fallbackTime;

            const assistantMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: answer,
              timestamp: new Date(),
              sources: fallbackResponse.data.sources,
              followUpQuestions,
              isRefusal: fallbackResponse.data?.refusal ? true : undefined,
              responseTime: fallbackTime || undefined,
            };
            setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMsg; return u; });
            setIsLoading(false);
            responseTimeStartRef.current = null;

            const md = (fallbackResponse.data as any).metadata || {};
            extractResponseMetadata({ ...md, usage: fallbackResponse.data.usage });

            if (conversationId) await reloadPersistedMessages(conversationId);
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
    },
    [
      messages, currentConversationId, unifiedFilters, ragSettings,
      queryExpansionEnabled, queryExpansionSettings, rerankingEnabled, rerankingSettings,
      setMessages, setIsLoading, setIsStreaming, setStreamingState, setError,
      setUnifiedFilters, setLastResponseData, setPreviousTokenUsage, setPreviousCost,
      createConversation, updateConversationFilters, updateConversation, refreshConversations, toast,
    ],
  );

  // ── Streaming controls ───────────────────────────────────────────────────

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStreamingState('cancelled');
      setIsStreaming(false);
      setIsLoading(false);
      setMessages((prev) => prev.slice(0, -1));
      abortControllerRef.current = null;
    }
  }, [setStreamingState, setIsStreaming, setIsLoading, setMessages]);

  const pauseStream = useCallback(() => {
    isPausedRef.current = true;
    setStreamingState('paused');
  }, [setStreamingState]);

  const resumeStream = useCallback(() => {
    isPausedRef.current = false;
    setStreamingState('streaming');
  }, [setStreamingState]);

  const retryStream = useCallback(async () => {
    if (messages.length === 0) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.isStreaming)));
    setStreamingState('streaming');
    setError(null);
    await sendMessage(lastUser.content);
  }, [messages, setMessages, setStreamingState, setError, sendMessage]);

  // ── Edit + resend ────────────────────────────────────────────────────────

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      const msg = messages[idx];
      if (msg.role !== 'user') return;
      const resendHistory = messages.slice(0, idx).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => {
        const u = prev.slice(0, idx + 1);
        u[idx] = { ...msg, content: newContent };
        return u;
      });
      await sendMessage(newContent, undefined, { isResend: true, resendUserMessageId: msg.id, resendHistory });
    },
    [messages, setMessages, sendMessage],
  );

  return {
    sendMessage,
    cancelStream,
    pauseStream,
    resumeStream,
    retryStream,
    editMessage,
    isPausedRef,
    previousResponseTimeRef,
  };
}
