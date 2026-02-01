'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, FileCheck, FileBarChart, FileDown, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIActionButtonsProps {
  onSummarize: () => void;
  onWriteEssay: () => void;
  onDetailedReport: () => void;
  onExport: () => void;
  isLoading?: boolean;
  className?: string;
}

export const AIActionButtons: React.FC<AIActionButtonsProps> = ({
  onSummarize,
  onWriteEssay,
  onDetailedReport,
  onExport,
  isLoading = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const menuItems = [
    {
      label: 'Summarize',
      icon: FileText,
      onClick: onSummarize,
    },
    {
      label: 'Write Essay',
      icon: FileCheck,
      onClick: onWriteEssay,
    },
    {
      label: 'Detailed Report',
      icon: FileBarChart,
      onClick: onDetailedReport,
    },
    {
      label: 'Export PDF',
      icon: FileDown,
      onClick: onExport,
    },
  ];

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-lg',
          'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
          'transition-colors',
          'border border-transparent hover:border-gray-200',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="More actions"
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            'absolute bottom-full right-0 mb-2 z-50',
            'w-48 rounded-lg shadow-lg border border-gray-200',
            'bg-white py-1',
            'animate-in fade-in slide-in-from-bottom-2 duration-200'
          )}
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleAction(item.onClick)}
                disabled={isLoading}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700',
                  'hover:bg-gray-50 transition-colors',
                  'first:rounded-t-lg last:rounded-b-lg',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
