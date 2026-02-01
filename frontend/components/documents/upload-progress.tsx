'use client';

import React from 'react';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
    <div className={cn('space-y-2', className)}>
      {uploads.map((upload) => (
        <div
          key={upload.id}
          className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Upload
                className={cn(
                  'w-4 h-4 mt-0.5 flex-shrink-0',
                  upload.status === 'completed' && 'text-green-600',
                  upload.status === 'error' && 'text-red-600',
                  (upload.status === 'uploading' || upload.status === 'processing') && 'text-orange-600'
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {upload.fileName}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {upload.status === 'uploading' && upload.speed && (
                    <span className="text-xs text-gray-500">
                      {formatSpeed(upload.speed)}
                    </span>
                  )}
                  {upload.status === 'uploading' && upload.eta && (
                    <span className="text-xs text-gray-500">
                      {formatETA(upload.eta)} remaining
                    </span>
                  )}
                  {upload.status === 'processing' && (
                    <span className="text-xs text-orange-600">Processing...</span>
                  )}
                  {upload.status === 'completed' && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </span>
                  )}
                  {upload.status === 'error' && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {upload.error || 'Upload failed'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {(upload.status === 'uploading' || upload.status === 'processing') && onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(upload.id)}
                  className="h-7 px-2 text-gray-400 hover:text-gray-600"
                  title="Cancel upload"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
              {(upload.status === 'completed' || upload.status === 'error') && onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss(upload.id)}
                  className="h-7 px-2 text-gray-400 hover:text-gray-600"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {(upload.status === 'uploading' || upload.status === 'processing') && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>
                  {upload.status === 'uploading' ? 'Uploading' : 'Processing'}...
                </span>
                <span>{upload.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
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
