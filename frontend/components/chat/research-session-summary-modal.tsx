'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, X } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResearchSessionSummaryModalProps {
  open: boolean;
  onClose: () => void;
  onRequestSummary: () => Promise<string | null>;
  topicName: string;
}

export const ResearchSessionSummaryModal: React.FC<ResearchSessionSummaryModalProps> = ({
  open,
  onClose,
  onRequestSummary,
  topicName,
}) => {
  const { isMobile } = useMobile();
  const [phase, setPhase] = useState<'offer' | 'loading' | 'result'>('offer');
  const [summary, setSummary] = useState<string>('');
  const { toast } = useToast();

  if (!open) return null;

  const handleNo = () => {
    setPhase('offer');
    setSummary('');
    onClose();
  };

  const handleYes = async () => {
    setPhase('loading');
    try {
      const s = await onRequestSummary();
      setSummary(s || 'Summary could not be generated.');
      setPhase('result');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate summary');
      setPhase('offer');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCloseResult = () => {
    setPhase('offer');
    setSummary('');
    onClose();
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
        isMobile && "p-0"
      )} 
      onClick={handleNo}
    >
      <div
        className={cn(
          "bg-white shadow-xl flex flex-col",
          isMobile 
            ? "w-full h-full rounded-none max-h-none" 
            : "rounded-xl max-w-lg w-full mx-4 max-h-[80vh]"
        )}
        style={isMobile ? {
          marginTop: 'env(safe-area-inset-top)',
          marginBottom: 'env(safe-area-inset-bottom)',
        } : {}}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "flex items-center justify-between border-b border-gray-200 flex-shrink-0",
          isMobile ? "px-4 py-3" : "p-4"
        )}>
          <h3 className={cn(
            "font-semibold text-gray-900",
            isMobile ? "text-base" : "text-lg"
          )}>
            {phase === 'offer' && 'Summarise this research session?'}
            {phase === 'loading' && 'Generating summary...'}
            {phase === 'result' && 'Research session summary'}
          </h3>
          <button
            type="button"
            onClick={phase === 'result' ? handleCloseResult : handleNo}
            className={cn(
              "text-gray-400 hover:text-gray-600 rounded touch-manipulation",
              isMobile ? "p-2 min-w-[44px] min-h-[44px]" : "p-1"
            )}
          >
            <X className={cn(isMobile ? "w-6 h-6" : "w-5 h-5")} />
          </button>
        </div>
        <div className={cn(
          "overflow-y-auto flex-1",
          isMobile ? "p-4" : "p-4"
        )}>
          {phase === 'offer' && (
            <p className={cn(
              "text-gray-600 mb-4",
              isMobile ? "text-base" : "text-sm"
            )}>
              Create a short research report for &quot;{topicName}&quot; from this conversation?
            </p>
          )}
          {phase === 'loading' && (
            <div className={cn(
              "flex items-center gap-2 text-gray-500",
              isMobile ? "text-base" : "text-sm"
            )}>
              <span className="animate-pulse">●</span> Please wait...
            </div>
          )}
          {phase === 'result' && (
            <div className={cn(
              "prose max-w-none text-gray-700 bg-gray-50 rounded-lg border border-gray-200",
              isMobile ? "p-4 prose-sm" : "p-4 prose-sm"
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ node, ...p }) => <h2 className={cn(
                    "font-bold mt-4 mb-2 first:mt-0 text-gray-900",
                    isMobile ? "text-lg" : "text-base"
                  )} {...p} />,
                  h3: ({ node, ...p }) => <h3 className={cn(
                    "font-semibold mt-3 mb-1.5 text-gray-900",
                    isMobile ? "text-base" : "text-sm"
                  )} {...p} />,
                  p: ({ node, ...p }) => <p className={cn(
                    "my-2 leading-relaxed",
                    isMobile ? "text-base" : "text-[15px]"
                  )} {...p} />,
                  ul: ({ node, ...p }) => <ul className={cn(
                    "list-disc list-outside my-2 space-y-1",
                    isMobile ? "ml-5" : "ml-4"
                  )} {...p} />,
                  ol: ({ node, ...p }) => <ol className={cn(
                    "list-decimal list-outside my-2 space-y-1",
                    isMobile ? "ml-5" : "ml-4"
                  )} {...p} />,
                  li: ({ node, ...p }) => <li className="pl-1" {...p} />,
                  strong: ({ node, ...p }) => <strong className="font-semibold text-gray-900" {...p} />,
                  a: ({ node, href, ...p }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline underline-offset-2 font-medium" {...p} />
                  ),
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className={cn(
          "flex items-center border-t border-gray-200 flex-shrink-0",
          isMobile 
            ? "flex-col gap-3 px-4 py-4 pb-safe-area-inset-bottom" 
            : "justify-end gap-2 p-4"
        )}>
          {phase === 'offer' && (
            <>
              <button
                type="button"
                onClick={handleNo}
                className={cn(
                  "text-gray-600 hover:bg-gray-100 rounded-lg touch-manipulation min-h-[44px]",
                  isMobile ? "px-4 py-2 text-base w-full" : "px-4 py-2 text-sm"
                )}
              >
                No
              </button>
              <button
                type="button"
                onClick={handleYes}
                className={cn(
                  "bg-orange-600 text-white rounded-lg hover:bg-orange-700 touch-manipulation min-h-[44px]",
                  isMobile ? "px-4 py-2 text-base w-full" : "px-4 py-2 text-sm"
                )}
              >
                Yes
              </button>
            </>
          )}
          {phase === 'result' && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "text-gray-600 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-2 touch-manipulation min-h-[44px]",
                  isMobile ? "px-4 py-2 text-base w-full" : "px-4 py-2 text-sm"
                )}
              >
                <Copy className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                Copy
              </button>
              <button
                type="button"
                onClick={handleCloseResult}
                className={cn(
                  "bg-orange-600 text-white rounded-lg hover:bg-orange-700 touch-manipulation min-h-[44px]",
                  isMobile ? "px-4 py-2 text-base w-full" : "px-4 py-2 text-sm"
                )}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
