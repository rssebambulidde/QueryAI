'use client';

import React, { useState } from 'react';
import { Copy, X } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleNo}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {phase === 'offer' && 'Summarise this research session?'}
            {phase === 'loading' && 'Generating summary...'}
            {phase === 'result' && 'Research session summary'}
          </h3>
          <button
            type="button"
            onClick={phase === 'result' ? handleCloseResult : handleNo}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {phase === 'offer' && (
            <p className="text-gray-600 text-sm mb-4">
              Create a short research report for &quot;{topicName}&quot; from this conversation?
            </p>
          )}
          {phase === 'loading' && (
            <div className="flex items-center gap-2 text-gray-500">
              <span className="animate-pulse">●</span> Please wait...
            </div>
          )}
          {phase === 'result' && (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                {summary}
              </pre>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          {phase === 'offer' && (
            <>
              <button
                type="button"
                onClick={handleNo}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleYes}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
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
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={handleCloseResult}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
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
