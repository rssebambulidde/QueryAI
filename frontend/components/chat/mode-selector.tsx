'use client';

import React from 'react';
import { Search, MessageCircle } from 'lucide-react';

interface ModeSelectorProps {
  onSelectMode: (mode: 'research' | 'chat') => void;
  welcomeGreeting?: string;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode, welcomeGreeting }) => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
      {welcomeGreeting && (
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">{welcomeGreeting}</h2>
      )}
      <p className="text-gray-500 mb-8 text-center">How would you like to chat?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {/* Deep Research */}
        <button
          onClick={() => onSelectMode('research')}
          className="group flex flex-col items-start p-5 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-500 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <span className="font-semibold text-gray-800">Deep Research</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Web-powered AI with cited sources
          </p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Fact-checking</li>
            <li>• Current events</li>
            <li>• Research</li>
          </ul>
        </button>

        {/* General Chat */}
        <button
          onClick={() => onSelectMode('chat')}
          className="group flex flex-col items-start p-5 rounded-xl border-2 border-gray-200 bg-white hover:border-purple-500 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="font-semibold text-gray-800">General Chat</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Fast AI answers from general knowledge
          </p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Quick questions</li>
            <li>• Brainstorming</li>
            <li>• Writing help</li>
          </ul>
        </button>
      </div>
    </div>
  );
};
