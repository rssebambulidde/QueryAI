'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, ChevronDown, ExternalLink, FileSearch } from 'lucide-react';

export interface ClaimResult {
  claim: string;
  excerpt: string;
  category: string;
  verdict: string;
  confidence: 'supported' | 'contradicted' | 'partially_supported' | 'unverifiable';
  sources: Array<{ title: string; url: string }>;
}

interface ClaimCardsProps {
  results: ClaimResult[];
  className?: string;
}

const confidenceConfig = {
  supported: {
    icon: CheckCircle,
    label: 'Supported',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  contradicted: {
    icon: XCircle,
    label: 'Contradicted',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  partially_supported: {
    icon: AlertTriangle,
    label: 'Partially supported',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
  unverifiable: {
    icon: HelpCircle,
    label: 'Unverifiable',
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
  },
} as const;

const categoryLabels: Record<string, string> = {
  statistic: 'Statistic',
  date: 'Date',
  fact: 'Fact',
  opinion: 'Opinion',
  entity: 'Entity',
  other: 'Other',
};

export const ClaimCards: React.FC<ClaimCardsProps> = ({ results, className }) => {
  const [expanded, setExpanded] = useState(false);

  if (!results || results.length === 0) return null;

  const counts = {
    supported: results.filter((r) => r.confidence === 'supported').length,
    contradicted: results.filter((r) => r.confidence === 'contradicted').length,
    partially_supported: results.filter((r) => r.confidence === 'partially_supported').length,
    unverifiable: results.filter((r) => r.confidence === 'unverifiable').length,
  };

  return (
    <div className={cn('rounded-lg border border-gray-200 overflow-hidden', className)}>
      {/* Summary header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-800">
            Document Research: {results.length} claim{results.length !== 1 ? 's' : ''} verified
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            {counts.supported > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {counts.supported}
              </span>
            )}
            {counts.contradicted > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {counts.contradicted}
              </span>
            )}
            {counts.partially_supported > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-700">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                {counts.partially_supported}
              </span>
            )}
            {counts.unverifiable > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {counts.unverifiable}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expandable claim cards */}
      {expanded && (
        <div className="divide-y divide-gray-100">
          {results.map((result, idx) => {
            const config = confidenceConfig[result.confidence] || confidenceConfig.unverifiable;
            const Icon = config.icon;

            return (
              <div key={idx} className={cn('px-3 py-2.5', config.bg)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
                  <div className="flex-1 min-w-0">
                    {/* Claim text + category */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 line-clamp-2">
                        {result.claim}
                      </span>
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/60 text-gray-600 border border-gray-200">
                        {categoryLabels[result.category] || result.category}
                      </span>
                    </div>

                    {/* Document excerpt */}
                    {result.excerpt && (
                      <p className="text-xs text-gray-500 italic line-clamp-2 mb-1">
                        &ldquo;{result.excerpt}&rdquo;
                      </p>
                    )}

                    {/* Verdict */}
                    <p className="text-xs text-gray-700 mb-1">{result.verdict}</p>

                    {/* Source links */}
                    {result.sources && result.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {result.sources.map((src, si) => (
                          <a
                            key={si}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="max-w-[150px] truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
