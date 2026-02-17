'use client';

import React from 'react';
import { FileText, AlertCircle } from 'lucide-react';

interface ContextVisualizationProps {
  chunks: ContextChunk[];
  tokenUsage: TokenUsage;
  selectionReasoning?: string;
}

export interface ContextChunk {
  id: string;
  content: string;
  source: {
    type: 'document' | 'web';
    title: string;
    url?: string;
    documentId?: string;
  };
  score: number;
  tokens: number;
  selected: boolean;
  reasoning?: string;
}

export interface TokenUsage {
  total: number;
  prompt: number;
  completion: number;
  context: number;
  maxTokens?: number;
  budget?: number;
}

export const ContextVisualization: React.FC<ContextVisualizationProps> = ({
  chunks,
  tokenUsage,
  selectionReasoning,
}) => {
  const selectedChunks = chunks.filter((c) => c.selected);
  const tokenPercentage = tokenUsage.maxTokens
    ? (tokenUsage.total / tokenUsage.maxTokens) * 100
    : 0;
  const budgetPercentage = tokenUsage.budget
    ? (tokenUsage.total / tokenUsage.budget) * 100
    : 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">Context Window</span>
          <span className="text-xs text-gray-500">
            ({selectedChunks.length} of {chunks.length} chunks selected)
          </span>
        </div>
      </div>

      {/* Token Usage */}
      <div className="bg-white rounded p-3 border border-gray-200">
        <p className="text-xs font-semibold text-gray-900 mb-2">Token Usage</p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Total Tokens</span>
            <span className="font-semibold text-gray-900">
              {tokenUsage.total.toLocaleString()}
              {tokenUsage.maxTokens && ` / ${tokenUsage.maxTokens.toLocaleString()}`}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Prompt Tokens</span>
            <span className="text-gray-700">{tokenUsage.prompt.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Context Tokens</span>
            <span className="text-gray-700">{tokenUsage.context.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Completion Tokens</span>
            <span className="text-gray-700">{tokenUsage.completion.toLocaleString()}</span>
          </div>
          {tokenUsage.maxTokens && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  tokenPercentage >= 90
                    ? 'bg-red-600'
                    : tokenPercentage >= 75
                    ? 'bg-yellow-600'
                    : 'bg-green-600'
                }`}
                style={{ width: `${Math.min(tokenPercentage, 100)}%` }}
              />
            </div>
          )}
          {tokenPercentage >= 90 && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              Approaching token limit
            </div>
          )}
        </div>
      </div>

      {/* Selection Reasoning */}
      {selectionReasoning && (
        <div className="bg-blue-50 rounded p-3 border border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-1">Selection Reasoning</p>
          <p className="text-xs text-blue-700">{selectionReasoning}</p>
        </div>
      )}

      {/* Context Chunks */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {chunks.map((chunk) => (
          <div
            key={chunk.id}
            className={`p-3 rounded border ${
              chunk.selected
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  chunk.source.type === 'document'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {chunk.source.type}
              </span>
              <span className="text-xs font-semibold text-gray-900">
                {chunk.source.title}
              </span>
              <span className="text-xs text-gray-500">Score: {chunk.score.toFixed(3)}</span>
              <span className="text-xs text-gray-500">{chunk.tokens} tokens</span>
            </div>
            <p className="text-sm text-gray-700 line-clamp-3">{chunk.content}</p>
            {chunk.reasoning && (
              <p className="text-xs text-gray-500 mt-1 italic">
                {chunk.reasoning}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
