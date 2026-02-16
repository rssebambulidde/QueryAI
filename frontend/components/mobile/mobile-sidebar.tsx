'use client';

import React, { useEffect, useRef } from 'react';
import { X, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  children,
  className,
}) => {
  const { isMobile } = useMobile();
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMobile]);

  // Swipe down to close (upward modal)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isDraggingRef.current || startYRef.current === null) return;

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    // Only allow swiping down (closing)
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isDraggingRef.current || startYRef.current === null || currentYRef.current === null) {
      return;
    }

    const diff = currentYRef.current - startYRef.current;
    const threshold = 80; // Minimum swipe distance to close

    if (diff > threshold && sheetRef.current) {
      onClose();
    } else if (sheetRef.current) {
      // Snap back
      sheetRef.current.style.transform = '';
    }

    isDraggingRef.current = false;
    startYRef.current = null;
    currentYRef.current = null;
  };

  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 bg-black/50 z-40 transition-opacity',
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet (upward modal) */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed left-0 right-0 bottom-0 max-h-[85vh] bg-white z-50',
          'flex flex-col rounded-t-2xl',
          'transform transition-transform duration-300 ease-out',
          'shadow-2xl',
          isOpen ? 'translate-y-0' : 'translate-y-full',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden="true" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors touch-manipulation"
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content — flex-1 min-h-0 so account section stays visible at bottom */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col" 
          style={{ 
            maxHeight: 'calc(85vh - 80px)',
            paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

// Hamburger menu button component
interface HamburgerMenuProps {
  onClick: () => void;
  className?: string;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  onClick,
  className,
}) => {
  // Removed isMobile check - parent component controls when to render
  // This allows flexibility for fixed positioning on mobile while keeping it in nav on desktop

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-2 text-gray-700 hover:text-gray-900 rounded-lg transition-colors touch-manipulation',
        'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
        className
      )}
      style={{ minHeight: '44px', minWidth: '44px' }}
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6" />
    </button>
  );
};
