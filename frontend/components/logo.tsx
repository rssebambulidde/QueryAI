'use client';

import { useId } from 'react';
import Link from 'next/link';

interface LogoProps {
  /** Show app name next to icon. Default true on landing, can be false in nav. */
  showName?: boolean;
  /** Link href. Default "/" for landing nav. */
  href?: string;
  /** Size: "sm" (nav), "md", "lg". */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const textSizes = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

/** Logo matching favicon/icon.svg — Q circle with tail and orange accent. */
export function Logo({ showName = true, href = '/', size = 'sm', className = '' }: LogoProps) {
  const gradientId = useId().replace(/:/g, '-');
  const icon = (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${sizeClasses[size]}`}
      aria-hidden
    >
      <rect width="32" height="32" rx="7" fill={`url(#${gradientId})`} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2.5" fill="none" />
      <path d="M20 20L24 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="8" r="2.5" fill="#F97316" />
    </svg>
  );

  const content = (
    <>
      {icon}
      {showName && (
        <span className={`font-bold text-gray-900 ${textSizes[size]}`}>
          QueryAI
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center gap-2 ${className}`}
        aria-label="QueryAI – Home"
      >
        {content}
      </Link>
    );
  }

  return <span className={`inline-flex items-center gap-2 ${className}`}>{content}</span>;
}
