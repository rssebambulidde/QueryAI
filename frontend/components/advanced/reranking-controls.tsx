'use client';

import React, { useState } from 'react';
import { Settings, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RerankingControlsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onSettingsChange?: (settings: RerankingSettings) => void;
  settings?: RerankingSettings;
  impact?: RerankingImpact;
  preview?: RerankingPreview;
}

export interface RerankingSettings {
  enableReranking: boolean;
  rerankingMethod?: 'cross-encoder' | 'reciprocal-rank-fusion' | 'learned';
  topK?: number;
  diversityWeight?: number;
}

export interface RerankingImpact {
  before: number[];
  after: number[];
  improvement: number;
}

export interface RerankingPreview {
  originalRanking: Array<{ id: string; title: string; score: number }>;
  reranked: Array<{ id: string; title: string; score: number }>;
}

export const RerankingControls: React.FC<RerankingControlsProps> = ({
  enabled,
  onToggle,
  onSettingsChange,
  settings,
  impact,
  preview,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-900">Reranking</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-xs text-purple-700">Enable</span>
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
          {preview && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Preview
            </Button>
          )}
        </div>
      </div>

      {enabled && impact && (
        <div className="bg-white rounded p-3 border border-purple-200">
          <p className="text-xs font-semibold text-purple-900 mb-2">Reranking Impact</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-600">Average Score Before</p>
              <p className="text-sm font-semibold text-gray-900">
                {(impact.before.reduce((a, b) => a + b, 0) / impact.before.length).toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Average Score After</p>
              <p className="text-sm font-semibold text-purple-600">
                {(impact.after.reduce((a, b) => a + b, 0) / impact.after.length).toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Improvement</p>
              <p className="text-sm font-semibold text-green-600">
                +{impact.improvement.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {showSettings && settings && onSettingsChange && (
        <div className="border-t border-purple-200 pt-3 mt-3 space-y-2">
          <p className="text-xs font-semibold text-purple-900">Reranking Settings</p>
          
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="radio"
                name="rerankingMethod"
                value="cross-encoder"
                checked={settings.rerankingMethod === 'cross-encoder'}
                onChange={() =>
                  onSettingsChange({ ...settings, rerankingMethod: 'cross-encoder' })
                }
                className="w-3 h-3"
              />
              Cross-Encoder
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="radio"
                name="rerankingMethod"
                value="reciprocal-rank-fusion"
                checked={settings.rerankingMethod === 'reciprocal-rank-fusion'}
                onChange={() =>
                  onSettingsChange({ ...settings, rerankingMethod: 'reciprocal-rank-fusion' })
                }
                className="w-3 h-3"
              />
              Reciprocal Rank Fusion
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="radio"
                name="rerankingMethod"
                value="learned"
                checked={settings.rerankingMethod === 'learned'}
                onChange={() =>
                  onSettingsChange({ ...settings, rerankingMethod: 'learned' })
                }
                className="w-3 h-3"
              />
              Learned Model
            </label>
          </div>

          <div>
            <label className="text-xs text-gray-700">
              Top K Results: {settings.topK || 10}
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.topK || 10}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  topK: parseInt(e.target.value),
                })
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="text-xs text-gray-700">
              Diversity Weight: {(settings.diversityWeight || 0.5) * 100}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.diversityWeight || 0.5}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  diversityWeight: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>
        </div>
      )}

      {showPreview && preview && (
        <div className="border-t border-purple-200 pt-3 mt-3 space-y-3">
          <p className="text-xs font-semibold text-purple-900">Reranking Preview</p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Original Ranking</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {preview.originalRanking.map((item, idx) => (
                  <div
                    key={item.id}
                    className="text-xs p-2 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">#{idx + 1}</span>
                      <span className="text-gray-500">{item.score.toFixed(3)}</span>
                    </div>
                    <p className="text-gray-600 truncate">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-purple-700 mb-2">Reranked</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {preview.reranked.map((item, idx) => {
                  const originalIdx = preview.originalRanking.findIndex((i) => i.id === item.id);
                  const moved = originalIdx !== idx;
                  return (
                    <div
                      key={item.id}
                      className={`text-xs p-2 rounded border ${
                        moved
                          ? originalIdx > idx
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                          : 'bg-purple-50 border-purple-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          #{idx + 1}
                          {moved && (
                            <span className="ml-1 text-xs">
                              ({originalIdx > idx ? '↑' : '↓'} {Math.abs(originalIdx - idx)})
                            </span>
                          )}
                        </span>
                        <span className="text-purple-600">{item.score.toFixed(3)}</span>
                      </div>
                      <p className="text-gray-600 truncate">{item.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
