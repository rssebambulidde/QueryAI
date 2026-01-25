'use client';

import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { ChatMessage, Message } from './chat-message';
import { ChatInput } from './chat-input';
import { RAGSourceSelector, RAGSettings } from './rag-source-selector';
import { aiApi, QuestionRequest, documentApi, conversationApi, topicApi, Topic, Source } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useConversationStore } from '@/lib/store/conversation-store';
import { useFilterStore } from '@/lib/store/filter-store';
import { Alert } from '@/components/ui/alert';
import { MessageSquare } from 'lucide-react';
import { UnifiedFilters } from './unified-filter-panel';
import { ResearchModeBanner } from './research-mode-banner';
import { ResearchSessionSummaryModal } from './research-session-summary-modal';

interface ChatInterfaceProps {
  ragSettings?: RAGSettings;
}

type ApiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  metadata?: { followUpQuestions?: string[]; isActionResponse?: boolean; actionType?: string; isRefusal?: boolean };
  created_at: string;
};

function mapApiMessagesToUi(apiMessages: ApiMessage[]): Message[] {
  return apiMessages.map((msg) => {
    let content = msg.content;
    let followUpQuestions: string[] | undefined = msg.metadata?.followUpQuestions;
    if (!followUpQuestions) {
      const followUpMatch = content.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
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
    };
  });
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ ragSettings: propRagSettings }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[] | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentConversationId, createConversation, refreshConversations, conversations, updateConversationFilters, updateConversation } = useConversationStore();
  const { unifiedFilters, setUnifiedFilters, selectedTopic, setSelectedTopic } = useFilterStore();
  
  // RAG settings state - use prop if provided, otherwise load from localStorage
  const [ragSettings, setRagSettings] = useState<RAGSettings>(() => {
    if (propRagSettings) return propRagSettings;
    // Load from localStorage or use defaults
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ragSettings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Invalid JSON, use defaults
        }
      }
    }
    return {
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      minScore: 0.5, // Lower threshold to find more relevant documents
      maxWebResults: 5,
    };
  });

  // Update ragSettings when prop changes
  useEffect(() => {
    if (propRagSettings) {
      setRagSettings(propRagSettings);
    }
  }, [propRagSettings]);
  
  // Document count state
  const [documentCount, setDocumentCount] = useState(0);
  const [hasProcessedDocuments, setHasProcessedDocuments] = useState(false);

  // 7.1 Research session summary: offer on exit when there is on-topic Q&A
  const [showResearchSummaryModal, setShowResearchSummaryModal] = useState(false);

  // 6.1 Dynamic AI-generated starter questions for research mode (in line with topic)
  const [dynamicStarters, setDynamicStarters] = useState<string[] | null>(null);

  // Fetch dynamic starters when entering research mode with a topic
  useEffect(() => {
    if (!selectedTopic?.id) {
      setDynamicStarters(null);
      return;
    }
    let cancelled = false;
    aiApi.suggestedStarters(selectedTopic.id).then((r) => {
      if (!cancelled && r.success && r.data?.starters?.length) setDynamicStarters(r.data.starters);
    }).catch(() => { if (!cancelled) setDynamicStarters(null); });
    return () => { cancelled = true; };
  }, [selectedTopic?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // 10.2 Optional in-thread "Topic changed" message when user switches topic mid-conversation
  const prevTopicIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const nextId = selectedTopic?.id ?? null;
    if (prevTopicIdRef.current === undefined) {
      prevTopicIdRef.current = nextId;
      return;
    }
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

  // Load messages and filters when conversation changes
  useEffect(() => {
    const loadConversationData = async () => {
      if (currentConversationId) {
        try {
          // Load messages
          const messagesResponse = await conversationApi.getMessages(currentConversationId);
          if (messagesResponse.success && messagesResponse.data) {
            const uiMessages = mapApiMessagesToUi(messagesResponse.data as ApiMessage[]);
            setMessages(uiMessages);
          }
          
          // Load conversation details to get filters from metadata and topic
          const conversationResponse = await conversationApi.get(currentConversationId);
          if (conversationResponse.success && conversationResponse.data) {
            const conversation = conversationResponse.data;
            
            // Load topic if conversation has topicId
            let loadedTopic: Topic | null = null;
            if (conversation.topic_id) {
              try {
                const topicResponse = await topicApi.get(conversation.topic_id);
                if (topicResponse.success && topicResponse.data) {
                  loadedTopic = topicResponse.data;
                  setSelectedTopic(loadedTopic);
                }
              } catch (error) {
                console.warn('Failed to load topic:', error);
                setSelectedTopic(null);
              }
            } else {
              setSelectedTopic(null);
            }
            
            // Convert old conversation filters to unified filters format
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
        } catch (error: any) {
          console.error('Failed to load conversation data:', error);
          setMessages([]);
          setUnifiedFilters({ topicId: null, topic: null });
          setSelectedTopic(null);
        }
      } else {
        setMessages([]);
        setUnifiedFilters({ topicId: null, topic: null });
        setSelectedTopic(null);
      }
    };

    loadConversationData();
  }, [currentConversationId, setUnifiedFilters, setSelectedTopic]);

  // Load document count on mount
  useEffect(() => {
    const loadDocumentCount = async () => {
      try {
        const response = await documentApi.list();
        if (response.success && response.data) {
          const processedDocs = response.data.filter(
            (doc) => doc.status === 'processed' || doc.status === 'embedded'
          );
          setDocumentCount(processedDocs.length);
          setHasProcessedDocuments(processedDocs.length > 0);
        }
      } catch (err) {
        console.warn('Failed to load document count:', err);
        // Don't show error to user, just assume no documents
      }
    };
    
    loadDocumentCount();
    
    // Refresh document count every 30 seconds
    const interval = setInterval(loadDocumentCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Save RAG settings to localStorage when they change
  // Save RAG settings to localStorage (only if not controlled by parent)
  useEffect(() => {
    if (typeof window !== 'undefined' && !propRagSettings) {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings, propRagSettings]);

  type SendOptions = {
    isResend?: boolean;
    resendUserMessageId?: string;
    resendHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const handleSend = async (content: string, filters?: UnifiedFilters, options?: SendOptions) => {
    if (!content.trim() || isLoading) return;

    const isResend = options?.isResend === true;
    const activeFilters: UnifiedFilters = filters !== undefined ? filters : unifiedFilters;
    
    // Convert UnifiedFilters to old SearchFilters format for API and conversation metadata
    const searchFilters = {
      topic: activeFilters.topic?.name || activeFilters.keyword,
      timeRange: activeFilters.timeRange,
      startDate: activeFilters.startDate,
      endDate: activeFilters.endDate,
      country: activeFilters.country,
    };
    
    // Always save filters to conversation if we have a conversation
    if (currentConversationId) {
      try {
        await updateConversationFilters(currentConversationId, searchFilters);
        // Update local state immediately so UI reflects the change
        setUnifiedFilters(activeFilters);
      } catch (error: any) {
        console.warn('Failed to save filters:', error);
        // Continue anyway - use the filters for this request even if save failed
      }
    } else {
      setUnifiedFilters(activeFilters);
    }

    let conversationId = currentConversationId;
    if (!conversationId && !isResend) {
      try {
        // Create conversation with title from first message
        // Clean up the title: remove extra whitespace, limit length, ensure it's meaningful
        let title = content.trim();
        // Remove question marks and other trailing punctuation for cleaner title
        title = title.replace(/[?]+$/, '').trim();
        // Limit to 60 characters for better display
        if (title.length > 60) {
          // Try to cut at a word boundary
          const cutAt = title.substring(0, 60).lastIndexOf(' ');
          title = cutAt > 20 ? title.substring(0, cutAt) + '...' : title.substring(0, 57) + '...';
        }
        // Ensure we have a title (fallback: topic name in research mode, or default)
        if (!title || title.length === 0) {
          title = activeFilters.topic?.name || 'New Conversation';
        }
        const newConversation = await createConversation(title, activeFilters.topicId || undefined);
        conversationId = newConversation.id;
        
        // Save filters to new conversation if provided
        if (Object.keys(searchFilters).length > 0) {
          try {
            await updateConversationFilters(conversationId, searchFilters);
            setUnifiedFilters(activeFilters);
          } catch (error: any) {
            console.warn('Failed to save filters to new conversation:', error);
          }
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to create conversation');
        return;
      }
    }

    if (!isResend) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      const isFirstMessage = messages.length === 0;
      setMessages((prev) => [...prev, userMessage]);
      if (conversationId && isFirstMessage) {
        try {
          let title = content.trim().replace(/[?]+$/, '').trim();
          if (!title && activeFilters.topic?.name) title = activeFilters.topic.name;
          if (!title) title = content.trim().slice(0, 50) || 'New Conversation';
          if (title.length > 60) {
            const cutAt = title.substring(0, 60).lastIndexOf(' ');
            title = cutAt > 20 ? title.substring(0, cutAt) + '...' : title.substring(0, 57) + '...';
          }
          if (title && title.length > 0) {
            await updateConversation(conversationId, title);
          }
        } catch (error: any) {
          console.warn('Failed to update conversation title:', error);
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
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true, // Mark as streaming
      };

      // Add empty assistant message for streaming
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
      };

      try {
        // Try streaming first
        let followUpQuestions: string[] | undefined;
        let isRefusal = false;
        for await (const chunk of aiApi.askStream(request)) {
          // Check if this is a follow-up questions object (may include refusal)
          if (typeof chunk === 'object' && 'followUpQuestions' in chunk) {
            followUpQuestions = chunk.followUpQuestions;
            if ((chunk as { refusal?: boolean }).refusal) isRefusal = true;
            continue;
          }
          
          // Regular text chunk
          if (typeof chunk === 'string') {
            assistantMessage = {
              ...assistantMessage,
              content: assistantMessage.content + chunk,
            };
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = assistantMessage;
              return updated;
            });
          }
        }
        
        // Extract follow-up questions from the complete response if not already received (lenient regex)
        if (!followUpQuestions) {
          const followUpMatch = assistantMessage.content.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
          if (followUpMatch) {
            assistantMessage.content = assistantMessage.content.substring(0, followUpMatch.index).trim();
            const questionsText = followUpMatch[1];
            followUpQuestions = questionsText
              .split('\n')
              .map(line => line.replace(/^[-*•]\s+/, '').trim())
              .filter(q => q.length > 0)
              .slice(0, 4);
          }
        }
        
        // Store follow-up questions and isRefusal in message if available and mark as complete
        if (followUpQuestions && followUpQuestions.length > 0) {
          assistantMessage = {
            ...assistantMessage,
            followUpQuestions,
            isStreaming: false,
            isRefusal: isRefusal || undefined,
          };
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = assistantMessage;
            return updated;
          });
        } else {
          assistantMessage = {
            ...assistantMessage,
            isStreaming: false,
            isRefusal: isRefusal || undefined,
          };
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = assistantMessage;
            return updated;
          });
        }

        // Sources are persisted with the message by the backend; the reload from getMessages below will include them.

        setIsStreaming(false);
        setIsLoading(false);
        
        // Ensure the last message is marked as complete
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              isStreaming: false,
            };
          }
          return updated;
        });
        
        // Reload messages from database to ensure they're persisted and displayed
        if (conversationId) {
          try {
            const messagesResponse = await conversationApi.getMessages(conversationId);
            if (messagesResponse.success && messagesResponse.data) {
              const uiMessages = mapApiMessagesToUi(messagesResponse.data);
              setMessages(uiMessages);
            }
          } catch (error: any) {
            console.warn('Failed to reload messages after streaming:', error);
            // Continue - messages are already in local state
          }
        }
        
        // Refresh conversations list to update last message and title (if first message)
        refreshConversations();
      } catch (streamError: any) {
        // If streaming fails, try non-streaming as fallback
        console.warn('Streaming failed, falling back to non-streaming:', streamError);
        setIsStreaming(false);
        
        const fallbackResponse = await aiApi.ask(request);
        if (fallbackResponse.success && fallbackResponse.data) {
          // Extract follow-up questions from answer if present
          let answer = fallbackResponse.data.answer;
          let followUpQuestions = fallbackResponse.data.followUpQuestions;
          
          // Also check if questions are embedded in the answer
          if (!followUpQuestions) {
            const followUpMatch = answer.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
            if (followUpMatch) {
              answer = answer.substring(0, followUpMatch.index).trim();
              const questionsText = followUpMatch[1];
              followUpQuestions = questionsText
                .split('\n')
                .map(line => line.replace(/^[-*•]\s+/, '').trim())
                .filter(q => q.length > 0)
                .slice(0, 4);
            }
          }
          
          assistantMessage = {
            ...assistantMessage,
            content: answer,
            sources: fallbackResponse.data.sources,
            followUpQuestions,
            isRefusal: fallbackResponse.data?.refusal ? true : undefined,
          };
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = assistantMessage;
            return updated;
          });
          setIsLoading(false);
          
          // Reload messages from database to ensure they're persisted
          if (conversationId) {
            try {
              const messagesResponse = await conversationApi.getMessages(conversationId);
              if (messagesResponse.success && messagesResponse.data) {
                const uiMessages = mapApiMessagesToUi(messagesResponse.data);
                setMessages(uiMessages);
              }
            } catch (error: any) {
              console.warn('Failed to reload messages after fallback:', error);
              // Continue - messages are already in local state
            }
          }
          
          refreshConversations();
        } else {
          throw streamError; // Re-throw original error if fallback also fails
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setIsStreaming(false);
      
      // Extract error message
      let errorMessage = 'Failed to get AI response';
      let showUpgradeLink = false;
      let errorCode = '';
      
      if (err.response?.status === 403) {
        // Handle 403 Forbidden - subscription limit reached
        const errorData = err.response?.data?.error;
        errorCode = errorData?.code || 'FORBIDDEN';
        
        if (errorCode === 'QUERY_LIMIT_EXCEEDED') {
          const used = errorData?.used || 0;
          const limit = errorData?.limit || 0;
          errorMessage = `You have reached your query limit for your current plan. You've used ${used} of ${limit} queries this month.`;
          showUpgradeLink = true;
        } else if (errorCode === 'FEATURE_NOT_AVAILABLE') {
          const currentTier = errorData?.currentTier || 'free';
          const requiredTier = errorData?.requiredTier || 'premium';
          errorMessage = `This feature requires a ${requiredTier} subscription. Your current tier is ${currentTier}.`;
          showUpgradeLink = true;
        } else {
          errorMessage = errorData?.message || 'Access denied. This feature may require a premium subscription.';
          showUpgradeLink = true;
        }
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);

      // Remove the empty assistant message on error
      setMessages((prev) => prev.slice(0, -1));
    }
  };


  // 7.1 Exit research mode: offer research session summary when there is on-topic Q&A
  const handleExitResearchMode = () => {
    const hasEligible = currentConversationId && selectedTopic && messages.some(
      (m) => m.role === 'assistant' && (m.content?.length || 0) > 100
    );
    if (hasEligible) {
      setShowResearchSummaryModal(true);
    } else {
      // Clear conversation's topic_id so Research badge disappears from list
      if (currentConversationId) {
        conversationApi.update(currentConversationId, { topicId: null }).then(() => refreshConversations()).catch(console.warn);
      }
      setSelectedTopic(null);
    }
  };

  const handleCloseResearchSummaryModal = () => {
    setShowResearchSummaryModal(false);
    // Clear conversation's topic_id so Research badge disappears from list
    if (currentConversationId) {
      conversationApi.update(currentConversationId, { topicId: null as any }).then(() => refreshConversations()).catch(console.warn);
    }
    setSelectedTopic(null);
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];
    if (message.role !== 'user') return;

    const resendHistory = messages
      .slice(0, messageIndex)
      .map((m) => ({ role: m.role, content: m.content }));

    flushSync(() => {
      setMessages((prev) => {
        const updated = prev.slice(0, messageIndex + 1);
        updated[messageIndex] = { ...message, content: newContent };
        return updated;
      });
    });

    await handleSend(newContent, undefined, {
      isResend: true,
      resendUserMessageId: message.id,
      resendHistory,
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <ResearchModeBanner onExit={handleExitResearchMode} />
      {/* Messages - Centered layout like Perplexity */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full mb-4">
                  <MessageSquare className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  👋 Welcome to QueryAI!
                </h3>
                <p className="text-gray-600 mb-1">
                  Start a conversation by asking a question.
                </p>
                <p className="text-sm text-gray-500">
                  I can search your documents and the web to provide comprehensive answers with sources.
                </p>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            // Find the user question that preceded this assistant message
            const userQuestion = index > 0 && message.role === 'assistant' 
              ? messages[index - 1]?.content 
              : undefined;
            
            return (
              <ChatMessage 
                key={message.id} 
                message={message}
                onEdit={handleEditMessage}
                onFollowUpClick={(question) => {
                  handleSend(question);
                }}
                userQuestion={userQuestion}
                selectedTopicName={selectedTopic?.name ?? null}
                onExitResearchMode={handleExitResearchMode}
                onActionResponse={async (content, actionType) => {
                  const actionMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content,
                    timestamp: new Date(),
                    sources: message.sources,
                    isActionResponse: true,
                  };
                  setMessages((prev) => [...prev, actionMessage]);
                  if (currentConversationId && actionType) {
                    try {
                      await conversationApi.saveMessage(currentConversationId, {
                        role: 'assistant',
                        content,
                        sources: message.sources,
                        metadata: { isActionResponse: true, actionType },
                      });
                    } catch (err) {
                      console.warn('Failed to persist action response:', err);
                      toast.error('Could not save to conversation');
                    }
                  }
                }}
                isStreaming={isStreaming && index === messages.length - 1}
              />
            );
          })}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-800">{error}</p>
                {(error.includes('limit') || error.includes('subscription') || error.includes('tier') || error.includes('plan')) ? (
                  <button
                    onClick={() => {
                      // Dispatch custom event to navigate to subscription tab
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('navigateToSubscription'));
                        toast.info('Opening Subscription tab...');
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 underline font-medium self-start mt-1"
                  >
                    Upgrade your plan →
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

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

      {/* Input - Centered layout */}
      <div className="bg-white border-t border-gray-200 shadow-lg relative">
        <div className="max-w-3xl mx-auto pb-4">
          {/* 6.1 Dynamic AI-generated or on-topic suggested starters when in research mode */}
          {selectedTopic && (
            <div className="px-4 pt-3 pb-1">
              <span className="text-xs text-gray-500 mr-2">Try:</span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  (dynamicStarters && dynamicStarters.length > 0
                    ? dynamicStarters.slice(0, 4)
                    : Array.isArray(selectedTopic.scope_config?.suggested_starters) &&
                      selectedTopic.scope_config.suggested_starters.length > 0
                    ? selectedTopic.scope_config.suggested_starters.slice(0, 4)
                    : [
                        `What are the key concepts in ${selectedTopic.name}?`,
                        `How does ${selectedTopic.name} work in practice?`,
                      ]
                  ) as string[]
                ).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    disabled={isLoading || isStreaming}
                    className="px-2.5 py-1 text-xs rounded-full bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 disabled:opacity-50"
                  >
                    {q.length > 50 ? q.slice(0, 47) + '...' : q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ChatInput
            onSend={(msg) => handleSend(msg)}
            disabled={isLoading || isStreaming}
            placeholder="Ask me anything..."
          />
        </div>
      </div>
    </div>
  );
};
