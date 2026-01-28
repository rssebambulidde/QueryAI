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
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef<number | null>(null);
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

  // Prevent body scroll when sidebar is open
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

  // Swipe to close functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isDraggingRef.current || startXRef.current === null) return;

    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;

    // Only allow swiping left (closing)
    if (diff < 0 && sidebarRef.current) {
      const translateX = Math.max(diff, -sidebarRef.current.offsetWidth);
      sidebarRef.current.style.transform = `translateX(${translateX}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isDraggingRef.current || startXRef.current === null || currentXRef.current === null) {
      return;
    }

    const diff = currentXRef.current - startXRef.current;
    const threshold = 100; // Minimum swipe distance to close

    if (diff < -threshold && sidebarRef.current) {
      onClose();
    } else if (sidebarRef.current) {
      // Snap back
      sidebarRef.current.style.transform = '';
    }

    isDraggingRef.current = false;
    startXRef.current = null;
    currentXRef.current = null;
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

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          'fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white z-50',
          'transform transition-transform duration-300 ease-in-out',
          'shadow-xl',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
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

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-64px)]">
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
  const { isMobile } = useMobile();

  if (!isMobile) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-2 text-gray-700 hover:text-gray-900 rounded-lg transition-colors touch-manipulation',
        className
      )}
      style={{ minHeight: '44px', minWidth: '44px' }}
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6" />
    </button>
  );
};
