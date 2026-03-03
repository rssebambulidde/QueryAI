'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableItemProps {
    children: React.ReactNode;
    onDelete?: () => void;
    deleteLabel?: string;
    className?: string;
    /** Threshold in pixels at which the action reveals */
    threshold?: number;
}

/**
 * Swipeable row component.
 * Swipe left to reveal a delete button on mobile.
 * On desktop, the delete button reveals on hover.
 */
export const SwipeableItem: React.FC<SwipeableItemProps> = ({
    children,
    onDelete,
    deleteLabel = 'Delete',
    className,
    threshold = 60,
}) => {
    const startXRef = useRef<number | null>(null);
    const [offset, setOffset] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const reset = () => {
        setOffset(0);
        setRevealed(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        startXRef.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startXRef.current === null) return;
        const deltaX = e.touches[0].clientX - startXRef.current;
        // Only allow leftward swipe (negative delta)
        if (deltaX > 0) {
            reset();
            return;
        }
        const clampedOffset = Math.max(deltaX, -threshold - 10);
        setOffset(clampedOffset);
        setRevealed(clampedOffset <= -threshold * 0.7);
    };

    const handleTouchEnd = () => {
        if (revealed) {
            setOffset(-threshold);
        } else {
            reset();
        }
        startXRef.current = null;
    };

    return (
        <div
            ref={containerRef}
            className={cn('relative group', className)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Delete action behind the row */}
            <div
                className={cn(
                    'absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white text-xs font-medium transition-all duration-200',
                    revealed ? 'w-16 opacity-100' : 'w-0 opacity-0'
                )}
                style={{ width: revealed ? Math.abs(offset) : 0 }}
            >
                {onDelete && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                            reset();
                        }}
                        className="h-full w-full flex items-center justify-center px-3"
                        aria-label={deleteLabel}
                    >
                        {deleteLabel}
                    </button>
                )}
            </div>

            {/* Main row content */}
            <div
                className="relative transition-transform will-change-transform"
                style={{ transform: `translateX(${offset}px)` }}
            >
                {children}
            </div>
        </div>
    );
};
