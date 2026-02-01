'use client';

import React from 'react';
import { Settings, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCitationPreferencesStore,
  CitationStyle,
  CitationFormat,
} from '@/lib/store/citation-preferences-store';

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
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Citation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
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
                    'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
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
              <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
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
            <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
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

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
