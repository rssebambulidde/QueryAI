'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col max-w-[85%]">
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              AI Assistant
            </div>
            <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            <span className="ml-2 text-xs text-gray-500">Thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
