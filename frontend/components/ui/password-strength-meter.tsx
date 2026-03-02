'use client';

import { useMemo } from 'react';
import { validatePasswordStrength } from '@/lib/utils/password-validation';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

const COLORS: Record<string, string> = {
  weak: 'bg-red-500',
  fair: 'bg-orange-500',
  good: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const LABEL_COLORS: Record<string, string> = {
  weak: 'text-red-600',
  fair: 'text-orange-600',
  good: 'text-yellow-600',
  strong: 'text-green-600',
};

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const result = useMemo(() => validatePasswordStrength(password), [password]);

  if (!password) return null;

  const barWidth = `${(result.score / 4) * 100}%`;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', COLORS[result.label])}
            style={{ width: barWidth }}
          />
        </div>
        <span className={cn('text-xs font-medium capitalize', LABEL_COLORS[result.label])}>
          {result.label}
        </span>
      </div>

      {/* Requirements checklist */}
      {result.errors.length > 0 && (
        <ul className="space-y-0.5">
          {result.errors.map((error) => (
            <li key={error} className="text-xs text-gray-500 flex items-center gap-1">
              <span className="text-red-400">&#x2717;</span> {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
