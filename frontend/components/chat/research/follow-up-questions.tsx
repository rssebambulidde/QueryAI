'use client';

import React, { useState } from 'react';
import { MessageSquare, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowUpQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  className?: string;
  /** Start expanded (e.g. for the first research-mode answer). */
  initialExpanded?: boolean;
}

export const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({
  questions,
  onQuestionClick,
  className,
  initialExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  if (!questions || questions.length === 0) return null;

  return (
    <div className={cn('mt-4 pt-3 border-t border-gray-200', className)}>
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full group cursor-pointer"
        aria-expanded={isExpanded}
      >
        <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
          Related questions ({questions.length})
        </span>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform duration-200',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* Expandable list */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-80 opacity-100 mt-2' : 'max-h-0 opacity-0'
        )}
      >
        <div className="flex flex-col gap-0.5 pl-1">
          {questions.map((question, index) => (
            <button
              key={index}
              onClick={() => onQuestionClick(question)}
              className={cn(
                'flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-md',
                'text-sm text-gray-600 hover:text-gray-900',
                'hover:bg-gray-100 transition-colors cursor-pointer group/item'
              )}
              title={question}
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover/item:text-orange-500 shrink-0 mt-0.5 transition-colors" />
              <span className="line-clamp-2">{question}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
