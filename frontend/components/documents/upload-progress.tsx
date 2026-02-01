'use client';

import React from 'react';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  speed?: number; // bytes per second
  eta?: number; // seconds remaining
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadProgressItem[];
  onCancel?: (id: string) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  uploads,
  onCancel,
  onDismiss,
  className,
}) => {
  const { isMobile } = useMobile();
  if (uploads.length === 0) return null;

  const formatSpeed = (bytesPerSecond?: number): string => {
    if (!bytesPerSecond) return '';
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatETA = (seconds?: number): string => {
    if (!seconds || seconds < 0) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={cn('space-y-3 sm:space-y-2', className)}>
      {uploads.map((upload) => (
        <div
          key={upload.id}
          className={cn(
            "bg-white border border-gray-200 rounded-lg shadow-sm",
            isMobile ? "p-4" : "p-3"
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-3 sm:mb-2">
            <div className="flex items-start gap-3 sm:gap-2 flex-1 min-w-0">
              <Upload
                className={cn(
                  'flex-shrink-0',
                  isMobile ? 'w-6 h-6 mt-0.5' : 'w-4 h-4 mt-0.5',
                  upload.status === 'completed' && 'text-green-600',
                  upload.status === 'error' && 'text-red-600',
                  (upload.status === 'uploading' || upload.status === 'processing') && 'text-orange-600'
                )}
              />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-gray-900 truncate",
                  isMobile ? "text-base" : "text-sm"
                )}>
                  {upload.fileName}
                </p>
                <div className={cn(
                  "flex items-center gap-3 mt-1.5 sm:mt-1",
                  isMobile ? "flex-wrap" : ""
                )}>
                  {upload.status === 'uploading' && upload.speed && (
                    <span className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      {formatSpeed(upload.speed)}
                    </span>
                  )}
                  {upload.status === 'uploading' && upload.eta && (
                    <span className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      {formatETA(upload.eta)} remaining
                    </span>
                  )}
                  {upload.status === 'processing' && (
                    <span className={cn("text-orange-600", isMobile ? "text-sm" : "text-xs")}>
                      Processing...
                    </span>
                  )}
                  {upload.status === 'completed' && (
                    <span className={cn("text-green-600 flex items-center gap-1.5 sm:gap-1", isMobile ? "text-sm" : "text-xs")}>
                      <CheckCircle2 className={cn(isMobile ? "w-4 h-4" : "w-3 h-3")} />
                      Completed
                    </span>
                  )}
                  {upload.status === 'error' && (
                    <span className={cn("text-red-600 flex items-center gap-1.5 sm:gap-1", isMobile ? "text-sm" : "text-xs")}>
                      <AlertCircle className={cn(isMobile ? "w-4 h-4" : "w-3 h-3")} />
                      {upload.error || 'Upload failed'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-1 flex-shrink-0">
              {(upload.status === 'uploading' || upload.status === 'processing') && onCancel && (
                <Button
                  variant="outline"
                  size={isMobile ? "md" : "sm"}
                  onClick={() => onCancel(upload.id)}
                  className={cn(
                    "text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 touch-manipulation",
                    isMobile ? "h-11 px-4 font-medium" : "h-7 px-2"
                  )}
                  title="Cancel upload"
                >
                  <X className={cn(isMobile ? "w-5 h-5 mr-1.5" : "w-3.5 h-3.5")} />
                  {isMobile && <span>Cancel</span>}
                </Button>
              )}
              {(upload.status === 'completed' || upload.status === 'error') && onDismiss && (
                <Button
                  variant="ghost"
                  size={isMobile ? "md" : "sm"}
                  onClick={() => onDismiss(upload.id)}
                  className={cn(
                    "text-gray-400 hover:text-gray-600 touch-manipulation",
                    isMobile ? "h-11 w-11" : "h-7 px-2"
                  )}
                  title="Dismiss"
                >
                  <X className={cn(isMobile ? "w-5 h-5" : "w-3.5 h-3.5")} />
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar - Larger on mobile */}
          {(upload.status === 'uploading' || upload.status === 'processing') && (
            <div className="mt-3 sm:mt-2">
              <div className={cn(
                "flex items-center justify-between text-gray-600 mb-2 sm:mb-1",
                isMobile ? "text-sm font-medium" : "text-xs"
              )}>
                <span>
                  {upload.status === 'uploading' ? 'Uploading' : 'Processing'}...
                </span>
                <span className="font-semibold">{upload.progress}%</span>
              </div>
              <div className={cn(
                "w-full bg-gray-200 rounded-full",
                isMobile ? "h-3" : "h-2"
              )}>
                <div
                  className={cn(
                    'rounded-full transition-all duration-300',
                    isMobile ? 'h-3' : 'h-2',
                    upload.status === 'uploading' && 'bg-orange-600',
                    upload.status === 'processing' && 'bg-purple-600'
                  )}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
