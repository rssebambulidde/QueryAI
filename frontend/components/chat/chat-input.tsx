'use client';

import React, { useState, useRef, useEffect, useCallback, DragEvent, ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Square, Loader2, X, RefreshCw, FileText, FileSpreadsheet, File, Clock, Upload, ChevronUp, Search, MessageCircle } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
// Document quick-select retired in Phase 2 (v2 migration)
// import { DocumentQuickSelect } from './document-quick-select';
// import type { DocumentItem } from '@/lib/api';

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

/** Format ETA for display */
function formatETA(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

/** Get file type icon based on extension */
function getFileIcon(fileName: string): React.ReactNode {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText className="w-5 h-5 text-blue-500" />;
    case 'csv':
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    case 'txt':
      return <FileText className="w-5 h-5 text-gray-500" />;
    default:
      return <File className="w-5 h-5 text-gray-400" />;
  }
}

export interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  eta?: number; // seconds remaining
  speed?: number; // bytes per second
}

/** File pending upload with preview info */
interface PendingFile {
  file: File;
  id: string;
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
  /** Callback for multiple files */
  onFilesSelect?: (files: File[]) => void;
  /** Upload status passed from parent */
  uploadStatus?: UploadStatus | null;
  /** Cancel current upload */
  onCancelUpload?: () => void;
  /** Retry failed upload */
  onRetryUpload?: () => void;
  /** Dismiss upload status banner */
  onDismissUpload?: () => void;
  /** Whether web search is enabled */
  webEnabled?: boolean;
  /** Toggle web search on/off */
  onWebToggle?: (enabled: boolean) => void;
  /** Conversation mode — chat mode hides pills/attach. */
  mode?: 'research' | 'chat';
  /** Callback to change the conversation mode via inline dropup. */
  onModeChange?: (mode: 'research' | 'chat') => void;
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
  onFilesSelect,
  uploadStatus,
  onCancelUpload,
  onRetryUpload,
  onDismissUpload,
  webEnabled,
  onWebToggle,
  mode,
  onModeChange,
}) => {
  const isChatMode = mode === 'chat';
  const { isMobile } = useMobile();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [researchHintDismissed, setResearchHintDismissed] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // Detect research-like keywords when user is in chat/Express mode
  const RESEARCH_KEYWORDS = /\b(latest|current news|recent|source|sources|evidence|study|studies|research|statistics|data|report|cite|citation|according to|fact.?check|202[4-9]|203\d)\b/i;
  const showResearchHint = isChatMode && !researchHintDismissed && message.length >= 10 && RESEARCH_KEYWORDS.test(message);

  // Reset dismissed state when mode changes
  useEffect(() => {
    setResearchHintDismissed(false);
  }, [mode]);

  // Close mode menu on outside click
  useEffect(() => {
    if (!showModeMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModeMenu]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      // Reset textarea height
      if (textInputRef.current) {
        textInputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea to fit content
  const autoResize = () => {
    const el = textInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  // Validate and process files
  const processFiles = useCallback((files: FileList | File[]) => {
    setValidationError(null);
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      if (!isAcceptedFile(file)) {
        errors.push(`${file.name}: Unsupported type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Too large (${formatFileSize(file.size)})`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setValidationError(errors.join('. '));
    }

    if (validFiles.length > 0) {
      // Show preview for confirmation
      const pending = validFiles.map((file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      }));
      setPendingFiles(pending);
    }
  }, []);

  // Confirm and upload pending files
  const confirmUpload = useCallback(() => {
    const files = pendingFiles.map((p) => p.file);
    if (files.length === 1 && onFileSelect) {
      onFileSelect(files[0]);
    } else if (files.length > 0 && onFilesSelect) {
      onFilesSelect(files);
    } else if (files.length > 0 && onFileSelect) {
      // Fallback: upload one at a time
      files.forEach((f) => onFileSelect(f));
    }
    setPendingFiles([]);
  }, [pendingFiles, onFileSelect, onFilesSelect]);

  // Cancel pending files
  const cancelPendingFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  // Remove single pending file
  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  // Paste handler for files
  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  }, [processFiles]);

  const isUploading = uploadStatus?.status === 'uploading';
  const isUploadError = uploadStatus?.status === 'error';
  const isUploadComplete = uploadStatus?.status === 'completed';

  return (
    <div 
      className="relative py-3 px-4"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-orange-50 border-2 border-dashed border-orange-400 rounded-xl z-50 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-orange-600">
            <Upload className="w-8 h-8" />
            <span className="font-medium">Drop files here</span>
            <span className="text-sm text-orange-500">PDF, DOC, TXT, CSV (max 50MB)</span>
          </div>
        </div>
      )}

      {/* Validation error banner */}
      {validationError && (
        <div 
          className="mb-2 flex items-center justify-between gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200 text-xs"
          role="alert"
          aria-live="polite"
        >
          <span className="text-red-700">{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200" role="region" aria-label="Files ready to upload">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ready to upload
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelPendingFiles}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUpload}
                className="text-xs px-3 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                Upload
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {pendingFiles.map((pf) => (
              <div key={pf.id} className="flex items-center gap-2 text-xs">
                {getFileIcon(pf.file.name)}
                <span className="flex-1 truncate text-gray-700">{pf.file.name}</span>
                <span className="text-gray-400">{formatFileSize(pf.file.size)}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(pf.id)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`Remove ${pf.file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart mode suggestion — hint to switch to Deep Research */}
      {showResearchHint && onModeChange && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <Search className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-blue-700 flex-1">This might benefit from <strong>Deep Research</strong> mode for sources &amp; citations.</span>
          <button
            type="button"
            onClick={() => { onModeChange('research'); setResearchHintDismissed(true); }}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex-shrink-0"
          >
            Switch
          </button>
          <button
            type="button"
            onClick={() => setResearchHintDismissed(true)}
            className="text-blue-400 hover:text-blue-600 flex-shrink-0"
            aria-label="Dismiss suggestion"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload status banner */}
      {uploadStatus && (
        <div 
          className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-xs"
          role="status"
          aria-live="polite"
        >
          {getFileIcon(uploadStatus.fileName)}
          <span className="font-medium text-gray-700 truncate max-w-[120px]">{uploadStatus.fileName}</span>

          {isUploading && (
            <>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadStatus.progress}%` }}
                />
              </div>
              <span className="text-gray-500 text-xs">{uploadStatus.progress}%</span>
              {uploadStatus.eta !== undefined && uploadStatus.eta > 0 && (
                <span className="text-gray-400 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatETA(uploadStatus.eta)}
                </span>
              )}
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
              <span className="text-green-600 ml-auto" aria-label="Upload complete">Uploaded</span>
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

      <div className="flex items-center gap-2">
        {/* Input container with source controls inside */}
        <div 
          ref={inputContainerRef}
          className={cn(
            'flex-1 relative flex flex-col border rounded-2xl bg-white transition-all',
            isDragging ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-300',
            'focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent'
          )}
        >
          {/* Text input */}
          <textarea
            ref={textInputRef}
            value={message}
            onChange={(e) => { setMessage(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full px-4 py-3 bg-transparent focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400 resize-none text-base leading-6 rounded-t-2xl'
            )}
            style={{ minHeight: '48px', maxHeight: '200px' }}
            aria-label="Message input"
          />

          {/* Source control pills row */}
          <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap">
            {/* Mode selector dropup */}
            {onModeChange && (
              <div ref={modeMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowModeMenu((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                    isChatMode
                      ? 'border-purple-200 bg-purple-50 text-purple-600'
                      : 'border-blue-200 bg-blue-50 text-blue-600'
                  )}
                  aria-label="Select mode"
                  aria-expanded={showModeMenu}
                  aria-haspopup="listbox"
                >
                  {isChatMode ? (
                    <MessageCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{isChatMode ? 'Express' : 'Deep Research'}</span>
                  <ChevronUp className={cn('w-3 h-3 transition-transform', showModeMenu ? 'rotate-180' : '')} />
                </button>

                {/* Dropup menu */}
                {showModeMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50" role="listbox">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isChatMode}
                      onClick={() => { onModeChange('chat'); setShowModeMenu(false); }}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors',
                        isChatMode && 'bg-purple-50/60'
                      )}
                    >
                      <MessageCircle className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Express</div>
                        <div className="text-xs text-gray-500">Quick answers and conversation</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      role="option"
                      aria-selected={!isChatMode}
                      onClick={() => { onModeChange('research'); setShowModeMenu(false); }}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors',
                        !isChatMode && 'bg-blue-50/60'
                      )}
                    >
                      <Search className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Deep Research</div>
                        <div className="text-xs text-gray-500">Sources, citations & web search</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}



          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.csv,.docx,.doc,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={isUploading}
            aria-hidden="true"
          />
        </div>

        {/* Send button */}
        {activeQueueJobId ? (
          <Button
            onClick={onCancelQueueJob}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-sm transition-all duration-200 flex items-center gap-2 touch-manipulation min-h-[52px]"
            aria-label="Cancel queued request"
          >
            <Square className="w-4 h-4" />
            {!isMobile && <span>Cancel</span>}
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 touch-manipulation min-h-[52px] ml-2"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
            {!isMobile && <span>Send</span>}
          </Button>
        )}
      </div>
      
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isUploading && `Uploading ${uploadStatus?.fileName}, ${uploadStatus?.progress}% complete`}
        {isUploadComplete && `${uploadStatus?.fileName} uploaded successfully`}
        {isUploadError && `Upload failed: ${uploadStatus?.error}`}
      </div>
    </div>
  );
};
