'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Message, Source } from './chat-message';
import { TypingIndicator } from './typing-indicator';
import { ChatInput } from './chat-input';
import { RAGSourceSelector, RAGSettings } from './rag-source-selector';
import { aiApi, QuestionRequest, documentApi, conversationApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { useConversationStore } from '@/lib/store/conversation-store';
import { Alert } from '@/components/ui/alert';
import { Sparkles, MessageSquare, Filter, X } from 'lucide-react';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[] | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentConversationId, createConversation, refreshConversations, conversations, updateConversationFilters } = useConversationStore();
  
  // Conversation filter settings state
  const [conversationFilters, setConversationFilters] = useState<{ topic?: string; timeRange?: any; startDate?: string; endDate?: string; country?: string }>({});
  
  // RAG settings state
  const [ragSettings, setRagSettings] = useState<RAGSettings>(() => {
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
          
          // Load conversation details to get filters from metadata
          const conversationResponse = await conversationApi.get(currentConversationId);
          if (conversationResponse.success && conversationResponse.data) {
            const conversation = conversationResponse.data;
            if (conversation.metadata?.filters) {
              setConversationFilters(conversation.metadata.filters);
            } else {
              setConversationFilters({});
            }
          }
        } catch (error: any) {
          console.error('Failed to load conversation data:', error);
          setMessages([]);
          setConversationFilters({});
        }
      } else {
        setMessages([]);
        setConversationFilters({});
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

  // Save RAG settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ragSettings', JSON.stringify(ragSettings));
    }
  }, [ragSettings]);

  const handleSend = async (content: string, filters?: { topic?: string; timeRange?: any; startDate?: string; endDate?: string; country?: string }) => {
    if (!content.trim() || isLoading) return;

    // Use provided filters if available, otherwise use conversation filters
    // If filters are provided (even if same), they take precedence for this message
    const activeFilters = filters !== undefined ? filters : conversationFilters;
    
    // Always save filters to conversation if they're provided and we have a conversation
    // This ensures filters are updated even if they're the same (in case user wants to keep them)
    if (filters !== undefined && currentConversationId) {
      try {
        await updateConversationFilters(currentConversationId, filters);
        // Update local state immediately so UI reflects the change
        setConversationFilters(filters);
      } catch (error: any) {
        console.warn('Failed to save filters:', error);
        // Continue anyway - use the filters for this request even if save failed
      }
    }

    // Ensure we have a conversation
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        // Create conversation with title from first message
        const title = content.length > 50 ? content.substring(0, 47) + '...' : content;
        const newConversation = await createConversation(title);
        conversationId = newConversation.id;
        
        // Save filters to new conversation if provided
        if (filters !== undefined && Object.keys(filters).length > 0) {
          try {
            await updateConversationFilters(conversationId, filters);
            setConversationFilters(filters);
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
        // Web search options (for backward compatibility)
        enableSearch: ragSettings.enableWebSearch, // Map to enableWebSearch
        topic: activeFilters?.topic?.trim(), // Topic/keyword filtering
        timeRange: activeFilters?.timeRange, // Time range filtering
        startDate: activeFilters?.startDate, // Custom start date
        endDate: activeFilters?.endDate, // Custom end date
        country: activeFilters?.country, // Location filtering
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
            topic: activeFilters?.topic?.trim(),
            timeRange: activeFilters?.timeRange,
            startDate: activeFilters?.startDate,
            endDate: activeFilters?.endDate,
            country: activeFilters?.country,
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
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4 space-y-3">
          {/* Top row: Title and Clear button */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Query Assistant</h2>
                <p className="text-xs text-gray-500">Powered by RAG (Documents + Web Search)</p>
              </div>
            </div>
          </div>
          
          {/* Active Filters Display */}
          {currentConversationId && Object.keys(conversationFilters).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Active Filters:
              </span>
              {conversationFilters.topic && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                  Keyword: {conversationFilters.topic}
                </span>
              )}
              {conversationFilters.timeRange && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                  Time: {conversationFilters.timeRange === 'day' ? 'Last 24 hours' : conversationFilters.timeRange === 'week' ? 'Last week' : conversationFilters.timeRange === 'month' ? 'Last month' : conversationFilters.timeRange === 'year' ? 'Last year' : conversationFilters.timeRange}
                </span>
              )}
              {(conversationFilters.startDate || conversationFilters.endDate) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                  {conversationFilters.startDate} - {conversationFilters.endDate}
                </span>
              )}
              {conversationFilters.country && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                  Country: {conversationFilters.country}
                </span>
              )}
              <button
                onClick={async () => {
                  try {
                    await updateConversationFilters(currentConversationId, {});
                    setConversationFilters({});
                  } catch (error: any) {
                    toast.error('Failed to clear filters');
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Clear all filters"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
          
          {/* RAG Source Selector */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Source Selection:</span>
              <RAGSourceSelector
                settings={ragSettings}
                onChange={setRagSettings}
                documentCount={documentCount}
                hasProcessedDocuments={hasProcessedDocuments}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

      {/* Input */}
      <div className="bg-white border-t border-gray-200 shadow-lg relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading || isStreaming}
            conversationFilters={conversationFilters}
            placeholder="Ask me anything..."
          />
        </div>
      </div>
    </div>
  );
};
