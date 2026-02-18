'use client';

import React, { useState, KeyboardEvent, useRef, useEffect, useCallback, DragEvent, ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Plus, Square, Loader2, X, RefreshCw, FileText, FileSpreadsheet, File, Clock, Upload } from 'lucide-react';
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
}) => {
  const { isMobile } = useMobile();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [menuIndex, setMenuIndex] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Menu items for keyboard navigation
  const menuItems = [
    { id: 'add-files', label: 'Add files', icon: <Upload className="w-5 h-5 text-gray-400" /> },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showUploadMenu &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        plusButtonRef.current &&
        !plusButtonRef.current.contains(e.target as Node)
      ) {
        setShowUploadMenu(false);
        setMenuIndex(0);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUploadMenu]);

  // Keyboard shortcuts for menu
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (showUploadMenu) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setShowUploadMenu(false);
            setMenuIndex(0);
            plusButtonRef.current?.focus();
            break;
          case 'ArrowUp':
            e.preventDefault();
            setMenuIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
            break;
          case 'ArrowDown':
            e.preventDefault();
            setMenuIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
            break;
          case 'Enter':
            e.preventDefault();
            handleMenuItemClick(menuItems[menuIndex].id);
            break;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showUploadMenu, menuIndex]);

  // Focus trap for accessibility - focus first button when menu opens
  useEffect(() => {
    if (showUploadMenu && menuRef.current) {
      const firstButton = menuRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [showUploadMenu]);

  const handleMenuItemClick = (itemId: string) => {
    setShowUploadMenu(false);
    setMenuIndex(0);
    if (itemId === 'add-files') {
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

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
    setShowUploadMenu((prev) => !prev);
    setMenuIndex(0);
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
        {/* Input container with + button inside */}
        <div 
          ref={inputContainerRef}
          className={cn(
            'flex-1 relative flex items-center border rounded-xl bg-white transition-all',
            isDragging ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-300',
            'focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent'
          )}
        >
          {/* Plus button inside input */}
          <div className="relative">
            <button
              ref={plusButtonRef}
              type="button"
              className={cn(
                'w-9 h-9 ml-1 flex-shrink-0 flex items-center justify-center rounded-full transition-colors',
                isUploading ? 'cursor-not-allowed' : 'hover:bg-gray-100'
              )}
              aria-label="Upload document"
              aria-expanded={showUploadMenu}
              aria-haspopup="menu"
              tabIndex={0}
              onClick={handlePlusClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className={cn('w-5 h-5 transition-transform duration-200', showUploadMenu ? 'rotate-45 text-gray-600' : 'text-gray-400')} aria-hidden="true" />
              )}
            </button>

            {/* Upward popup menu with animation */}
            <div
              ref={menuRef}
              className={cn(
                'absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 transition-all duration-200 origin-bottom',
                isMobile ? 'left-0 right-0 min-w-[calc(100vw-2rem)] -ml-3' : 'min-w-[220px]',
                showUploadMenu 
                  ? 'opacity-100 scale-100 translate-y-0' 
                  : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
              )}
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="upload-menu-button"
            >
              {/* Menu header */}
              <div className="px-4 py-2 border-b border-gray-100 mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Attachments</span>
              </div>
              
              {menuItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuItemClick(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 transition-colors',
                    index === menuIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                  )}
                  tabIndex={showUploadMenu ? 0 : -1}
                >
                  {item.icon}
                  <div className="flex-1">
                    <span className="text-sm font-medium">{item.label}</span>
                    <p className="text-xs text-gray-400">PDF, DOC, TXT, CSV</p>
                  </div>
                </button>
              ))}

              {/* Drag hint */}
              <div className="mt-1 px-4 py-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Tip: Drag & drop or paste (Ctrl+V) files anywhere
                </p>
              </div>
            </div>
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

          {/* Text input */}
          <input
            ref={textInputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'flex-1 px-3 py-2.5 bg-transparent focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400'
            )}
            style={{ minHeight: '44px' }}
            aria-label="Message input"
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
      
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isUploading && `Uploading ${uploadStatus?.fileName}, ${uploadStatus?.progress}% complete`}
        {isUploadComplete && `${uploadStatus?.fileName} uploaded successfully`}
        {isUploadError && `Upload failed: ${uploadStatus?.error}`}
      </div>
    </div>
  );
};
