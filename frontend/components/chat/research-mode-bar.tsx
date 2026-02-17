'use client';

import React from 'react';
import type { ResearchModeBarProps } from './chat-types';

/**
 * Research-mode starter-question pills.
 *
 * Renders the "Try:" label followed by horizontally-scrollable starter
 * buttons. Used in both the empty-state (centred + wrapping) and the
 * bottom input bar (horizontal scroll only).
 */
export const ResearchModeBar: React.FC<ResearchModeBarProps> = ({
  selectedTopic,
  dynamicStarters,
  onSend,
  isLoading,
  isStreaming,
  centered = false,
  className,
}) => {
  if (!selectedTopic) return null;

  const starters = (
    dynamicStarters && dynamicStarters.length > 0
      ? dynamicStarters.slice(0, 4)
      : Array.isArray(selectedTopic.scope_config?.suggested_starters) &&
          selectedTopic.scope_config.suggested_starters.length > 0
        ? selectedTopic.scope_config.suggested_starters.slice(0, 4)
        : [
            `What are the key concepts in ${selectedTopic.name}?`,
            `How does ${selectedTopic.name} work in practice?`,
          ]
  ) as string[];

  return (
    <div className={className}>
      <span className="text-xs text-gray-500 mr-2">Try:</span>
      <div
        className={`flex overflow-x-auto gap-1.5 pb-2 scrollbar-hide ${centered ? 'justify-center flex-wrap' : ''}`}
      >
        {starters.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSend(q)}
            disabled={isLoading || isStreaming}
            className="flex-shrink-0 px-3 py-2 text-xs rounded-full bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 disabled:opacity-50 touch-manipulation min-h-[44px] whitespace-nowrap"
          >
            {q.length > 50 ? q.slice(0, 47) + '...' : q}
          </button>
        ))}
      </div>
    </div>
  );
};
