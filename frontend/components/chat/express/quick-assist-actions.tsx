'use client';

import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildQuickAssistActions } from '@/lib/chat/express/quick-actions';

interface QuickAssistActionsProps {
  onActionClick: (prompt: string) => void;
  userQuestion?: string;
  assistantAnswer: string;
  className?: string;
}

export const QuickAssistActions: React.FC<QuickAssistActionsProps> = ({
  onActionClick,
  userQuestion = '',
  assistantAnswer,
  className,
}) => {
  const actions = useMemo(
    () => buildQuickAssistActions(userQuestion, assistantAnswer),
    [userQuestion, assistantAnswer],
  );

  return (
    <div className={cn('mt-3 pt-3 border-t border-gray-200', className)}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-orange-500" />
        <span>Continue with:</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {actions.map((action) => (
          <button
            key={`${action.label}-${action.prompt}`}
            type="button"
            onClick={() => onActionClick(action.prompt)}
            className="text-left px-2.5 py-1.5 rounded-md border border-gray-200 bg-gray-50 text-gray-700 text-xs hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

