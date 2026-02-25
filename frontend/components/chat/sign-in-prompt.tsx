'use client';

import React from 'react';
import Link from 'next/link';
import { LogIn, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignInPromptProps {
  /** Which variant to show */
  variant: 'banner' | 'gate';
  /** Callback when the user dismisses the banner (only for banner variant) */
  onDismiss?: () => void;
  /** Custom message override */
  message?: string;
}

/**
 * Sign-in prompt shown to anonymous users.
 * - `banner`: subtle inline prompt after first answer — dismissible.
 * - `gate`: blocking overlay when session query limit is reached.
 */
export const SignInPrompt: React.FC<SignInPromptProps> = ({ variant, onDismiss, message }) => {
  if (variant === 'banner') {
    return (
      <div className="mx-auto max-w-3xl px-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <LogIn className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-gray-700">
              {message || 'Sign in to save your conversations and unlock unlimited queries.'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <Link href="/login" className="flex-1 sm:flex-initial">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 h-8 px-3 w-full sm:w-auto">
                Sign in
              </Button>
            </Link>
            <Link href="/signup" className="flex-1 sm:flex-initial">
              <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                Sign up free
              </Button>
            </Link>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-blue-100 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Gate variant — full blocking overlay
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 mb-6">
          <UserPlus className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-3">
          {message || "You've reached the free preview limit"}
        </h3>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Create a free account to continue asking questions, save your
          conversations, and access your full research history.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto min-w-[180px]">
              <UserPlus className="w-4 h-4 mr-2" />
              Sign up free
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full sm:w-auto min-w-[180px]">
              <LogIn className="w-4 h-4 mr-2" />
              Sign in
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400">No credit card required</p>
      </div>
    </div>
  );
};
