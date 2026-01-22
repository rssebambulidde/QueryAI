'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Message } from './chat-message';
import { TypingIndicator } from './typing-indicator';
import { ChatInput } from './chat-input';
import { RAGSourceSelector, RAGSettings } from './rag-source-selector';
import { aiApi, QuestionRequest, documentApi, conversationApi, topicApi, Topic, Source } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useConversationStore } from '@/lib/store/conversation-store';
import { Alert } from '@/components/ui/alert';
import { MessageSquare } from 'lucide-react';
import { UnifiedFilters } from './unified-filter-panel';

interface ChatInterfaceProps {
  ragSettings?: RAGSettings;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ ragSettings: propRagSettings }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[] | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentConversationId, createConversation, refreshConversations, conversations, updateConversationFilters } = useConversationStore();
  
  // Unified filters state (replaces conversationFilters and topic selector)
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedFilters>({
    topicId: null,
    topic: null,
  });
  
  // Topic selection state
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Load messages and filters when conversation changes
  useEffect(() => {
    const loadConversationData = async () => {
      if (currentConversationId) {
        try {
          // Load messages
          const messagesResponse = await conversationApi.getMessages(currentConversationId);
          if (messagesResponse.success && messagesResponse.data) {
            // Convert API messages to UI messages
            const uiMessages: Message[] = messagesResponse.data.map((msg) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.created_at),
              sources: msg.sources,
            }));
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
        }
      } else {
        setMessages([]);
        setUnifiedFilters({ topicId: null, topic: null });
      }
    };

    loadConversationData();
  }, [currentConversationId]);

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

  // Load topics on mount and refresh when needed
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await topicApi.list();
        if (response.success && response.data) {
          setTopics(response.data);
        }
      } catch (error) {
        console.warn('Failed to load topics:', error);
      }
    };
    loadTopics();
    
    // Refresh topics when window regains focus (in case topics were created in another tab)
    const handleFocus = () => {
      loadTopics();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Save RAG settings to localStorage when they change
  // Save RAG settings to localStorage (only if not controlled by parent)
  useEffect(() => {
    if (typeof window !== 'undefined' && !propRagSettings) {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings, propRagSettings]);

  const handleSend = async (content: string, filters?: UnifiedFilters) => {
    if (!content.trim() || isLoading) return;

    // Use provided filters if available, otherwise use unified filters
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
      // Update local state even if no conversation yet
      setUnifiedFilters(activeFilters);
    }
    
    // Update selected topic if it changed
    if (activeFilters.topic !== selectedTopic) {
      setSelectedTopic(activeFilters.topic || null);
    }

    // Ensure we have a conversation
    let conversationId = currentConversationId;
    if (!conversationId) {
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
        // Ensure we have a title (fallback if empty)
        if (!title || title.length === 0) {
          title = 'New Conversation';
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

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Use streaming for better UX
      setIsStreaming(true);
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, assistantMessage]);

      // Build request with RAG settings
      const request: QuestionRequest = {
        question: content,
        conversationHistory,
        conversationId, // Include conversation ID for saving messages
        // RAG options
        enableDocumentSearch: ragSettings.enableDocumentSearch,
        enableWebSearch: ragSettings.enableWebSearch,
        documentIds: ragSettings.documentIds,
        maxDocumentChunks: ragSettings.maxDocumentChunks,
        minScore: ragSettings.minScore,
        // Topic scoping
        topicId: activeFilters.topicId || activeFilters.topic?.id, // Topic ID for document filtering
        // Web search options (for backward compatibility)
        enableSearch: ragSettings.enableWebSearch, // Map to enableWebSearch
        topic: activeFilters.topic?.name || activeFilters.keyword, // Topic/keyword filtering (for web search)
        timeRange: activeFilters.timeRange, // Time range filtering
        startDate: activeFilters.startDate, // Custom start date
        endDate: activeFilters.endDate, // Custom end date
        country: activeFilters.country, // Location filtering
        maxSearchResults: ragSettings.maxWebResults,
      };

      try {
        // Try streaming first
        for await (const chunk of aiApi.askStream(request)) {
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

        // After streaming completes, fetch sources separately
        // This is a lightweight call that just gets the sources
        // We use a minimal request to avoid regenerating the full response
        try {
          const sourceResponse = await aiApi.ask({
            question: content,
            conversationHistory: [], // Don't include history to save tokens
            // RAG options
            enableDocumentSearch: ragSettings.enableDocumentSearch,
            enableWebSearch: ragSettings.enableWebSearch,
            documentIds: ragSettings.documentIds,
            maxDocumentChunks: ragSettings.maxDocumentChunks,
            minScore: ragSettings.minScore,
            // Web search options
            enableSearch: ragSettings.enableWebSearch,
            topic: activeFilters.topic?.name || activeFilters.keyword,
            timeRange: activeFilters.timeRange,
            startDate: activeFilters.startDate,
            endDate: activeFilters.endDate,
            country: activeFilters.country,
            maxSearchResults: ragSettings.maxWebResults,
          });
          
          if (sourceResponse.success && sourceResponse.data?.sources && sourceResponse.data.sources.length > 0) {
            assistantMessage = {
              ...assistantMessage,
              sources: sourceResponse.data.sources,
            };
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = assistantMessage;
              return updated;
            });
          }
        } catch (sourceError) {
          // If getting sources fails, continue without them
          // This is not critical - the main response is already shown
          console.warn('Failed to get sources:', sourceError);
        }

        setIsStreaming(false);
        setIsLoading(false);
        
        // Reload messages from database to ensure they're persisted and displayed
        if (conversationId) {
          try {
            const messagesResponse = await conversationApi.getMessages(conversationId);
            if (messagesResponse.success && messagesResponse.data) {
              // Convert API messages to UI messages
              const uiMessages: Message[] = messagesResponse.data.map((msg) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.created_at),
                sources: msg.sources,
              }));
              setMessages(uiMessages);
            }
          } catch (error: any) {
            console.warn('Failed to reload messages after streaming:', error);
            // Continue - messages are already in local state
          }
        }
        
        // Refresh conversations list to update last message and title (if first message)
        refreshConversations();
        
        toast.success('Response received');
      } catch (streamError: any) {
        // If streaming fails, try non-streaming as fallback
        console.warn('Streaming failed, falling back to non-streaming:', streamError);
        setIsStreaming(false);
        
        const fallbackResponse = await aiApi.ask(request);
        if (fallbackResponse.success && fallbackResponse.data) {
          assistantMessage = {
            ...assistantMessage,
            content: fallbackResponse.data.answer,
            sources: fallbackResponse.data.sources,
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
                // Convert API messages to UI messages
                const uiMessages: Message[] = messagesResponse.data.map((msg) => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  sources: msg.sources,
                }));
                setMessages(uiMessages);
              }
            } catch (error: any) {
              console.warn('Failed to reload messages after fallback:', error);
              // Continue - messages are already in local state
            }
          }
          
          // Refresh conversations list to update last message
          refreshConversations();
          
          toast.success('Response received');
        } else {
          throw streamError; // Re-throw original error if fallback also fails
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setIsStreaming(false);
      
      // Extract error message
      let errorMessage = 'Failed to get AI response';
      if (err.message) {
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


  const handleEditMessage = async (messageId: string, newContent: string) => {
    // Find the message and update it
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];
    if (message.role !== 'user') return;

    // Update the message in the UI
    setMessages((prev) => {
      const updated = [...prev];
      updated[messageIndex] = { ...message, content: newContent };
      return updated;
    });

    // Remove all messages after this one (user and assistant)
    setMessages((prev) => prev.slice(0, messageIndex + 1));

    // Resend the edited message
    await handleSend(newContent);
  };

  return (
    <div className="flex flex-col h-full bg-white">
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

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onEdit={handleEditMessage}
              onFollowUpClick={(question) => {
                // Send the follow-up question as a new message
                handleSend(question);
              }}
            />
          ))}

          {isStreaming && <TypingIndicator />}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - Centered layout */}
      <div className="bg-white border-t border-gray-200 shadow-lg relative">
        <div className="max-w-3xl mx-auto pb-4">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading || isStreaming}
            topics={topics}
            selectedTopic={selectedTopic}
            onTopicSelect={(topic) => {
              setSelectedTopic(topic);
              setUnifiedFilters(prev => ({
                ...prev,
                topicId: topic?.id || null,
                topic: topic,
                keyword: topic ? undefined : prev.keyword, // Clear keyword if topic selected
              }));
              // Update conversation topic if we have one
              if (currentConversationId) {
                conversationApi.update(currentConversationId, { topicId: topic?.id || undefined }).catch(console.warn);
              }
            }}
            unifiedFilters={unifiedFilters}
            onUnifiedFiltersChange={setUnifiedFilters}
            onLoadTopics={async () => {
              try {
                const response = await topicApi.list();
                if (response.success && response.data) {
                  setTopics(response.data);
                }
              } catch (error) {
                console.warn('Failed to load topics:', error);
              }
            }}
            placeholder="Ask me anything..."
          />
        </div>
      </div>
    </div>
  );
};
