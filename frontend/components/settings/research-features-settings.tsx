'use client';

import React from 'react';
import {
  Sparkles,
  PenLine,
  ArrowUpDown,
  ShieldCheck,
  Layers,
  Copy,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { useResearchFeaturesStore, type ResearchFeatures } from '@/lib/store/research-features-store';
import { cn } from '@/lib/utils';

type FeatureKey = keyof Omit<ResearchFeatures, 'masterEnabled'>;

interface FeatureInfo {
  key: FeatureKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const features: FeatureInfo[] = [
  {
    key: 'queryRewriting',
    label: 'Query Rewriting',
    description: 'Reformulates your query for better search coverage and relevance',
    icon: PenLine,
  },
  {
    key: 'reranking',
    label: 'Result Re-ranking',
    description: 'Re-orders search results by semantic relevance to your question',
    icon: ArrowUpDown,
  },
  {
    key: 'qualityScoring',
    label: 'Quality Scoring',
    description: 'Filters out low-quality or irrelevant sources automatically',
    icon: ShieldCheck,
  },
  {
    key: 'diversityFiltering',
    label: 'Diversity Filtering',
    description: 'Ensures varied perspectives by reducing redundant viewpoints',
    icon: Layers,
  },
  {
    key: 'deduplication',
    label: 'Deduplication',
    description: 'Removes duplicate content across different sources',
    icon: Copy,
  },
];

export const ResearchFeaturesSettings: React.FC = () => {
  const { features: settings, setMasterEnabled, setFeature, resetDefaults } = useResearchFeaturesStore();
  const { toast } = useToast();

  const handleReset = () => {
    resetDefaults();
    toast.success('Research features reset to defaults');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Research Features</h2>
        <p className="text-sm text-gray-500">
          Configure advanced features that enhance research quality in Research mode
        </p>
      </div>

      {/* Master Toggle */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              settings.masterEnabled ? 'bg-blue-100' : 'bg-gray-100'
            )}>
              <Sparkles className={cn(
                'w-5 h-5',
                settings.masterEnabled ? 'text-blue-600' : 'text-gray-400'
              )} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Advanced Research Features</h3>
              <p className="text-sm text-gray-500">
                Enable all advanced features for higher quality research results
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={settings.masterEnabled}
            onClick={() => setMasterEnabled(!settings.masterEnabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              settings.masterEnabled ? 'bg-blue-600' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                settings.masterEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      {/* Individual Features */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {features.map((feature) => {
          const Icon = feature.icon;
          const isEnabled = settings[feature.key];
          const isDisabled = !settings.masterEnabled;

          return (
            <div
              key={feature.key}
              className={cn(
                'flex items-center justify-between p-4',
                isDisabled && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                  isEnabled && !isDisabled ? 'bg-green-50' : 'bg-gray-50'
                )}>
                  <Icon className={cn(
                    'w-4 h-4',
                    isEnabled && !isDisabled ? 'text-green-600' : 'text-gray-400'
                  )} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{feature.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={isEnabled}
                disabled={isDisabled}
                onClick={() => setFeature(feature.key, !isEnabled)}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                  isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  isEnabled && !isDisabled ? 'bg-green-500' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                    isEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Reset Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};
