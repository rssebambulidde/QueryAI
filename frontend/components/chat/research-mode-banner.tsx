'use client';

import React, { useMemo } from 'react';
import { Tag, X, ChevronRight } from 'lucide-react';
import { useFilterStore } from '@/lib/store/filter-store';
import { getAncestorPath } from '@/components/topics/topic-tree-selector';
import { cn } from '@/lib/utils';

interface ResearchModeBannerProps {
  className?: string;
  onExit?: () => void; // 7.1: when provided, called instead of setSelectedTopic(null) (e.g. to offer research summary)
}

export const ResearchModeBanner: React.FC<ResearchModeBannerProps> = ({ className, onExit }) => {
  const { selectedTopic, topics, setSelectedTopic } = useFilterStore();

  const ancestors = useMemo(() => {
    if (!selectedTopic) return [];
    return getAncestorPath(selectedTopic.id, topics);
  }, [selectedTopic, topics]);

  if (!selectedTopic) return null;

  const handleExit = () => {
    if (onExit) onExit();
    else setSelectedTopic(null);
  };

  const handleBreadcrumbClick = (topic: import('@/lib/api').Topic) => {
    setSelectedTopic(topic);
  };

  const breadcrumbLabel = ancestors.length > 0
    ? `${ancestors.map(a => a.name).join(' > ')} > ${selectedTopic.name}`
    : selectedTopic.name;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 bg-orange-50 border-b border-orange-200',
        className
      )}
      role="banner"
      aria-label={`Research mode: ${breadcrumbLabel}. Exit research mode to ask about any topic.`}
    >
      <div
        className="flex items-center gap-2 min-w-0"
        title={selectedTopic.description ?? undefined}
      >
        <Tag className="w-4 h-4 text-orange-600 shrink-0" aria-hidden />
        <span className="text-sm font-medium text-orange-900 truncate flex items-center gap-1">
          Research mode:
          {ancestors.length > 0 ? (
            <span className="flex items-center gap-0.5">
              {ancestors.map((ancestor, i) => (
                <span key={ancestor.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(ancestor)}
                    className="text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
                    title={`Switch to ${ancestor.name}`}
                  >
                    {ancestor.name}
                  </button>
                  <ChevronRight className="w-3 h-3 text-orange-400" />
                </span>
              ))}
              <span className="font-semibold">{selectedTopic.name}</span>
            </span>
          ) : (
            <span className="font-semibold">{selectedTopic.name}</span>
          )}
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
