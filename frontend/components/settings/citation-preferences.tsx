'use client';

import React, { useState } from 'react';
import { FileText, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { CitationSettings } from '@/components/chat/citation-settings';
import { useCitationPreferencesStore } from '@/lib/store/citation-preferences-store';
import { cn } from '@/lib/utils';

interface CitationPreferencesProps {
  className?: string;
}

export const CitationPreferences: React.FC<CitationPreferencesProps> = ({
  className,
}) => {
  const { preferences, reset } = useCitationPreferencesStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    // Preferences are automatically saved via Zustand persist
    toast.success('Citation preferences saved');
    setIsSettingsOpen(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Citation Preferences</h2>
        <p className="text-sm text-gray-500">
          Customize how citations are displayed in AI responses
        </p>
      </div>

      {/* Current Settings Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Current Settings
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Citation Style</span>
            <span className="text-sm text-gray-900 capitalize">{preferences.style}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Citation Format</span>
            <span className="text-sm text-gray-900 capitalize">{preferences.format}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Show Footnotes</span>
            <span className="text-sm text-gray-900">
              {preferences.showFootnotes ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-gray-700">Show Inline Numbers</span>
            <span className="text-sm text-gray-900">
              {preferences.showInlineNumbers ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <FileText className="w-4 h-4 mr-2" />
          Edit Citation Settings
        </Button>
      </div>

      {/* Citation Settings Modal */}
      <CitationSettings
        isOpen={isSettingsOpen}
        onClose={handleSave}
      />
    </div>
  );
};
