'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

const ADVANCED_RAG_LEARN_MORE_URL = '/help#advanced-rag';

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

  const ToggleSwitchWithLearnMore: React.FC<{
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description: string;
    explanation: string;
  }> = ({ enabled, onChange, label, description, explanation }) => (
    <div className={cn(
      "border border-gray-200 rounded-lg hover:bg-gray-50 touch-manipulation",
      isMobile ? "p-4" : "p-4"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
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
          <p className={cn(
            "text-gray-600 mt-2",
            isMobile ? "text-sm" : "text-xs"
          )}>
            {explanation}
          </p>
          <a
            href={ADVANCED_RAG_LEARN_MORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-orange-600 hover:text-orange-700 text-xs font-medium"
          >
            Learn more <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button
          onClick={() => onChange(!enabled)}
          className={cn(
            'relative inline-flex items-center rounded-full transition-colors flex-shrink-0 touch-manipulation mt-1',
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
            <ToggleSwitchWithLearnMore
              enabled={settings.enableReranking}
              onChange={(enabled) => setSettings({ ...settings, enableReranking: enabled })}
              label="Enable Reranking"
              description="Re-rank retrieved chunks using cross-encoder for better relevance"
              explanation="Reranking scores candidate chunks again with a more accurate model so the most relevant passages are sent to the AI. This improves answer quality when you have many similar chunks."
            />
            <ToggleSwitchWithLearnMore
              enabled={settings.enableDeduplication}
              onChange={(enabled) => setSettings({ ...settings, enableDeduplication: enabled })}
              label="Enable Deduplication"
              description="Remove duplicate or highly similar chunks from results"
              explanation="Deduplication merges or drops chunks that say almost the same thing, so the model sees less repetition and more unique information. Helps when multiple documents cover the same facts."
            />
            <ToggleSwitchWithLearnMore
              enabled={settings.enableDiversityFilter}
              onChange={(enabled) => setSettings({ ...settings, enableDiversityFilter: enabled })}
              label="Enable Diversity Filter"
              description="Ensure retrieved chunks come from diverse sources"
              explanation="The diversity filter spreads results across different documents or sections instead of taking many chunks from one place. Use it when you want the AI to consider multiple viewpoints or sources."
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
            <ToggleSwitchWithLearnMore
              enabled={settings.enableAdaptiveContext}
              onChange={(enabled) => setSettings({ ...settings, enableAdaptiveContext: enabled })}
              label="Enable Adaptive Context"
              description="Automatically adjust context window based on query complexity"
              explanation="Adaptive context uses more chunks for complex or multi-part questions and fewer for simple ones. This balances accuracy and token usage so answers stay focused without wasting capacity."
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
                "text-gray-600 mt-1.5",
                isMobile ? "text-sm" : "text-xs"
              )}>
                Maximum tokens allocated for context in each query. Higher values let the model see more document text but use more tokens and cost.
              </p>
              <a
                href={ADVANCED_RAG_LEARN_MORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-orange-600 hover:text-orange-700 text-xs font-medium"
              >
                Learn more <ExternalLink className="w-3 h-3" />
              </a>
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
                "text-gray-600 mt-1.5",
                isMobile ? "text-sm" : "text-xs"
              )}>
                Maximum total tokens for context window (including prompt). Caps how much document and conversation history can be sent to the model in one request.
              </p>
              <a
                href={ADVANCED_RAG_LEARN_MORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-orange-600 hover:text-orange-700 text-xs font-medium"
              >
                Learn more <ExternalLink className="w-3 h-3" />
              </a>
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
