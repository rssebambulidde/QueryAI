'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Message, Source } from './chat-message';
import { TypingIndicator } from './typing-indicator';
import { ChatInput } from './chat-input';
import { SearchFilters } from './search-filters';
import { aiApi, QuestionRequest, SearchMeta } from '@/lib/api';
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

  const handleSearchMeta = (meta?: SearchMeta) => {
    if (!meta) return;
    if (meta.error) {
      toast.error(`Search unavailable: ${meta.error}`);
      return;
    }
    if (meta.attempted && meta.resultsCount === 0) {
      toast.error('Search returned no results.');
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async (content: string, filters?: SearchFilters) => {
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

      // Stream the response with search enabled by default
      const request: QuestionRequest = {
        question: content,
        conversationHistory,
        enableSearch: true, // Enable search by default
        topic: filters?.topic?.trim(), // Topic/keyword filtering
        timeRange: filters?.timeRange, // Time range filtering
        startDate: filters?.startDate, // Custom start date
        endDate: filters?.endDate, // Custom end date
        country: filters?.country, // Location filtering
        maxSearchResults: filters?.maxResults || 5,
        includeDomains: filters?.includeDomains,
        excludeDomains: filters?.excludeDomains,
        searchDepth: filters?.searchDepth,
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
            enableSearch: true,
            topic: filters?.topic?.trim(), // Include filters for source matching
            timeRange: filters?.timeRange,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            country: filters?.country,
            maxSearchResults: filters?.maxResults || 5,
            includeDomains: filters?.includeDomains,
            excludeDomains: filters?.excludeDomains,
            searchDepth: filters?.searchDepth,
          });
          
          if (sourceResponse.success) {
            handleSearchMeta(sourceResponse.data?.searchMeta);
          }

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
          handleSearchMeta(fallbackResponse.data.searchMeta);
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
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Chat with AI</h2>
              <p className="text-xs text-gray-500">Powered by real-time web search</p>
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
                  I can search the web and provide answers with sources.
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
