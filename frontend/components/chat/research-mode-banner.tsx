'use client';

import React from 'react';
import { Tag, X } from 'lucide-react';
import { useFilterStore } from '@/lib/store/filter-store';
import { cn } from '@/lib/utils';

interface ResearchModeBannerProps {
  className?: string;
  onExit?: () => void; // 7.1: when provided, called instead of setSelectedTopic(null) (e.g. to offer research summary)
}

export const ResearchModeBanner: React.FC<ResearchModeBannerProps> = ({ className, onExit }) => {
  const { selectedTopic, setSelectedTopic } = useFilterStore();

  if (!selectedTopic) return null;

  const handleExit = () => {
    if (onExit) onExit();
    else setSelectedTopic(null);
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 bg-orange-50 border-b border-orange-200',
        className
      )}
      role="banner"
      aria-label={`Research mode: ${selectedTopic.name}. Exit research mode to ask about any topic.`}
    >
      <div
        className="flex items-center gap-2 min-w-0"
        title={selectedTopic.description ?? undefined}
      >
        <Tag className="w-4 h-4 text-orange-600 shrink-0" aria-hidden />
        <span className="text-sm font-medium text-orange-900 truncate">
          Research mode: <span className="font-semibold">{selectedTopic.name}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:text-orange-900 hover:bg-orange-100 rounded-md transition-colors"
        aria-label="Exit research mode"
      >
        <X className="w-3.5 h-3.5" />
        Exit research mode
      </button>
    </div>
  );
};
