'use client';

import React from 'react';
import { Settings, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCitationPreferencesStore,
  CitationStyle,
  CitationFormat,
} from '@/lib/store/citation-preferences-store';
import { useMobile } from '@/lib/hooks/use-mobile';

interface CitationSettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export const CitationSettings: React.FC<CitationSettingsProps> = ({
  isOpen = false,
  onClose,
  className,
}) => {
  const { preferences, setStyle, setFormat, setShowFootnotes, setShowInlineNumbers, reset } =
    useCitationPreferencesStore();
  const { isMobile } = useMobile();

  if (!isOpen) return null;

  const styles: Array<{ value: CitationStyle; label: string; description: string }> = [
    {
      value: 'inline',
      label: 'Inline',
      description: 'Citations appear as numbered badges within the text',
    },
    {
      value: 'footnote',
      label: 'Footnote',
      description: 'Citations appear as superscript numbers with footnotes at bottom',
    },
    {
      value: 'numbered',
      label: 'Numbered',
      description: 'Citations appear as numbered references in brackets [1], [2]',
    },
  ];

  const formats: Array<{ value: CitationFormat; label: string; description: string }> = [
    {
      value: 'markdown',
      label: 'Markdown',
      description: 'Citations formatted as Markdown links',
    },
    {
      value: 'html',
      label: 'HTML',
      description: 'Citations formatted as HTML anchor tags',
    },
    {
      value: 'plain',
      label: 'Plain Text',
      description: 'Citations as plain text references',
    },
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
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 flex flex-col overflow-hidden"
        style={{
          maxHeight: isMobile
            ? 'min(85vh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem))'
            : '90vh',
          marginTop: isMobile ? 'max(0.5rem, env(safe-area-inset-top, 0))' : '0',
          marginBottom: isMobile ? 'max(0.5rem, env(safe-area-inset-bottom, 0))' : '0',
          height: isMobile ? 'auto' : undefined,
          minHeight: isMobile ? 0 : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Citation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable; on small screens (e.g. iPhone 7) limit height so footer stays visible */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 min-h-0 space-y-6 overscroll-contain"
          style={isMobile ? { maxHeight: 'calc(100% - 120px)' } : undefined}
        >
          {/* Citation Style */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Citation Style
            </label>
            <div className="space-y-2">
              {styles.map((style) => (
                <label
                  key={style.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all touch-manipulation',
                    'min-h-[44px]', // Touch target
                    preferences.style === style.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name="citation-style"
                    value={style.value}
                    checked={preferences.style === style.value}
                    onChange={() => setStyle(style.value)}
                    className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{style.label}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{style.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Citation Format */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Citation Format
            </label>
            <div className="space-y-2">
              {formats.map((format) => (
                <label
                  key={format.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all touch-manipulation',
                    'min-h-[44px]', // Touch target
                    preferences.format === format.value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name="citation-format"
                    value={format.value}
                    checked={preferences.format === format.value}
                    onChange={() => setFormat(format.value)}
                    className="mt-1 w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{format.label}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{format.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Additional Options
            </label>

            {/* Show Footnotes */}
            {preferences.style === 'inline' && (
              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer touch-manipulation min-h-[44px]">
                <div>
                  <div className="font-medium text-sm text-gray-900">Show Footnotes</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Display numbered footnotes at the bottom of responses
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.showFootnotes}
                  onChange={(e) => setShowFootnotes(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
              </label>
            )}

            {/* Show Inline Numbers */}
            <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer touch-manipulation min-h-[44px]">
              <div>
                <div className="font-medium text-sm text-gray-900">Show Inline Numbers</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Display citation numbers on inline citation badges
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.showInlineNumbers}
                onChange={(e) => setShowInlineNumbers(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
            </label>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
            <div className="text-sm text-gray-600">
              {preferences.style === 'inline' && (
                <span>
                  Citations appear as{' '}
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700 border border-blue-300">
                    {preferences.showInlineNumbers ? '1' : '📄'}
                  </span>{' '}
                  badges within the text.
                </span>
              )}
              {preferences.style === 'footnote' && (
                <span>
                  Citations appear as superscript numbers<sup className="text-orange-600">1</sup>{' '}
                  with footnotes at the bottom.
                </span>
              )}
              {preferences.style === 'numbered' && (
                <span>
                  Citations appear as numbered references [1], [2], [3] in brackets.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom, always visible (safe area on iPhone 7) */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-between border-t border-gray-200 bg-white',
            isMobile ? 'flex-row gap-2 px-4 py-3 flex-wrap' : 'flex-row px-6 py-4'
          )}
          style={isMobile ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0))', minHeight: 56 } : undefined}
        >
          <button
            onClick={reset}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors touch-manipulation",
              "min-h-[44px] min-w-[44px]", // Touch target
              isMobile ? "w-full justify-center" : ""
            )}
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors touch-manipulation",
              "min-h-[44px] min-w-[120px]", // Touch target
              isMobile ? "w-full" : ""
            )}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
