'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowUpQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  className?: string;
}

export const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({
  questions,
  onQuestionClick,
  className,
}) => {
  if (!questions || questions.length === 0) return null;

  return (
    <div className={cn('mt-4 pt-4 border-t border-gray-200', className)}>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Suggested follow-ups:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg',
              'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900',
              'border border-gray-200 hover:border-gray-300',
              'transition-colors cursor-pointer',
              'text-left max-w-full'
            )}
            title={question}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};
