'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, DragEvent, ClipboardEvent } from 'react';
import { ArrowUp, Square, X, RefreshCw, FileText, FileSpreadsheet, File, Clock, Upload, ChevronUp, Search, MessageCircle, Paperclip, Sparkles, Plus, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/lib/hooks/use-speech-recognition';
import { useHaptics } from '@/lib/hooks/use-haptics';
import type { ChatAttachment } from './chat-types';
import { AttachmentPreviewStrip } from './attachment-preview';
import { attachmentApi } from '@/lib/api';
import { MODE_DESCRIPTIONS, MODE_LABELS, type ConversationMode } from '@/lib/chat/mode-config';

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

/** MIME types accepted for inline chat attachments (images + docs) */
const INLINE_ACCEPTED_TYPES = [
  ...ACCEPTED_TYPES,
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

/** Max inline attachment file size — 10 MB (sent as base64 in JSON body) */
const INLINE_MAX_SIZE = 50 * 1024 * 1024; // 50 MB — matches backend multer limit

/** Max number of inline attachments per message */
const INLINE_MAX_COUNT = 5;

// ── Attachment-based question suggestions ─────────────────────────────────────

/** Generate contextual question suggestions based on attached file types & names. */
function generateAttachmentSuggestions(attachments: ChatAttachment[]): string[] {
  if (attachments.length === 0) return [];

  const docs = attachments.filter((a) => a.type === 'document');
  const images = attachments.filter((a) => a.type === 'image');

  // If only images, image-specific suggestions
  if (docs.length === 0 && images.length > 0) {
    return [
      'Describe what you see in this image',
      'Extract all text from this image',
      'What are the key details here?',
    ];
  }

  // Detect file types among documents
  const hasCSV = docs.some((d) => d.mimeType === 'text/csv' || d.name.toLowerCase().endsWith('.csv'));
  const hasPDF = docs.some((d) => d.mimeType === 'application/pdf' || d.name.toLowerCase().endsWith('.pdf'));
  const hasSpreadsheet = hasCSV;
  const docName = docs.length === 1 ? docs[0].name : undefined;

  // Domain-specific: CSV / spreadsheet data
  if (hasSpreadsheet) {
    const suggestions = [
      'Summarize this data',
      'What trends do you see in this data?',
      'List the key statistics and totals',
    ];
    if (docs.length > 1) suggestions.push('Compare the data across these files');
    return suggestions;
  }

  // General document suggestions
  const suggestions: string[] = [];

  if (docName) {
    suggestions.push(`Summarize ${docName}`);
  } else {
    suggestions.push('Summarize this document');
  }

  suggestions.push('What are the key findings?');

  if (hasPDF) {
    suggestions.push('List all important dates and figures');
  } else {
    suggestions.push('What are the main points?');
  }

  if (docs.length > 1) {
    suggestions.push('Compare these documents');
  } else {
    suggestions.push('What questions does this raise?');
  }

  return suggestions.slice(0, 4);
}

/** Check if a file is an accepted document type */
function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

/** Check if a file is accepted for inline chat attachments (images + docs) */
function isInlineAcceptedFile(file: File): boolean {
  if (INLINE_ACCEPTED_TYPES.includes(file.type)) return true;
  if (file.type.startsWith('image/')) return true;
  return ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

/** Convert a File to a base64 data URI */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
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
  mode?: ConversationMode;
  /** Callback to change the conversation mode via inline dropup. */
  onModeChange?: (mode: ConversationMode) => void;
  /** Attachments active for the whole conversation (re-sent with every message). */
  activeConversationAttachments?: ChatAttachment[];
  /** Remove a single conversation-level attachment. */
  onClearConversationAttachment?: (id: string) => void;
  /** Clear all conversation-level attachments. */
  onClearAllConversationAttachments?: () => void;
  /** Optional minimum height for the textarea */
  minHeight?: number;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  activeQueueJobId,
  onCancelQueueJob,
  onFileSelect,
  onFilesSelect,
  uploadStatus,
  onCancelUpload,
  onRetryUpload,
  onDismissUpload,
  mode,
  onModeChange,
  activeConversationAttachments,
  onClearConversationAttachment,
  minHeight = 44,
}) => {
  const isChatMode = mode === 'chat';
  const { vibrate } = useHaptics();
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [dismissedResearchHintMode, setDismissedResearchHintMode] = useState<ConversationMode | null>(null);
  const [inlineAttachments, setInlineAttachments] = useState<ChatAttachment[]>([]);
  const [dismissedSuggestionKey, setDismissedSuggestionKey] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const modeKey = mode ?? 'chat';

  // Speech Recognition
  const {
    isListening,
    transcript,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Handle Speech Transcript updates
  const previousTranscriptRef = useRef('');
  useEffect(() => {
    if (transcript && transcript !== previousTranscriptRef.current) {
      // Append the new part of the transcript
      const newText = transcript.slice(previousTranscriptRef.current.length);
      setMessage((prev) => prev + newText);
      previousTranscriptRef.current = transcript;
    }
  }, [transcript]);

  useEffect(() => {
    if (!isListening) {
      previousTranscriptRef.current = '';
      resetTranscript();
    }
  }, [isListening, resetTranscript]);

  const toggleSpeechRecognition = () => {
    vibrate('medium');
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Detect research-like keywords when user is in chat/Express mode
  const RESEARCH_KEYWORDS = /\b(latest|current news|recent|source|sources|evidence|study|studies|research|statistics|data|report|cite|citation|according to|fact.?check|202[4-9]|203\d)\b/i;
  const showResearchHint = isChatMode
    && dismissedResearchHintMode !== modeKey
    && message.length >= 10
    && RESEARCH_KEYWORDS.test(message);

  // Generate contextual suggestions when attachments are present
  const allAttachments = useMemo(() => [
    ...inlineAttachments,
    ...(activeConversationAttachments ?? []),
  ], [inlineAttachments, activeConversationAttachments]);

  const attachmentSuggestions = useMemo(
    () => generateAttachmentSuggestions(allAttachments),
    [allAttachments],
  );

  const suggestionKey = useMemo(
    () => allAttachments.map((a) => a.id).join('|'),
    [allAttachments],
  );

  const showSuggestions = allAttachments.length > 0
    && attachmentSuggestions.length > 0
    && !message.trim()
    && !disabled
    && dismissedSuggestionKey !== suggestionKey;

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
    const hasInline = inlineAttachments.length > 0;
    const hasConversation = (activeConversationAttachments?.length ?? 0) > 0;
    if ((message.trim() || hasInline || hasConversation) && !disabled) {
      vibrate('light');
      // Merge: new inline attachments + active conversation-level attachments (deduplicated)
      const inlineIds = new Set(inlineAttachments.map((a) => a.id));
      const merged = [
        ...inlineAttachments,
        ...(activeConversationAttachments ?? []).filter((a) => !inlineIds.has(a.id)),
      ];
      onSend(message.trim(), merged.length > 0 ? merged : undefined);
      setMessage('');
      // Revoke object URLs to free memory
      inlineAttachments.forEach((att) => { if (att.previewUrl) URL.revokeObjectURL(att.previewUrl); });
      setInlineAttachments([]);
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

  // ── Inline attachment helpers ──────────────────────────────────────────────

  /** Add files as inline chat attachments.
   *  Documents are uploaded to the server immediately (upload-then-reference pattern)
   *  so follow-up messages only need to send the fileId, not the full base64 payload.
   *  Images still use base64 (required for vision).
   */
  const addInlineAttachments = useCallback(async (files: File[]) => {
    setValidationError(null);
    const remaining = INLINE_MAX_COUNT - inlineAttachments.length;
    if (remaining <= 0) {
      setValidationError(`Maximum ${INLINE_MAX_COUNT} attachments per message`);
      return;
    }

    const toProcess = files.slice(0, remaining);
    const errors: string[] = [];
    const newAttachments: ChatAttachment[] = [];

    for (const file of toProcess) {
      if (!isInlineAcceptedFile(file)) {
        errors.push(`${file.name}: Unsupported type`);
        continue;
      }
      if (file.size > INLINE_MAX_SIZE) {
        errors.push(`${file.name}: Too large (max 50 MB)`);
        continue;
      }
      try {
        const isImage = file.type.startsWith('image/');

        // For documents, try server-side upload first (upload-then-reference)
        if (!isImage) {
          try {
            const uploadResult = await attachmentApi.upload(file);
            if (uploadResult.success && uploadResult.data) {
              newAttachments.push({
                id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                type: 'document',
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                data: '', // No base64 — server has the file
                fileId: uploadResult.data.id,
                extractionStatus: uploadResult.data.extractionStatus,
                extractionChars: uploadResult.data.extractionChars,
                extractionReason: uploadResult.data.extractionReason,
              });
              continue; // Successfully uploaded — skip base64 fallback
            }
          } catch (uploadErr: unknown) {
            // Upload failed (e.g., anonymous user, network error) — fall back to base64
            const uploadErrMessage = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            console.warn('[ChatInput] Server upload failed, falling back to base64:', uploadErrMessage);
          }
        }

        // Base64 fallback (always used for images, fallback for documents)
        const data = await fileToBase64(file);
        newAttachments.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: isImage ? 'image' : 'document',
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        });
      } catch {
        errors.push(`${file.name}: Failed to read file`);
      }
    }

    if (files.length > remaining) {
      errors.push(`Only ${remaining} more attachment(s) allowed`);
    }
    if (errors.length > 0) setValidationError(errors.join('. '));
    if (newAttachments.length > 0) {
      setInlineAttachments((prev) => [...prev, ...newAttachments]);
      // Auto-switch to Express mode when a document is attached in deep search mode
      if (mode === 'research' && newAttachments.some((a) => a.type === 'document')) {
        onModeChange?.('chat');
      }
    }
  }, [inlineAttachments.length, mode, onModeChange]);

  /** Remove an inline attachment by ID.
   *  Also cleans up: conversation-level state, backend storage + DB row.
   */
  const removeInlineAttachment = useCallback((id: string) => {
    // Find the attachment before removing from state
    const att = inlineAttachments.find((a) => a.id === id);

    // Remove from inline state
    setInlineAttachments((prev) => prev.filter((a) => a.id !== id));

    if (att) {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);

      // Delete from backend storage + DB if it was pre-uploaded
      if (att.fileId) {
        attachmentApi.delete(att.fileId).catch((err) =>
          console.warn('[ChatInput] Failed to delete attachment from server:', err?.message || err),
        );
      }

      // Also remove from conversation-level attachments so it isn't re-sent on follow-ups
      if (onClearConversationAttachment) {
        onClearConversationAttachment(id);
      }
    }
  }, [inlineAttachments, onClearConversationAttachment]);

  /** Handle the inline (paperclip) file input change */
  const handleInlineFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addInlineAttachments(Array.from(files));
    }
    e.target.value = '';
  }, [addInlineAttachments]);

  // ── Knowledge-base upload helpers (existing) ───────────────────────────────

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
      const fileArray = Array.from(files);
      // Route images (and all files in chat mode) to inline attachments
      const inlineFiles = fileArray.filter((f) => f.type.startsWith('image/') || isChatMode);
      const kbFiles = fileArray.filter((f) => !f.type.startsWith('image/') && !isChatMode);
      if (inlineFiles.length > 0) addInlineAttachments(inlineFiles);
      if (kbFiles.length > 0) processFiles(kbFiles);
    }
  }, [processFiles, addInlineAttachments, isChatMode]);

  // Paste handler for files (images go to inline attachments)
  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    const inlineFiles: File[] = [];
    const kbFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (!file) continue;
        if (file.type.startsWith('image/') || isChatMode) {
          inlineFiles.push(file);
        } else {
          kbFiles.push(file);
        }
      }
    }

    if (inlineFiles.length > 0 || kbFiles.length > 0) {
      e.preventDefault();
      if (inlineFiles.length > 0) addInlineAttachments(inlineFiles);
      if (kbFiles.length > 0) processFiles(kbFiles);
    }
  }, [processFiles, addInlineAttachments, isChatMode]);

  const isUploading = uploadStatus?.status === 'uploading';
  const isUploadError = uploadStatus?.status === 'error';
  const isUploadComplete = uploadStatus?.status === 'completed';
  const hasMessage = message.trim().length > 0;
  const hasConversationAttachments = (activeConversationAttachments?.length ?? 0) > 0;
  const canSend = !disabled && (hasMessage || inlineAttachments.length > 0 || hasConversationAttachments);

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
            <span className="text-sm text-orange-500">Images, PDF, DOC, TXT, CSV</span>
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

      {/* Smart mode suggestion - hint to switch to Deep Research */}
      {showResearchHint && onModeChange && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <Search className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-blue-700 flex-1">This might benefit from <strong>Deep Research</strong> mode for sources &amp; citations.</span>
          <button
            type="button"
            onClick={() => { setDismissedResearchHintMode(modeKey); onModeChange('research'); }}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex-shrink-0"
          >
            Switch
          </button>
          <button
            type="button"
            onClick={() => setDismissedResearchHintMode(modeKey)}
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

      {/* Attachment-based question suggestions */}
      {showSuggestions && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          {attachmentSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setMessage(suggestion);
                setDismissedSuggestionKey(suggestionKey);
                // Focus the text input so user can edit or just press Enter
                textInputRef.current?.focus();
              }}
              className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-full transition-colors whitespace-nowrap"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div
        ref={inputContainerRef}
        className={cn(
          'w-full relative border rounded-3xl bg-white/95 backdrop-blur-sm transition-all shadow-[0_1px_3px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]',
          isDragging ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-300',
          'focus-within:ring-2 focus-within:ring-orange-400/60 focus-within:border-orange-200'
        )}
      >
        <div className="flex items-end gap-1.5 sm:gap-2 px-2.5 sm:px-3 pt-2">
          <div className="flex items-center gap-1 sm:gap-1.5 pb-1 shrink-0">
            {/* Paperclip - attach files/images for this message */}
            <button
              type="button"
              onClick={() => inlineFileInputRef.current?.click()}
              disabled={disabled || inlineAttachments.length >= INLINE_MAX_COUNT}
              className={cn(
                'flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all duration-200',
                inlineAttachments.length >= INLINE_MAX_COUNT || disabled
                  ? 'border-white/20 bg-white/40 text-gray-300 cursor-not-allowed'
                  : 'border-white/40 bg-white/60 text-gray-600 hover:bg-white hover:text-gray-800'
              )}
              aria-label="Attach files or images"
              title={`Attach files or images (${inlineAttachments.length}/${INLINE_MAX_COUNT})`}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Mode selector dropup */}
            {onModeChange && (
              <div ref={modeMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowModeMenu((v) => !v)}
                  className={cn(
                    'flex items-center justify-center gap-1 w-8 sm:w-9 h-8 sm:h-9 rounded-full border transition-all duration-200 bg-white/60',
                    isChatMode
                      ? 'border-purple-200/80 text-purple-700 hover:bg-purple-50'
                      : 'border-blue-200/80 text-blue-700 hover:bg-blue-50'
                  )}
                  aria-label="Select mode"
                  aria-expanded={showModeMenu}
                  aria-haspopup="listbox"
                >
                  <span className="flex items-center justify-center w-4 h-4 text-gray-700">
                    <Plus className="w-4 h-4" />
                  </span>
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
                        <div className="text-sm font-medium text-gray-900">{MODE_LABELS.chat}</div>
                        <div className="text-xs text-gray-500">{MODE_DESCRIPTIONS.chat}</div>
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
                        <div className="text-sm font-medium text-gray-900">{MODE_LABELS.research}</div>
                        <div className="text-xs text-gray-500">{MODE_DESCRIPTIONS.research}</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
              'flex-1 min-w-0 py-2.5 sm:py-3 px-1.5 sm:px-2 bg-transparent focus:outline-none disabled:cursor-not-allowed text-gray-900 placeholder-gray-500 resize-none text-base leading-6'
            )}
            style={{ minHeight: `${minHeight}px`, maxHeight: '200px' }}
            aria-label="Message input"
          />

          {/* Microphone button */}
          {isSpeechSupported && (
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all duration-200 shrink-0 mb-1 border',
                isListening
                  ? 'bg-red-100 text-red-600 border-red-200 animate-pulse'
                  : 'bg-white/60 text-gray-400 hover:text-gray-600 border-transparent hover:bg-gray-100'
              )}
              aria-label={isListening ? "Stop listening" : "Start speaking"}
              title="Voice Input"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          {/* Circular action button (send / cancel queue) */}
          {activeQueueJobId ? (
            <button
              type="button"
              onClick={onCancelQueueJob}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all duration-200 flex items-center justify-center touch-manipulation shrink-0 mb-1 shadow-sm"
              aria-label="Cancel queued request"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center touch-manipulation shrink-0 mb-1 transition-all duration-200',
                canSend
                  ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700 hover:scale-105'
                  : 'bg-gray-100 text-gray-500 border border-gray-300 cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Inline attachments preview strip */}
        {inlineAttachments.length > 0 && (
          <AttachmentPreviewStrip
            attachments={inlineAttachments}
            onRemove={removeInlineAttachment}
          />
        )}

        {/* Conversation-level (persistent) attachment chips */}
        {hasConversationAttachments && inlineAttachments.length === 0 && (
          <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
            <span className="text-[10px] text-gray-400 mr-0.5">Attached:</span>
            {activeConversationAttachments!.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs rounded-full border border-gray-200 bg-gray-50 text-gray-600 max-w-[160px]"
              >
                <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="truncate">{att.name}</span>
                {onClearConversationAttachment && (
                  <button
                    type="button"
                    onClick={() => onClearConversationAttachment(att.id)}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Detach ${att.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

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
        {/* Hidden file input for inline attachments (images + docs) */}
        <input
          ref={inlineFileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.docx,.doc,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          style={{ display: 'none' }}
          onChange={handleInlineFileChange}
          disabled={disabled}
          aria-hidden="true"
        />
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
