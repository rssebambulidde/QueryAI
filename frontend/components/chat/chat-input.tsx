'use client';

import React, { useState, KeyboardEvent } from 'react';
import { documentApi } from '@/lib/api/documents';
import { Button } from '@/components/ui/button';
import { Send, Plus, Clock, Square } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
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
  showQueueOption,
  onSendToQueue,
  activeQueueJobId,
  onCancelQueueJob,
}) => {
  const { isMobile } = useMobile();
  const [message, setMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);

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


  // File input ref for upload
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePlusClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadStatus({ fileName: file.name, progress: 0, status: 'uploading' });
      try {
        const response = await documentApi.upload(
          file,
          (progress) => setUploadStatus((prev) => prev && prev.status === 'uploading' ? { ...prev, progress } : prev)
        );
        if (response && response.data) {
          setUploadStatus((prev) => prev ? { ...prev, status: 'completed', progress: 100 } : null);
          setTimeout(() => setUploadStatus(null), 2000);
        } else {
          setUploadStatus((prev) => prev ? { ...prev, status: 'error', error: 'Upload failed' } : null);
        }
      } catch (err: any) {
        setUploadStatus((prev) => prev ? { ...prev, status: 'error', error: err?.message || 'Upload failed' } : null);
      } finally {
        e.target.value = '';
      }
    }
  };

  return (
    <div className="relative px-4 py-3">
      {uploadStatus && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
          <span className="font-medium text-gray-700 truncate">{uploadStatus.fileName}</span>
          {uploadStatus.status === 'uploading' && (
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${uploadStatus.progress}%` }} />
            </div>
          )}
          {uploadStatus.status === 'completed' && (
            <span className="text-green-600 ml-2">Uploaded</span>
          )}
          {uploadStatus.status === 'error' && (
            <span className="text-red-500 ml-2">{uploadStatus.error || 'Upload failed'}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* Plus button for upload */}
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
          aria-label="Upload document"
          tabIndex={0}
          onClick={handlePlusClick}
          disabled={uploadStatus && uploadStatus.status === 'uploading'}
        >
          <Plus className="w-5 h-5 text-gray-500" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.csv,.docx,.doc,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={uploadStatus && uploadStatus.status === 'uploading'}
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
              'border-gray-300',
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
