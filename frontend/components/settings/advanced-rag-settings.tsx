'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AdvancedRAGSettings {
  enableReranking: boolean;
  enableDeduplication: boolean;
  enableDiversityFilter: boolean;
  enableAdaptiveContext: boolean;
  tokenBudget: number;
  maxContextTokens: number;
}

interface AdvancedRAGSettingsProps {
  className?: string;
}

export const AdvancedRAGSettings: React.FC<AdvancedRAGSettingsProps> = ({
  className,
}) => {
  const [settings, setSettings] = useState<AdvancedRAGSettings>({
    enableReranking: false,
    enableDeduplication: true,
    enableDiversityFilter: false,
    enableAdaptiveContext: true,
    tokenBudget: 4000,
    maxContextTokens: 8000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load saved settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('advancedRAGSettings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings(parsed);
        } catch (e) {
          console.error('Failed to parse saved RAG settings:', e);
        }
      }
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (can be extended to save to backend)
      if (typeof window !== 'undefined') {
        localStorage.setItem('advancedRAGSettings', JSON.stringify(settings));
      }

      // Note: Backend API endpoint for saving preferences may need to be implemented
      // await userApi.updateAdvancedRAGSettings(settings);

      toast.success('Advanced RAG settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaultSettings: AdvancedRAGSettings = {
      enableReranking: false,
      enableDeduplication: true,
      enableDiversityFilter: false,
      enableAdaptiveContext: true,
      tokenBudget: 4000,
      maxContextTokens: 8000,
    };
    setSettings(defaultSettings);
    toast.success('Settings reset to defaults');
  };

  const ToggleSwitch: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description: string;
  }> = ({ enabled, onChange, label, description }) => (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          enabled ? 'bg-orange-600' : 'bg-gray-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Advanced RAG Settings</h2>
        <p className="text-sm text-gray-500">
          Fine-tune retrieval and generation parameters for optimal results
        </p>
      </div>

      {/* Reranking */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Retrieval Optimization
        </h3>
        <div className="space-y-3">
          <ToggleSwitch
            enabled={settings.enableReranking}
            onChange={(enabled) => setSettings({ ...settings, enableReranking: enabled })}
            label="Enable Reranking"
            description="Re-rank retrieved chunks using cross-encoder for better relevance"
          />
          <ToggleSwitch
            enabled={settings.enableDeduplication}
            onChange={(enabled) => setSettings({ ...settings, enableDeduplication: enabled })}
            label="Enable Deduplication"
            description="Remove duplicate or highly similar chunks from results"
          />
          <ToggleSwitch
            enabled={settings.enableDiversityFilter}
            onChange={(enabled) => setSettings({ ...settings, enableDiversityFilter: enabled })}
            label="Enable Diversity Filter"
            description="Ensure retrieved chunks come from diverse sources"
          />
        </div>
      </div>

      {/* Context Management */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Context Management</h3>
        <div className="space-y-4">
          <ToggleSwitch
            enabled={settings.enableAdaptiveContext}
            onChange={(enabled) => setSettings({ ...settings, enableAdaptiveContext: enabled })}
            label="Enable Adaptive Context"
            description="Automatically adjust context window based on query complexity"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Budget: {settings.tokenBudget.toLocaleString()} tokens
            </label>
            <input
              type="range"
              min="1000"
              max="8000"
              step="500"
              value={settings.tokenBudget}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  tokenBudget: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1,000</span>
              <span>8,000</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum tokens allocated for context in each query
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Context Tokens: {settings.maxContextTokens.toLocaleString()} tokens
            </label>
            <input
              type="range"
              min="2000"
              max="16000"
              step="1000"
              value={settings.maxContextTokens}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxContextTokens: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>2,000</span>
              <span>16,000</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum total tokens for context window (including prompt)
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {isSaving ? (
            <>
              <Save className="w-4 h-4 mr-2 animate-pulse" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
