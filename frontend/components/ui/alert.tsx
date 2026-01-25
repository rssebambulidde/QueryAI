import React from 'react';
import { cn } from '@/lib/utils';

interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  children,
  className,
}) => {
  const variants = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-orange-50 border-orange-200 text-orange-800',
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
};
