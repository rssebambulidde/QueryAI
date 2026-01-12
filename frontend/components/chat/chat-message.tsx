'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Link2 } from 'lucide-react';

export interface Source {
  title: string;
  url: string;
  snippet?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div
      className={cn(
        'flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start', 'max-w-[85%]')}>
        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          )}
        >
          {/* Role Label */}
          <div
            className={cn(
              'text-xs font-semibold mb-2 uppercase tracking-wide',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}
          >
            {isUser ? 'You' : 'AI Assistant'}
          </div>

          {/* Content */}
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>

          {/* Timestamp */}
          <div
            className={cn(
              'text-xs mt-2 opacity-70',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* Sources */}
        {hasSources && !isUser && (
          <div className="mt-2 w-full">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-3 h-3 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Sources</span>
            </div>
            <div className="flex flex-col gap-2">
              {message.sources!.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-blue-300 transition-all duration-200"
                >
                  <ExternalLink className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-blue-600 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 group-hover:text-blue-600 truncate">
                      {source.title}
                    </div>
                    {source.snippet && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {source.snippet}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      {new URL(source.url).hostname}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
