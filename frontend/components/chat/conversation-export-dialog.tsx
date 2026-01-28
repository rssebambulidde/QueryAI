'use client';

import React, { useState } from 'react';
import { X, Download, FileText, FileJson, FilePdf, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Conversation, Message } from '@/lib/api';
import { exportConversation, ExportOptions } from '@/lib/utils/export-conversation';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface ConversationExportDialogProps {
  conversation: Conversation;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const ConversationExportDialog: React.FC<ConversationExportDialogProps> = ({
  conversation,
  messages,
  isOpen,
  onClose,
  className,
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    includeSources: true,
    includeCitations: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleExport = async () => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    setIsExporting(true);
    try {
      await exportConversation(conversation, messages, exportOptions);
      toast.success('Conversation exported successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to export conversation');
    } finally {
      setIsExporting(false);
    }
  };

  const formats = [
    { value: 'pdf' as const, label: 'PDF', icon: FilePdf, description: 'Best for printing and sharing' },
    { value: 'markdown' as const, label: 'Markdown', icon: FileText, description: 'Best for documentation' },
    { value: 'json' as const, label: 'JSON', icon: FileJson, description: 'Best for data processing' },
  ];

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
        className
      )}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Export Conversation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Conversation Info */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-900 mb-1">
              {conversation.title || 'Untitled Conversation'}
            </div>
            <div className="text-xs text-gray-500">
              {messages.length} message{messages.length !== 1 ? 's' : ''} • Created{' '}
              {new Date(conversation.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Export Format
            </label>
            <div className="space-y-2">
              {formats.map((format) => {
                const Icon = format.icon;
                return (
                  <label
                    key={format.value}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                      exportOptions.format === format.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="export-format"
                      value={format.value}
                      checked={exportOptions.format === format.value}
                      onChange={() => setExportOptions({ ...exportOptions, format: format.value })}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <Icon className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{format.label}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{format.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Export Options
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
              <div>
                <div className="font-medium text-sm text-gray-900">Include Sources</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Include source references and metadata
                </div>
              </div>
              <input
                type="checkbox"
                checked={exportOptions.includeSources ?? true}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeSources: e.target.checked })
                }
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
              <div>
                <div className="font-medium text-sm text-gray-900">Include Citations</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Include inline citation links and references
                </div>
              </div>
              <input
                type="checkbox"
                checked={exportOptions.includeCitations ?? true}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeCitations: e.target.checked })
                }
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose} variant="outline" disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || messages.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isExporting ? (
              <>
                <Download className="w-4 h-4 mr-2 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
