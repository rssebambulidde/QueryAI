'use client';

import React, { useState, useCallback, KeyboardEvent, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Upload, Loader2, X, FileText, Clock, Square } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onFilesDrop?: (files: File[]) => void;
  uploadStatus?: UploadStatus | null;
  onDismissUpload?: () => void;
  showQueueOption?: boolean;
  onSendToQueue?: (message: string) => void;
  activeQueueJobId?: string | null;
  onCancelQueueJob?: () => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.csv', '.docx', '.doc'];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  onFilesDrop,
  uploadStatus,
  onDismissUpload,
  showQueueOption,
  onSendToQueue,
  activeQueueJobId,
  onCancelQueueJob,
}) => {
  const { isMobile } = useMobile();
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFilesDrop) setIsDragOver(true);
  }, [onFilesDrop]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (!onFilesDrop) return;
      const files = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
      if (files.length > 0) onFilesDrop(files);
    },
    [onFilesDrop],
  );

  return (
    <div
      className="relative px-4 py-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/90 backdrop-blur-sm pointer-events-none mx-4 my-3">
          <div className="text-center">
            <Upload className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-orange-700">Drop files to upload</p>
            <p className="text-xs text-orange-500 mt-0.5">PDF, TXT, CSV, DOCX</p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploadStatus && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-medium text-gray-700 truncate">{uploadStatus.fileName}</span>
              {uploadStatus.status === 'error' && onDismissUpload && (
                <button onClick={onDismissUpload} className="p-0.5 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
              )}
            </div>
            {uploadStatus.status === 'uploading' && (
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${uploadStatus.progress}%` }} />
              </div>
            )}
            {uploadStatus.status === 'processing' && (
              <div className="flex items-center gap-1 text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing document...</span>
              </div>
            )}
            {uploadStatus.status === 'completed' && (
              <span className="text-green-600">Uploaded — ready for search</span>
            )}
            {uploadStatus.status === 'error' && (
              <span className="text-red-500">{uploadStatus.error || 'Upload failed'}</span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full px-4 py-3 pr-12 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400',
              isDragOver ? 'border-orange-400' : 'border-gray-300',
            )}
            style={{ minHeight: '48px', maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
        </div>
        <div className="flex gap-2">
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
            <>
              <Button
                onClick={handleSend}
                disabled={disabled || !message.trim()}
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 touch-manipulation min-h-[44px]"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
                {!isMobile && <span>Send</span>}
              </Button>
              {showQueueOption && onSendToQueue && (
                <Button
                  onClick={() => { if (message.trim()) { onSendToQueue(message.trim()); setMessage(''); } }}
                  disabled={disabled || !message.trim()}
                  className="px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5 touch-manipulation min-h-[44px] border border-gray-300"
                  aria-label="Send to queue"
                  title="Queue for background processing"
                >
                  <Clock className="w-4 h-4" />
                  {!isMobile && <span className="text-xs">Queue</span>}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
