'use client';

import React from 'react';
import { Globe, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

export interface RAGSettings {
  enableWebSearch: boolean;
  maxWebResults?: number;
}

interface RAGSourceSelectorProps {
  settings: RAGSettings;
  onChange: (settings: RAGSettings) => void;
  className?: string;
}

export const RAGSourceSelector: React.FC<RAGSourceSelectorProps> = ({
  settings,
  onChange,
  className,
}) => {
  const { isMobile } = useMobile();

  const handleWebToggle = () => {
    onChange({
      ...settings,
      enableWebSearch: !settings.enableWebSearch,
    });
  };

  return (
    <div className={cn(
      'flex items-center gap-2',
      isMobile ? 'overflow-x-auto pb-2 scrollbar-hide' : '',
      className
    )}>
      {/* Web Search Toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleWebToggle}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all touch-manipulation',
            'min-w-[44px] min-h-[44px]',
            settings.enableWebSearch
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 cursor-pointer'
          )}
          title={settings.enableWebSearch ? 'Disable web search' : 'Enable web search'}
        >
          <Globe className={cn(
            'w-4 h-4 flex-shrink-0',
            settings.enableWebSearch ? 'text-green-600' : 'text-gray-400'
          )} />
          <span className="text-sm font-medium whitespace-nowrap">Web</span>
          {settings.enableWebSearch && (
            <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
};
