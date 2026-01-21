'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Message, Source } from './chat-message';
import { TypingIndicator } from './typing-indicator';
import { ChatInput } from './chat-input';
import { RAGSourceSelector, RAGSettings } from './rag-source-selector';
import { aiApi, QuestionRequest, documentApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Alert } from '@/components/ui/alert';
import { Sparkles, MessageSquare, Trash2 } from 'lucide-react';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[] | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
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
        // RAG options
        enableDocumentSearch: ragSettings.enableDocumentSearch,
        enableWebSearch: ragSettings.enableWebSearch,
        documentIds: ragSettings.documentIds,
        maxDocumentChunks: ragSettings.maxDocumentChunks,
        minScore: ragSettings.minScore,
        // Web search options (for backward compatibility)
        enableSearch: ragSettings.enableWebSearch, // Map to enableWebSearch
        topic: filters?.topic?.trim(), // Topic/keyword filtering
        timeRange: filters?.timeRange, // Time range filtering
        startDate: filters?.startDate, // Custom start date
        endDate: filters?.endDate, // Custom end date
        country: filters?.country, // Location filtering
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
            topic: filters?.topic?.trim(),
            timeRange: filters?.timeRange,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            country: filters?.country,
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

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4 space-y-3">
          {/* Top row: Title and Clear button */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Chat with AI</h2>
                <p className="text-xs text-gray-500">Powered by RAG (Documents + Web Search)</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Chat
              </button>
            )}
          </div>
          
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
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full mb-4">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
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
            <ChatMessage key={message.id} message={message} />
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
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading || isStreaming}
            placeholder={
              isLoading || isStreaming
                ? 'AI is thinking...'
                : 'Ask me anything...'
            }
          />
        </div>
      </div>
    </div>
  );
};
