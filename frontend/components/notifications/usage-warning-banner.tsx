'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, X, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usageApi, type UsageWarnings } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';

const DISMISS_KEY = 'usage-warning-dismissed';

function getDismissedKey(userId: string): string {
  return `${DISMISS_KEY}-${userId}`;
}

export function UsageWarningBanner() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [warnings, setWarnings] = useState<UsageWarnings | null>(null);
  const [dismissed, setDismissed] = useState(true); // start hidden

  const fetchWarnings = useCallback(async () => {
    try {
      const res = await usageApi.getWarnings();
      if (res.success && res.data) {
        setWarnings(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load warnings and check dismissal
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    fetchWarnings();

    // Check if user dismissed recently (reset daily)
    const stored = localStorage.getItem(getDismissedKey(user.id));
    if (stored) {
      const dismissedAt = Number(stored);
      const oneDayMs = 24 * 60 * 60 * 1000;
      setDismissed(Date.now() - dismissedAt < oneDayMs);
    } else {
      setDismissed(false);
    }
  }, [isAuthenticated, user, fetchWarnings]);

  const handleDismiss = () => {
    setDismissed(true);
    if (user) {
      localStorage.setItem(getDismissedKey(user.id), String(Date.now()));
    }
  };

  // Nothing to show
  if (!warnings || !warnings.approaching || warnings.warnings.length === 0 || dismissed) {
    return null;
  }

  // Pick the most critical warning
  const sorted = [...warnings.warnings].sort((a, b) => b.percentage - a.percentage);
  const top = sorted[0];
  const isOver = top.percentage >= 100;
  const isHigh = top.percentage >= 90;

  const metricLabel = top.type === 'queries' ? 'queries' : 'web searches';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm border-b',
        isOver
          ? 'bg-red-50 border-red-200 text-red-800'
          : isHigh
            ? 'bg-orange-50 border-orange-200 text-orange-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800',
      )}
    >
      <AlertTriangle className={cn(
        'w-4 h-4 flex-shrink-0',
        isOver ? 'text-red-500' : isHigh ? 'text-orange-500' : 'text-yellow-500',
      )} />

      <p className="flex-1">
        {isOver ? (
          <>You&apos;ve used <strong>100%</strong> of your monthly {metricLabel}.</>
        ) : (
          <>You&apos;ve used <strong>{Math.round(top.percentage)}%</strong> of your monthly {metricLabel}.</>
        )}
        {sorted.length > 1 && (
          <span className="text-xs opacity-70 ml-1">
            (+{sorted.length - 1} other metric{sorted.length > 2 ? 's' : ''})
          </span>
        )}
      </p>

      <button
        onClick={() => router.push('/dashboard/settings/subscription')}
        className={cn(
          'flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex-shrink-0',
          isOver
            ? 'bg-red-100 hover:bg-red-200 text-red-700'
            : isHigh
              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
              : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700',
        )}
      >
        <ArrowUp className="w-3 h-3" />
        Upgrade
      </button>

      <button
        onClick={handleDismiss}
        className="text-current opacity-50 hover:opacity-80 transition-opacity flex-shrink-0"
        title="Dismiss for today"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
