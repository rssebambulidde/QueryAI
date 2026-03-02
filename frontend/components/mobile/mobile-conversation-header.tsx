'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Download, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileConversationHeaderProps {
  title: string;
  onBack: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  className?: string;
}

export const MobileConversationHeader: React.FC<MobileConversationHeaderProps> = ({
  title,
  onBack,
  onExport,
  onDelete,
  className,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'flex items-center gap-2 h-12 px-2 bg-white border-b border-gray-200 flex-shrink-0',
        className
      )}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors touch-manipulation"
        aria-label="Back to conversations"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Title */}
      <h1 className="flex-1 text-sm font-medium text-gray-900 truncate min-w-0">
        {title}
      </h1>

      {/* Overflow menu */}
      {(onExport || onDelete) && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors touch-manipulation"
            aria-label="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              {onExport && (
                <button
                  onClick={() => { setMenuOpen(false); onExport(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  Export
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
