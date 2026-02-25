'use client';

import React, { useState } from 'react';
import { X, FileText, File, Image as ImageIcon, ZoomIn, CheckCircle, AlertTriangle, XCircle, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatAttachment } from './chat-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (ext === 'csv') return <FileText className="w-5 h-5 text-green-500" />;
  if (ext === 'txt') return <FileText className="w-5 h-5 text-gray-500" />;
  if (ext === 'doc' || ext === 'docx') return <FileText className="w-5 h-5 text-blue-500" />;
  return <File className="w-5 h-5 text-gray-400" />;
}

/** Small status badge shown on document chips inside message bubbles. */
function ExtractionBadge({ attachment }: { attachment: ChatAttachment }) {
  if (!attachment.extractionStatus || attachment.type === 'image') return null;

  // OCR-applied badge takes priority for scanned PDFs
  if (attachment.ocrApplied && attachment.extractionStatus !== 'failed') {
    const tooltip = attachment.extractionReason || 'Scanned PDF — text extracted via OCR (may contain errors)';
    return (
      <span className={cn('flex-shrink-0 flex items-center gap-0.5 text-blue-400')} title={tooltip}>
        <ScanLine className="w-3 h-3" />
        <span className="text-[9px] leading-none font-medium">OCR</span>
      </span>
    );
  }

  const config = {
    success: {
      icon: <CheckCircle className="w-3 h-3" />,
      className: 'text-emerald-400',
      tooltip: `Extracted ${attachment.extractionChars?.toLocaleString() ?? '?'} chars`,
    },
    truncated: {
      icon: <AlertTriangle className="w-3 h-3" />,
      className: 'text-amber-400',
      tooltip: attachment.extractionReason || 'Document was truncated to fit context budget',
    },
    failed: {
      icon: <XCircle className="w-3 h-3" />,
      className: 'text-red-400',
      tooltip: attachment.extractionReason || 'Could not extract text from this file',
    },
  }[attachment.extractionStatus];

  return (
    <span className={cn('flex-shrink-0', config.className)} title={config.tooltip}>
      {config.icon}
    </span>
  );
}

// ─── Attachment preview strip (shown in chat input) ──────────────────────────

interface AttachmentPreviewStripProps {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}

export const AttachmentPreviewStrip: React.FC<AttachmentPreviewStripProps> = ({
  attachments,
  onRemove,
  className,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div
      className={cn('flex items-center gap-2 overflow-x-auto px-3 pb-2 scrollbar-thin', className)}
      role="list"
      aria-label="Attached files"
    >
      {attachments.map((att) => (
        <div
          key={att.id}
          className="relative flex-shrink-0 group"
          role="listitem"
        >
          {att.type === 'image' ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img
                src={att.previewUrl || att.data}
                alt={att.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors z-10"
                aria-label={`Remove ${att.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 max-w-[180px]">
              {getDocIcon(att.name)}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700 truncate">{att.name}</p>
                <p className="text-[10px] text-gray-400">{formatSize(att.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors z-10"
                aria-label={`Remove ${att.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Message-bubble attachment display (read-only, no remove button) ────────

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  className?: string;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  className,
}) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className={cn('flex flex-wrap gap-2 mb-2', className)}>
        {attachments.map((att) =>
          att.type === 'image' ? (
            <button
              key={att.id}
              type="button"
              onClick={() => setLightboxSrc(att.previewUrl || att.data)}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/20 group cursor-pointer"
              aria-label={`View ${att.name}`}
            >
              <img
                src={att.previewUrl || att.data}
                alt={att.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ) : (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 border border-white/20 max-w-[200px]"
            >
              <FileText className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
              <span className="text-xs text-white/90 truncate">{att.name}</span>
              <ExtractionBadge attachment={att} />
            </div>
          )
        )}
      </div>

      {/* Lightbox overlay */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Full size preview"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
