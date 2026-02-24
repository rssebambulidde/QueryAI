'use client';

import { useRef, useCallback } from 'react';
import type { Message } from '@/components/chat/chat-message';
import { aiApi, QuestionRequest, Source } from '@/lib/api';
import type { StreamingState } from '@/components/chat/streaming-controls';
import { parseFollowUpQuestions } from '@/components/chat/chat-types';

// ─── Dependencies ─────────────────────────────────────────────────────────

export interface UseAnonymousChatSendDeps {
  messages: Message[];
  conversationMode: 'research' | 'chat';

  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: (v: boolean) => void;
  setIsStreaming: (v: boolean) => void;
  setStreamingState: (v: StreamingState) => void;
  setError: (v: string | null) => void;

  toast: { success: (msg: string) => void; error: (msg: string, options?: any) => void };
  onQuerySent?: () => void; // callback to increment anonymous query counter
}

// ─── Return ─────────────────────────────────────────────────────────────────

export interface UseAnonymousChatSendReturn {
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAnonymousChatSend(deps: UseAnonymousChatSendDeps): UseAnonymousChatSendReturn {
  const {
    messages,
    conversationMode,
    setMessages,
    setIsLoading,
    setIsStreaming,
    setStreamingState,
    setError,
    toast,
    onQuerySent,
  } = deps;

  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationModeRef = useRef(conversationMode);
  conversationModeRef.current = conversationMode;

  // rAF-batched chunk accumulator (same pattern as useChatSend)
  const pendingChunksRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const assistantMsgRef = useRef<Message | null>(null);
  const responseTimeStartRef = useRef<number | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const liveMode = conversationModeRef.current;

      // Add user message
      const userMessage: Message = {
        id: `anon-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      setIsLoading(true);
      setError(null);

      try {
        setIsStreaming(true);
        setStreamingState('streaming');
        abortControllerRef.current = new AbortController();

        let assistantMessage: Message = {
          id: `anon-${Date.now() + 1}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        };
        assistantMsgRef.current = assistantMessage;
        pendingChunksRef.current = [];

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
          setMessages((prev) => {
            const u = [...prev];
            u[u.length - 1] = assistantMessage;
            return u;
          });
        };

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

        // Build a minimal request — no conversation ID, no persistence
        const conversationHistory = messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

        const request: QuestionRequest = {
          question: content,
          conversationHistory,
          mode: liveMode,
          enableWebSearch: liveMode !== 'chat',
          enableSearch: liveMode !== 'chat',
          maxSearchResults: 3,
        };

        let followUpQuestions: string[] | undefined;
        let isRefusal = false;
        let qualityScore: number | undefined;
        let streamSources: Source[] | undefined;

        const generator = aiApi.askAnonymousStream(request, {
          signal: abortControllerRef.current.signal,
          onError: (err) => {
            console.error('Anonymous stream error:', err);
            setStreamingState('error');
            setError(err.message || 'Streaming error occurred');
          },
        });

        for await (const chunk of generator) {
          if (typeof chunk === 'object' && 'sources' in chunk) {
            streamSources = (chunk as { sources?: Source[] }).sources;
            if (streamSources) {
              flushPendingChunks();
              assistantMessage = { ...assistantMessage, sources: streamSources };
              assistantMsgRef.current = assistantMessage;
              setMessages((prev) => {
                const u = [...prev];
                u[u.length - 1] = assistantMessage;
                return u;
              });
              // Dispatch event so SourcesSidebar can react
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sourcesUpdated'));
              }
            }
            continue;
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
            pendingChunksRef.current.push(chunk);
            scheduleFlush();
          }
        }

        // Final flush
        flushPendingChunks();

        // Extract follow-ups from text if not received via structured chunk
        if (!followUpQuestions) {
          const parsed = parseFollowUpQuestions(assistantMessage.content);
          if (parsed) {
            assistantMessage.content = parsed.cleanedText;
            followUpQuestions = parsed.questions;
          }
        }

        // Calculate response time
        const responseTime = responseTimeStartRef.current ? Date.now() - responseTimeStartRef.current : null;
        responseTimeStartRef.current = null;

        // Finalize the assistant message (matching authenticated format exactly)
        assistantMessage = {
          ...assistantMsgRef.current!,
          isStreaming: false,
          followUpQuestions,
          isRefusal: isRefusal || undefined,
          qualityScore,
          sources: streamSources || assistantMsgRef.current?.sources,
          responseTime: responseTime || undefined,
        };
        setMessages((prev) => {
          const u = [...prev];
          u[u.length - 1] = assistantMessage;
          return u;
        });

        // Dispatch sources update event if sources present
        if ((streamSources || assistantMessage.sources) && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sourcesUpdated'));
        }

        setStreamingState('completed');

        // Notify parent about query sent (for counter)
        onQuerySent?.();
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setStreamingState('cancelled');
          return;
        }

        console.error('Anonymous send failed:', err);
        let errorMsg = err.message || 'Failed to get response.';

        // Check for anonymous limit reached
        if (err.response?.status === 429) {
          const serverMsg = err.response?.data?.error?.message;
          if (serverMsg?.includes('anonymous') || err.response?.data?.error?.code === 'ANONYMOUS_LIMIT_REACHED') {
            errorMsg = 'You\'ve reached the anonymous query limit. Sign up for free to keep asking questions.';
          } else {
            errorMsg = 'Rate limit exceeded. Try again in a moment.';
          }
        } else if (err.message?.toLowerCase().includes('network')) {
          errorMsg = 'Network error. Please check your connection.';
        }

        setError(errorMsg);
        setStreamingState('error');

        // Update the assistant message with the error
        setMessages((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
            const u = [...prev];
            u[u.length - 1] = { ...u[u.length - 1], content: errorMsg, isStreaming: false };
            return u;
          }
          return prev;
        });
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, setMessages, setIsLoading, setIsStreaming, setStreamingState, setError, toast, onQuerySent]
  );

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamingState('cancelled');

    // Finalize the current assistant message
    if (assistantMsgRef.current) {
      const finalMsg = { ...assistantMsgRef.current, isStreaming: false };
      setMessages((prev) => {
        const u = [...prev];
        if (u.length > 0 && u[u.length - 1].role === 'assistant') {
          u[u.length - 1] = finalMsg;
        }
        return u;
      });
    }
  }, [setIsStreaming, setStreamingState, setMessages]);

  return { sendMessage, cancelStream };
}
