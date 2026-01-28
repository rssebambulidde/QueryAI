'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings, Lightbulb, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryExpansionDisplayProps {
  originalQuery: string;
  expandedQuery?: string;
  expansionReasoning?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onSettingsChange?: (settings: QueryExpansionSettings) => void;
  settings?: QueryExpansionSettings;
}

export interface QueryExpansionSettings {
  enableExpansion: boolean;
  expansionMethod?: 'synonym' | 'semantic' | 'hybrid';
  maxExpansions?: number;
  confidenceThreshold?: number;
}

export const QueryExpansionDisplay: React.FC<QueryExpansionDisplayProps> = ({
  originalQuery,
  expandedQuery,
  expansionReasoning,
  enabled,
  onToggle,
  onSettingsChange,
  settings,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!enabled && !expandedQuery) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Query Expansion</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-blue-700">Enable</span>
          </label>
        </div>
        <div className="flex gap-2">
          {onSettingsChange && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </Button>
          )}
          {expandedQuery && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {enabled && expandedQuery && (
        <>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Original Query</p>
              <p className="text-sm text-gray-700 bg-white p-2 rounded border border-blue-200">
                {originalQuery}
              </p>
            </div>

            {isExpanded && (
              <>
                <div>
                  <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    Expanded Query
                  </p>
                  <p className="text-sm text-gray-700 bg-white p-2 rounded border border-blue-200">
                    {expandedQuery}
                  </p>
                </div>

                {expansionReasoning && (
                  <div>
                    <p className="text-xs font-medium text-blue-700 mb-1">Expansion Reasoning</p>
                    <p className="text-xs text-gray-600 bg-white p-2 rounded border border-blue-200">
                      {expansionReasoning}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {showSettings && settings && onSettingsChange && (
        <div className="border-t border-blue-200 pt-3 mt-3 space-y-2">
          <p className="text-xs font-semibold text-blue-900">Expansion Settings</p>
          
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="radio"
                name="expansionMethod"
                value="synonym"
                checked={settings.expansionMethod === 'synonym'}
                onChange={() =>
                  onSettingsChange({ ...settings, expansionMethod: 'synonym' })
                }
                className="w-3 h-3"
              />
              Synonym-based
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="radio"
                name="expansionMethod"
                value="semantic"
                checked={settings.expansionMethod === 'semantic'}
                onChange={() =>
                  onSettingsChange({ ...settings, expansionMethod: 'semantic' })
                }
                className="w-3 h-3"
              />
              Semantic-based
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="radio"
                name="expansionMethod"
                value="hybrid"
                checked={settings.expansionMethod === 'hybrid'}
                onChange={() =>
                  onSettingsChange({ ...settings, expansionMethod: 'hybrid' })
                }
                className="w-3 h-3"
              />
              Hybrid
            </label>
          </div>

          <div>
            <label className="text-xs text-gray-700">
              Max Expansions: {settings.maxExpansions || 5}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.maxExpansions || 5}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  maxExpansions: parseInt(e.target.value),
                })
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs text-gray-700">
              Confidence Threshold: {(settings.confidenceThreshold || 0.7) * 100}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.confidenceThreshold || 0.7}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  confidenceThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};
