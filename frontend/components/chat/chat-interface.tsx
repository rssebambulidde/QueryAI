'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Message } from './chat-message';
import { TypingIndicator } from './typing-indicator';
import { ChatInput } from './chat-input';
import { aiApi, QuestionRequest } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Alert } from '@/components/ui/alert';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async (content: string) => {
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

      // Stream the response
      const request: QuestionRequest = {
        question: content,
        conversationHistory,
      };

      try {
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
          };
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = assistantMessage;
            return updated;
          });
          setIsLoading(false);
          toast.success('Response received (non-streaming)');
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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Chat with AI</h2>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">👋 Welcome!</p>
              <p>Start a conversation by asking a question.</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isStreaming && <TypingIndicator />}

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
  );
};
