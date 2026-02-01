'use client';

import React from 'react';
import { Button } from './button';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
  isLoading = false,
}) => {
  const { isMobile } = useMobile();
  
  if (!open) return null;

  const variantStyles = {
    danger: {
      confirm: 'bg-red-600 hover:bg-red-700 text-white',
      icon: 'text-red-600',
      border: 'border-red-200',
    },
    warning: {
      confirm: 'bg-amber-600 hover:bg-amber-700 text-white',
      icon: 'text-amber-600',
      border: 'border-amber-200',
    },
    info: {
      confirm: 'bg-blue-600 hover:bg-blue-700 text-white',
      icon: 'text-blue-600',
      border: 'border-blue-200',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          "bg-white rounded-lg shadow-xl flex flex-col border-2 border-gray-200",
          isMobile ? "w-full max-w-[90vw] max-h-[90vh]" : "max-w-md w-full"
        )}
        style={isMobile ? {
          maxHeight: 'calc(100vh - 2rem)',
          marginTop: 'env(safe-area-inset-top, 0)',
          marginBottom: 'env(safe-area-inset-bottom, 0)'
        } : {}}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <AlertCircle className={cn('w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0', styles.icon)} />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
          <p className="text-sm sm:text-base text-gray-700">{message}</p>
        </div>

        {/* Footer - Fixed, Stack buttons vertically on mobile */}
        <div className={cn(
          "flex-shrink-0 p-4 sm:p-6 border-t border-gray-200",
          isMobile ? "flex-col gap-3" : "flex-row gap-3 justify-end"
        )}>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              "touch-manipulation min-h-[44px]",
              isMobile ? "w-full" : "min-w-[100px]"
            )}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "touch-manipulation min-h-[44px]",
              isMobile ? "w-full" : "min-w-[100px]",
              styles.confirm
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
