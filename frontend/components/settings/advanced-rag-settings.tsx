'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

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
  const { isMobile } = useMobile();
  const [settings, setSettings] = useState<AdvancedRAGSettings>({
    enableReranking: false,
    enableDeduplication: true,
    enableDiversityFilter: false,
    enableAdaptiveContext: true,
    tokenBudget: 4000,
    maxContextTokens: 8000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['retrieval', 'context']));
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

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const ToggleSwitch: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description: string;
  }> = ({ enabled, onChange, label, description }) => (
    <div className={cn(
      "flex items-center justify-between border border-gray-200 rounded-lg hover:bg-gray-50 touch-manipulation min-h-[44px]",
      isMobile ? "p-4" : "p-4"
    )}>
      <div className="flex-1 min-w-0 pr-3">
        <div className={cn(
          "font-medium text-gray-900",
          isMobile ? "text-base" : "text-sm"
        )}>
          {label}
        </div>
        <div className={cn(
          "text-gray-500 mt-0.5",
          isMobile ? "text-sm" : "text-xs"
        )}>
          {description}
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex items-center rounded-full transition-colors flex-shrink-0 touch-manipulation',
          isMobile ? 'h-7 w-12' : 'h-6 w-11',
          enabled ? 'bg-orange-600' : 'bg-gray-300'
        )}
        aria-label={`${label}: ${enabled ? 'enabled' : 'disabled'}`}
      >
        <span
          className={cn(
            'inline-block rounded-full bg-white transition-transform shadow-sm',
            isMobile ? 'h-6 w-6' : 'h-4 w-4',
            enabled ? (isMobile ? 'translate-x-[18px]' : 'translate-x-6') : 'translate-x-1'
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

      {/* Reranking - Accordion on mobile */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => isMobile && toggleSection('retrieval')}
          className={cn(
            "w-full flex items-center justify-between p-4 sm:p-6 touch-manipulation min-h-[44px]",
            isMobile && "hover:bg-gray-50"
          )}
        >
          <h3 className={cn(
            "font-semibold text-gray-900 flex items-center gap-2",
            isMobile ? "text-base" : "text-lg"
          )}>
            <Settings className={cn(isMobile ? "w-4 h-4" : "w-5 h-5")} />
            Retrieval Optimization
          </h3>
          {isMobile && (
            <div className="flex-shrink-0">
              {expandedSections.has('retrieval') ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          )}
        </button>
        {(isMobile ? expandedSections.has('retrieval') : true) && (
          <div className={cn(
            "space-y-3",
            isMobile ? "px-4 pb-4" : "px-6 pb-6"
          )}>
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
        )}
      </div>

      {/* Context Management - Accordion on mobile */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => isMobile && toggleSection('context')}
          className={cn(
            "w-full flex items-center justify-between p-4 sm:p-6 touch-manipulation min-h-[44px]",
            isMobile && "hover:bg-gray-50"
          )}
        >
          <h3 className={cn(
            "font-semibold text-gray-900",
            isMobile ? "text-base" : "text-lg"
          )}>
            Context Management
          </h3>
          {isMobile && (
            <div className="flex-shrink-0">
              {expandedSections.has('context') ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          )}
        </button>
        {(isMobile ? expandedSections.has('context') : true) && (
          <div className={cn(
            "space-y-4",
            isMobile ? "px-4 pb-4" : "px-6 pb-6"
          )}>
            <ToggleSwitch
              enabled={settings.enableAdaptiveContext}
              onChange={(enabled) => setSettings({ ...settings, enableAdaptiveContext: enabled })}
              label="Enable Adaptive Context"
              description="Automatically adjust context window based on query complexity"
            />
            
            <div>
              <label className={cn(
                "block font-medium text-gray-700 mb-3",
                isMobile ? "text-base" : "text-sm"
              )}>
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
                className={cn(
                  "w-full bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600 touch-manipulation",
                  isMobile ? "h-3" : "h-2"
                )}
                style={isMobile ? { minHeight: '44px' } : {}}
              />
              <div className={cn(
                "flex justify-between text-gray-500 mt-2",
                isMobile ? "text-sm" : "text-xs"
              )}>
                <span>1,000</span>
                <span>8,000</span>
              </div>
              <p className={cn(
                "text-gray-500 mt-1.5",
                isMobile ? "text-sm" : "text-xs"
              )}>
                Maximum tokens allocated for context in each query
              </p>
            </div>

            <div>
              <label className={cn(
                "block font-medium text-gray-700 mb-3",
                isMobile ? "text-base" : "text-sm"
              )}>
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
                className={cn(
                  "w-full bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600 touch-manipulation",
                  isMobile ? "h-3" : "h-2"
                )}
                style={isMobile ? { minHeight: '44px' } : {}}
              />
              <div className={cn(
                "flex justify-between text-gray-500 mt-2",
                isMobile ? "text-sm" : "text-xs"
              )}>
                <span>2,000</span>
                <span>16,000</span>
              </div>
              <p className={cn(
                "text-gray-500 mt-1.5",
                isMobile ? "text-sm" : "text-xs"
              )}>
                Maximum total tokens for context window (including prompt)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={cn(
        "flex items-center gap-3",
        isMobile ? "flex-col sticky bottom-0 bg-white pt-4 pb-safe-area-inset-bottom z-10" : "justify-end"
      )}>
        <Button 
          variant="outline" 
          onClick={handleReset}
          className="touch-manipulation min-h-[44px] w-full sm:w-auto"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white touch-manipulation min-h-[44px] w-full sm:w-auto"
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
