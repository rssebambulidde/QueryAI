'use client';

import { useRef, useCallback } from 'react';
import type { Message, RegenerateOptions } from '@/components/chat/chat-message';
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
  conversationMode: 'research' | 'chat';
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
  createConversation: (title?: string, options?: { autoSelect?: boolean; mode?: 'research' | 'chat' }) => Promise<{ id: string }>;
  selectConversation: (id: string | null) => void;
  updateConversationFilters: (id: string, filters: Record<string, any>) => Promise<void>;
  updateConversation: (id: string, title: string) => Promise<void>;
  refreshConversations: () => void;

  // Notifications
  toast: { success: (msg: string) => void; error: (msg: string) => void };
}

// ─── Return interface ───────────────────────────────────────────────────────

export interface UseChatSendReturn {
  sendMessage: (content: string, filters?: UnifiedFilters, options?: SendOptions, attachments?: import('@/components/chat/chat-types').ChatAttachment[]) => Promise<void>;
  cancelStream: () => void;
  pauseStream: () => void;
  resumeStream: () => void;
  retryStream: () => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  regenerateMessage: (messageId: string, options?: RegenerateOptions) => Promise<void>;
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
  } = deps;

  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const pausedChunksRef = useRef<string[]>([]);
  const responseTimeStartRef = useRef<number | null>(null);
  const previousResponseTimeRef = useRef<number | null>(null);

  // Always-fresh ref for conversationMode so sendMessage never uses a stale closure value.
  const conversationModeRef = useRef(conversationMode);
  conversationModeRef.current = conversationMode;

  // ── rAF-batched chunk accumulator ────────────────────────────────────────
  // Instead of calling setMessages on every token, we accumulate chunks and
  // flush at most once per animation frame (~60 fps).
  const pendingChunksRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  /** Reference to the in-flight assistant message, kept in sync across frames. */
  const assistantMsgRef = useRef<Message | null>(null);

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
        if (messagesResponse.data.length === 0) {
          // Avoid wiping optimistic streamed UI when backend persistence is slightly delayed
          return;
        }
        const dbMessages = mapApiMessagesToUi(messagesResponse.data);

        // Preserve ephemeral `attachments` from the current UI messages so
        // document/image indicators stay visible on user message bubbles
        // after the post-stream DB reload.
        setMessages((prev) => {
          // Build a map of user-message attachments from the current state
          const attachmentsByContent = new Map<string, typeof prev[0]['attachments']>();
          for (const m of prev) {
            if (m.role === 'user' && m.attachments?.length) {
              attachmentsByContent.set(m.content, m.attachments);
            }
          }
          return dbMessages.map((m) => {
            if (m.role === 'user' && !m.attachments?.length) {
              const existing = attachmentsByContent.get(m.content);
              if (existing) return { ...m, attachments: existing };
            }
            return m;
          });
        });

        const lastMsg = messagesResponse.data[messagesResponse.data.length - 1];
        if (lastMsg?.metadata) extractResponseMetadata(lastMsg.metadata);
      }
    } catch (err) {
      console.error('Failed to reload messages:', err);
    }
  };

  const buildSearchFilters = (filters: UnifiedFilters) => ({
    topic: filters.keyword,
    timeRange: filters.timeRange,
    startDate: filters.startDate,
    endDate: filters.endDate,
    country: filters.country,
  });

  // ── Core send pipeline ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, filters?: UnifiedFilters, options?: SendOptions, attachments?: import('@/components/chat/chat-types').ChatAttachment[]) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

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
      // Read the LIVE mode from the ref, not the stale useCallback closure value.
      const liveMode = conversationModeRef.current;
      if (!conversationId && !isResend) {
        try {
          const title = generateConversationTitle(content);
          const newConversation = await createConversation(title, { autoSelect: false, mode: liveMode });
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
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: content || (attachments?.length ? `[Sent ${attachments.length} attachment(s)]` : ''),
          timestamp: new Date(),
          attachments,
        };
        const isFirstMessage = messages.length === 0;
        setMessages((prev) => [...prev, userMessage]);
        if (conversationId && isFirstMessage) {
          try {
            const title = generateConversationTitle(content);
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
        assistantMsgRef.current = assistantMessage;
        pendingChunksRef.current = [];

        /** Flush accumulated chunks to React state (called by rAF or imperatively). */
        const flushPendingChunks = () => {
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          const pending = pendingChunksRef.current.splice(0);
          if (pending.length === 0) return;
          const joined = pending.join('');
          assistantMessage = { ...assistantMessage, content: assistantMessage.content + joined };
          assistantMsgRef.current = assistantMessage;
          setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
        };

        /** Schedule a rAF flush (no-ops if one is already queued). */
        const scheduleFlush = () => {
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null;
              flushPendingChunks();
            });
          }
        };

        responseTimeStartRef.current = Date.now();
        setMessages((prev) => [...prev, assistantMessage]);

        const request: QuestionRequest = {
          question: content || (attachments?.length ? `Describe / analyze the attached file(s).` : ''),
          conversationHistory,
          conversationId: conversationId ?? undefined,
          mode: liveMode,
          enableWebSearch: liveMode === 'chat' ? false : ragSettings.enableWebSearch,
          enableSearch: liveMode === 'chat' ? false : ragSettings.enableWebSearch,
          topic: activeFilters.keyword,
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
          // Inline attachments — use fileId when available (upload-then-reference),
          // otherwise fall back to base64 payloads. Conversation-level attachments
          // with fileIds are sent as attachmentIds (no base64 at all).
          ...(attachments && attachments.length > 0 && (() => {
            // Separate: attachments that need base64 vs ones with fileId-only
            const withData = attachments.filter((a) => a.data || !a.fileId);
            const fileIdOnly = attachments.filter((a) => a.fileId && !a.data).map((a) => a.fileId!);

            return {
              ...(withData.length > 0 && {
                attachments: withData.map((a) => ({
                  type: a.type,
                  name: a.name,
                  mimeType: a.mimeType,
                  data: a.data,
                  ...(a.fileId && { fileId: a.fileId }),
                })),
              }),
              ...(fileIdOnly.length > 0 && { attachmentIds: fileIdOnly }),
            };
          })()),
        };

        try {
          let followUpQuestions: string[] | undefined;
          let isRefusal = false;
          let qualityScore: number | undefined;
          let streamSources: Source[] | undefined;

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
              // Resume: flush any pause-buffered chunks + pending rAF chunks together
              pendingChunksRef.current.push(...pausedChunksRef.current.splice(0));
              flushPendingChunks();
            }

            if (typeof chunk === 'object' && 'sources' in chunk) {
              streamSources = (chunk as { sources?: Source[] }).sources;
              // Flush pending text first so sources layer on top of latest content
              if (streamSources) {
                flushPendingChunks();
                assistantMessage = { ...assistantMessage, sources: streamSources };
                assistantMsgRef.current = assistantMessage;
                setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
                // Dispatch event to refresh sources panel
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('sourcesUpdated'));
                }
              }
              continue;
            }
            if (typeof chunk === 'object' && 'extractionStatus' in chunk) {
              // Update the user message's attachments with per-file extraction status
              const statuses = (chunk as { extractionStatus: Array<{ name: string; status: 'success' | 'truncated' | 'failed'; chars: number; reason?: string; ocrApplied?: boolean }> }).extractionStatus;
              if (statuses && statuses.length > 0) {
                setMessages((prev) => {
                  const updated = [...prev];
                  // Find the last user message (the one we just sent)
                  for (let i = updated.length - 1; i >= 0; i--) {
                    if (updated[i].role === 'user' && updated[i].attachments?.length) {
                      const updatedAtts = updated[i].attachments!.map((att) => {
                        const match = statuses.find((s) => s.name === att.name);
                        return match
                          ? { ...att, extractionStatus: match.status, extractionChars: match.chars, extractionReason: match.reason, ocrApplied: match.ocrApplied }
                          : att;
                      });
                      updated[i] = { ...updated[i], attachments: updatedAtts };
                      break;
                    }
                  }
                  return updated;
                });
              }
              continue;
            }
            if (typeof chunk === 'object' && 'extracting' in chunk) {
              // Show/hide extraction progress on the assistant message
              const { extracting, extractingFiles } = chunk as { extracting?: boolean; extractingFiles?: string[] };
              if (extracting) {
                assistantMessage = { ...assistantMessage, extractingFiles: extractingFiles || [] };
              } else {
                assistantMessage = { ...assistantMessage, extractingFiles: undefined };
              }
              assistantMsgRef.current = assistantMessage;
              setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
              continue;
            }
            if (typeof chunk === 'object' && 'followUpQuestions' in chunk) {
            }
            if (typeof chunk === 'object' && 'qualityScore' in chunk) {
              qualityScore = (chunk as { qualityScore?: number }).qualityScore;
              continue;
            }

            if (typeof chunk === 'string') {
              pendingChunksRef.current.push(chunk);
              scheduleFlush();
            }
          }

          // Flush remaining paused + pending chunks
          if (pausedChunksRef.current.length > 0) {
            pendingChunksRef.current.push(...pausedChunksRef.current.splice(0));
          }
          flushPendingChunks();

          // Extract follow-ups from text if not received via structured chunk
          if (!followUpQuestions) {
            const parsed = parseFollowUpQuestions(assistantMessage.content);
            if (parsed) {
              assistantMessage.content = parsed.cleanedText;
              followUpQuestions = parsed.questions;
            }
          }

          assistantMessage = { ...assistantMessage, followUpQuestions, isStreaming: false, isRefusal: isRefusal || undefined, qualityScore, sources: streamSources || assistantMessage.sources };
          setMessages((prev) => { const u = [...prev]; u[u.length - 1] = assistantMessage; return u; });
          // Dispatch event to refresh sources panel if sources were present
          if ((streamSources || assistantMessage.sources) && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sourcesUpdated'));
          }

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

          if (conversationId) {
            await reloadPersistedMessages(conversationId);
            // Now safe to set the conversation as current (streaming is done, messages are persisted)
            if (conversationId !== currentConversationId) {
              selectConversation(conversationId);
            }
          }
          refreshConversations();
        } catch (streamError: any) {
          // Clean up rAF on any stream error / abort
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          pendingChunksRef.current = [];
          assistantMsgRef.current = null;

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
            // Dispatch event to refresh sources panel if sources were present
            if (fallbackResponse.data.sources && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('sourcesUpdated'));
            }
            setIsLoading(false);
            responseTimeStartRef.current = null;

            const md = (fallbackResponse.data as any).metadata || {};
            extractResponseMetadata({ ...md, usage: fallbackResponse.data.usage });

            if (conversationId) {
              await reloadPersistedMessages(conversationId);
              if (conversationId !== currentConversationId) {
                selectConversation(conversationId);
              }
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

        if (err.response?.status === 429) {
          const ed = err.response?.data?.error;
          const tier = ed?.tier || 'free';
          const limit = ed?.limit || 0;
          const retryAfter = ed?.retryAfter;
          errorMessage = `You've hit the rate limit — your ${tier} plan allows ${limit} requests per 15 minutes.`;
          if (retryAfter) errorMessage += ` Try again in ${Math.ceil(retryAfter / 60)} minute${Math.ceil(retryAfter / 60) === 1 ? '' : 's'}.`;
          if (tier === 'free') errorMessage += ' Upgrade to Pro for higher limits.';
        } else if (err.response?.status === 403) {
          const ed = err.response?.data?.error;
          const code = ed?.code || 'FORBIDDEN';
          if (code === 'QUERY_LIMIT_EXCEEDED') {
            errorMessage = `You've reached your monthly query limit (${ed?.used || 0} of ${ed?.limit || 0} used). Upgrade your plan for more queries.`;
          } else if (code === 'TAVILY_SEARCH_LIMIT_EXCEEDED') {
            errorMessage = `You've used all your web searches this month (${ed?.used || 0} of ${ed?.limit || 0}). Upgrade your plan for more web searches.`;
          } else if (code === 'RESEARCH_MODE_NOT_AVAILABLE') {
            errorMessage = ed?.message || 'Deep Research mode is not available on your current plan. Upgrade to Pro to unlock it.';
          } else if (code === 'DOCUMENT_UPLOAD_LIMIT_EXCEEDED') {
            errorMessage = "You've reached your document upload limit for this month.";
          } else if (code === 'FEATURE_NOT_AVAILABLE') {
            errorMessage = `This feature requires a ${ed?.requiredTier || 'Pro'} plan. Your current plan is ${ed?.currentTier || 'Free'}.`;
          } else {
            errorMessage = ed?.message || 'Access denied. This feature may require a higher plan.';
          }
        } else if (err.message) { errorMessage = err.message; }
        else if (err.response?.data?.error?.message) { errorMessage = err.response.data.error.message; }

        setError(errorMessage);
        toast.error(errorMessage);
        setMessages((prev) => prev.slice(0, -1));
      }
    },
    [
      messages, currentConversationId, unifiedFilters, ragSettings, conversationMode,
      queryExpansionEnabled, queryExpansionSettings, rerankingEnabled, rerankingSettings,
      setMessages, setIsLoading, setIsStreaming, setStreamingState, setError,
      setUnifiedFilters, setLastResponseData, setPreviousTokenUsage, setPreviousCost,
      createConversation, selectConversation, updateConversationFilters, updateConversation, refreshConversations, toast,
    ],
  );

  // ── Streaming controls ───────────────────────────────────────────────────

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Cancel any pending rAF flush
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingChunksRef.current = [];
      assistantMsgRef.current = null;
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

  // ── Regenerate assistant message with optional overrides (streaming) ──────

  const regenerateMessage = useCallback(
    async (messageId: string, options?: RegenerateOptions) => {
      if (!currentConversationId) {
        toast.error('No active conversation');
        return;
      }

      setIsLoading(true);
      setIsStreaming(true);
      setStreamingState('streaming');
      setError(null);

      // Mark the target message as streaming with empty content
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          return { ...m, content: '', isStreaming: true };
        }),
      );

      const abortCtrl = new AbortController();
      abortControllerRef.current = abortCtrl;
      let accumulatedContent = '';
      let streamSources: Source[] | undefined;
      let followUpQuestions: string[] | undefined;
      let qualityScore: number | undefined;
      let versionData: { version: number; messageId: string; versions: Array<{ id: string; version: number; content: string; sources?: Source[]; metadata?: Record<string, any>; created_at: string }> } | undefined;

      // rAF-batched chunk accumulator for regeneration
      const pendingRegenChunks: string[] = [];
      let regenRaf: number | null = null;

      const flushRegenChunks = () => {
        if (regenRaf !== null) {
          cancelAnimationFrame(regenRaf);
          regenRaf = null;
        }
        const pending = pendingRegenChunks.splice(0);
        if (pending.length === 0) return;
        const joined = pending.join('');
        accumulatedContent += joined;
        const snap = accumulatedContent;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            return { ...m, content: snap, isStreaming: true };
          }),
        );
      };

      const scheduleRegenFlush = () => {
        if (regenRaf === null) {
          regenRaf = requestAnimationFrame(() => {
            regenRaf = null;
            flushRegenChunks();
          });
        }
      };

      try {
        for await (const chunk of aiApi.regenerateStream(messageId, currentConversationId, options, abortCtrl.signal)) {
          if (typeof chunk === 'string') {
            pendingRegenChunks.push(chunk);
            scheduleRegenFlush();
            continue;
          }

          // Flush pending text before processing metadata events
          flushRegenChunks();

          if ('sources' in chunk && chunk.sources) {
            streamSources = chunk.sources;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== messageId) return m;
                return { ...m, sources: streamSources };
              }),
            );
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('sourcesUpdated'));
            }
          }
          if ('followUpQuestions' in chunk) {
            followUpQuestions = chunk.followUpQuestions;
          }
          if ('qualityScore' in chunk) {
            qualityScore = chunk.qualityScore;
          }
          if ('version' in chunk && chunk.version) {
            versionData = chunk.version;
          }
        }

        // Flush remaining chunks
        flushRegenChunks();

        // Build final version summaries
        const versionSummaries = versionData?.versions?.map((v) => ({
          id: v.id,
          version: v.version,
          content: v.content,
          sources: v.sources as Source[] | undefined,
          metadata: v.metadata ?? undefined,
          created_at: v.created_at,
        }));

        // Final update: set streaming=false, apply all metadata
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            return {
              ...m,
              content: accumulatedContent,
              isStreaming: false,
              sources: streamSources ?? m.sources,
              followUpQuestions: followUpQuestions ?? m.followUpQuestions,
              qualityScore,
              version: versionData?.version ?? m.version,
              versions: versionSummaries ?? m.versions,
            };
          }),
        );

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sourcesUpdated'));
        }

        toast.success(`Response regenerated${versionData ? ` (v${versionData.version})` : ''}`);
      } catch (err: any) {
        if (err.name === 'AbortError' || abortCtrl.signal.aborted) {
          // Cancelled — stop streaming indicator, keep whatever we have
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageId) return m;
              return { ...m, isStreaming: false };
            }),
          );
        } else {
          const msg = err?.message || 'Failed to regenerate';
          toast.error(msg);
          setError(msg);
          // Restore original message (mark not streaming)
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageId) return m;
              return { ...m, isStreaming: false };
            }),
          );
        }
      } finally {
        if (regenRaf !== null) cancelAnimationFrame(regenRaf);
        setIsLoading(false);
        setIsStreaming(false);
        setStreamingState('completed');
        abortControllerRef.current = null;
      }
    },
    [currentConversationId, setMessages, setIsLoading, setIsStreaming, setStreamingState, setError, toast],
  );

  return {
    sendMessage,
    cancelStream,
    pauseStream,
    resumeStream,
    retryStream,
    editMessage,
    regenerateMessage,
    isPausedRef,
    previousResponseTimeRef,
  };
}
