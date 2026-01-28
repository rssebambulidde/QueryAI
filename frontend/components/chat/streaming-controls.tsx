'use client';

import React from 'react';
import { Pause, Play, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StreamingState = 'streaming' | 'paused' | 'cancelled' | 'error' | 'completed';

interface StreamingControlsProps {
  state: StreamingState;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const StreamingControls: React.FC<StreamingControlsProps> = ({
  state,
  onPause,
  onResume,
  onCancel,
  onRetry,
  className,
}) => {
  if (state === 'completed' || state === 'cancelled') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg',
        className
      )}
    >
      {state === 'streaming' && (
        <>
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Pause streaming"
          >
            <Pause className="w-3 h-3" />
            Pause
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Cancel streaming"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </>
      )}

      {state === 'paused' && (
        <>
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            title="Resume streaming"
          >
            <Play className="w-3 h-3" />
            Resume
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Cancel streaming"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </>
      )}

      {state === 'error' && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
          title="Retry streaming"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
};
