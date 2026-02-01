'use client';

import React, { useState } from 'react';
import { X, Download, FileText, FileJson, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Conversation, Message } from '@/lib/api';
import { exportConversation, ExportOptions } from '@/lib/utils/export-conversation';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';

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
  const { isMobile } = useMobile();
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
    { value: 'pdf' as const, label: 'PDF', icon: FileText, description: 'Best for printing and sharing' },
    { value: 'markdown' as const, label: 'Markdown', icon: FileText, description: 'Best for documentation' },
    { value: 'json' as const, label: 'JSON', icon: FileJson, description: 'Best for data processing' },
  ];

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
        isMobile && 'p-0',
        className
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-white shadow-xl flex flex-col",
          isMobile 
            ? "w-full h-full rounded-none max-h-none" 
            : "rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        )}
        style={isMobile ? {
          marginTop: 'env(safe-area-inset-top)',
          marginBottom: 'env(safe-area-inset-bottom)',
        } : {}}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between border-b border-gray-200 flex-shrink-0",
          isMobile ? "px-4 py-3" : "px-6 py-4"
        )}>
          <div className="flex items-center gap-2">
            <Download className={cn(isMobile ? "w-5 h-5" : "w-5 h-5", "text-gray-600")} />
            <h2 className={cn(
              "font-semibold text-gray-900",
              isMobile ? "text-base" : "text-lg"
            )}>
              Export Conversation
            </h2>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation",
              isMobile ? "p-2 min-w-[44px] min-h-[44px]" : "p-1.5"
            )}
            aria-label="Close dialog"
          >
            <X className={cn(isMobile ? "w-6 h-6" : "w-5 h-5")} />
          </button>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 overflow-y-auto min-h-0",
          isMobile ? "p-4 space-y-4" : "p-6 space-y-6"
        )}>
          {/* Conversation Info */}
          <div className={cn(
            "bg-gray-50 rounded-lg border border-gray-200",
            isMobile ? "p-3" : "p-4"
          )}>
            <div className={cn(
              "font-medium text-gray-900 mb-1",
              isMobile ? "text-base" : "text-sm"
            )}>
              {conversation.title || 'Untitled Conversation'}
            </div>
            <div className={cn(
              "text-gray-500",
              isMobile ? "text-sm" : "text-xs"
            )}>
              {messages.length} message{messages.length !== 1 ? 's' : ''} • Created{' '}
              {new Date(conversation.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className={cn(
              "block font-medium text-gray-900 mb-3",
              isMobile ? "text-base" : "text-sm"
            )}>
              Export Format
            </label>
            <div className={cn(
              "space-y-2",
              isMobile && "flex flex-col"
            )}>
              {formats.map((format) => {
                const Icon = format.icon;
                return (
                  <label
                    key={format.value}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border-2 cursor-pointer transition-all touch-manipulation min-h-[60px]',
                      isMobile ? "p-4" : "p-3",
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
                      className={cn(
                        "mt-1 text-orange-600 border-gray-300 focus:ring-orange-500",
                        isMobile ? "w-5 h-5" : "w-4 h-4"
                      )}
                    />
                    <Icon className={cn(
                      "text-gray-600 mt-0.5 flex-shrink-0",
                      isMobile ? "w-6 h-6" : "w-5 h-5"
                    )} />
                    <div className="flex-1">
                      <div className={cn(
                        "font-medium text-gray-900",
                        isMobile ? "text-base" : "text-sm"
                      )}>
                        {format.label}
                      </div>
                      <div className={cn(
                        "text-gray-500 mt-0.5",
                        isMobile ? "text-sm" : "text-xs"
                      )}>
                        {format.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <label className={cn(
              "block font-medium text-gray-900 mb-3",
              isMobile ? "text-base" : "text-sm"
            )}>
              Export Options
            </label>

            <label className={cn(
              "flex items-center justify-between rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer touch-manipulation min-h-[60px]",
              isMobile ? "p-4" : "p-3"
            )}>
              <div>
                <div className={cn(
                  "font-medium text-gray-900",
                  isMobile ? "text-base" : "text-sm"
                )}>
                  Include Sources
                </div>
                <div className={cn(
                  "text-gray-500 mt-0.5",
                  isMobile ? "text-sm" : "text-xs"
                )}>
                  Include source references and metadata
                </div>
              </div>
              <input
                type="checkbox"
                checked={exportOptions.includeSources ?? true}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeSources: e.target.checked })
                }
                className={cn(
                  "text-orange-600 border-gray-300 rounded focus:ring-orange-500",
                  isMobile ? "w-5 h-5" : "w-4 h-4"
                )}
              />
            </label>

            <label className={cn(
              "flex items-center justify-between rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer touch-manipulation min-h-[60px]",
              isMobile ? "p-4" : "p-3"
            )}>
              <div>
                <div className={cn(
                  "font-medium text-gray-900",
                  isMobile ? "text-base" : "text-sm"
                )}>
                  Include Citations
                </div>
                <div className={cn(
                  "text-gray-500 mt-0.5",
                  isMobile ? "text-sm" : "text-xs"
                )}>
                  Include inline citation links and references
                </div>
              </div>
              <input
                type="checkbox"
                checked={exportOptions.includeCitations ?? true}
                onChange={(e) =>
                  setExportOptions({ ...exportOptions, includeCitations: e.target.checked })
                }
                className={cn(
                  "text-orange-600 border-gray-300 rounded focus:ring-orange-500",
                  isMobile ? "w-5 h-5" : "w-4 h-4"
                )}
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "flex items-center border-t border-gray-200 bg-gray-50 flex-shrink-0",
          isMobile 
            ? "flex-col gap-3 px-4 py-4 pb-safe-area-inset-bottom" 
            : "justify-end gap-3 px-6 py-4"
        )}>
          <Button 
            onClick={onClose} 
            variant="outline" 
            disabled={isExporting}
            className={isMobile ? "w-full" : ""}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || messages.length === 0}
            className={cn(
              "bg-orange-600 hover:bg-orange-700 text-white",
              isMobile && "w-full"
            )}
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
