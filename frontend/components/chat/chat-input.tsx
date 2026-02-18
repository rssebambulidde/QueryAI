'use client';

import React, { useState, KeyboardEvent, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Plus, Square, Loader2, X, RefreshCw } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** Accepted MIME types for document upload */
const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

/** Accepted file extensions for document upload */
const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.csv', '.docx', '.doc'];

/** Maximum file size in bytes (50MB) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Check if a file is an accepted document type */
function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showQueueOption?: boolean;
  onSendToQueue?: (message: string) => void;
  activeQueueJobId?: string | null;
  onCancelQueueJob?: () => void;
  /** Callback when user selects a file - parent handles actual upload */
  onFileSelect?: (file: File) => void;
  /** Upload status passed from parent */
  uploadStatus?: UploadStatus | null;
  /** Cancel current upload */
  onCancelUpload?: () => void;
  /** Retry failed upload */
  onRetryUpload?: () => void;
  /** Dismiss upload status banner */
  onDismissUpload?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  showQueueOption,
  onSendToQueue,
  activeQueueJobId,
  onCancelQueueJob,
  onFileSelect,
  uploadStatus,
  onCancelUpload,
  onRetryUpload,
  onDismissUpload,
}) => {
  const { isMobile } = useMobile();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePlusClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setValidationError(null);

    if (files && files.length > 0) {
      const file = files[0];

      // Validate file type
      if (!isAcceptedFile(file)) {
        setValidationError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
        e.target.value = '';
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setValidationError(`File too large (${formatFileSize(file.size)}). Maximum: ${formatFileSize(MAX_FILE_SIZE)}`);
        e.target.value = '';
        return;
      }

      // Pass to parent for upload handling
      if (onFileSelect) {
        onFileSelect(file);
      }
    }

    e.target.value = '';
  };

  const isUploading = uploadStatus?.status === 'uploading';
  const isUploadError = uploadStatus?.status === 'error';
  const isUploadComplete = uploadStatus?.status === 'completed';

  return (
    <div className="relative py-3">
      {/* Validation error banner */}
      {validationError && (
        <div className="mb-2 mx-4 flex items-center justify-between gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200 text-xs">
          <span className="text-red-700">{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload status banner */}
      {uploadStatus && (
        <div className="mb-2 mx-4 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
          <span className="font-medium text-gray-700 truncate max-w-[150px]">{uploadStatus.fileName}</span>

          {isUploading && (
            <>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadStatus.progress}%` }}
                />
              </div>
              <span className="text-gray-500 text-xs">{uploadStatus.progress}%</span>
              {onCancelUpload && (
                <button
                  type="button"
                  onClick={onCancelUpload}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Cancel upload"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {isUploadComplete && (
            <>
              <span className="text-green-600 ml-auto">Uploaded</span>
              {onDismissUpload && (
                <button
                  type="button"
                  onClick={onDismissUpload}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {isUploadError && (
            <>
              <span className="text-red-500 truncate">{uploadStatus.error || 'Upload failed'}</span>
              {onRetryUpload && (
                <button
                  type="button"
                  onClick={onRetryUpload}
                  className="text-orange-500 hover:text-orange-700 ml-auto flex items-center gap-1"
                  aria-label="Retry upload"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
              {onDismissUpload && (
                <button
                  type="button"
                  onClick={onDismissUpload}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pl-1 pr-4">
        {/* Plus button for upload - positioned at extreme left */}
        <button
          type="button"
          className={cn(
            'w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors',
            isUploading ? 'cursor-not-allowed' : 'hover:bg-gray-100'
          )}
          aria-label="Upload document"
          tabIndex={0}
          onClick={handlePlusClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          ) : (
            <Plus className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.csv,.docx,.doc,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={isUploading}
        />

        {/* Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400',
              'border-gray-300'
            )}
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* Send button */}
        {activeQueueJobId ? (
          <Button
            onClick={onCancelQueueJob}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all duration-200 flex items-center gap-2 touch-manipulation min-h-[44px]"
            aria-label="Cancel queued request"
          >
            <Square className="w-4 h-4" />
            {!isMobile && <span>Cancel</span>}
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 touch-manipulation min-h-[44px] ml-2"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
            {!isMobile && <span>Send</span>}
          </Button>
        )}
      </div>
    </div>
  );
};
