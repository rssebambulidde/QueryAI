'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import { getMarkdownComponents } from '@/lib/utils/markdown-components';
import { X, ChevronLeft, ChevronRight, Globe, FileText, Eye, GitCompare } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import type { MessageVersionSummary } from './chat-message';
import type { Source } from '@/lib/api';

// ─── Diff helpers ─────────────────────────────────────────────────────────────

/** Split text into words, preserving whitespace boundaries for clean display. */
function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

/** Normalise a token for comparison (lowercase, trim). */
function norm(w: string): string {
  return w.trim().toLowerCase();
}

export type DiffSegment = {
  text: string;
  type: 'same' | 'added' | 'removed';
};

/**
 * Word-level diff between two texts using LCS.
 * Returns diff segments for both left (old) and right (new) sides.
 */
function diffWords(
  oldText: string,
  newText: string,
): { left: DiffSegment[]; right: DiffSegment[] } {
  const oldWords = splitWords(oldText).filter((w) => w.trim());
  const newWords = splitWords(newText).filter((w) => w.trim());

  // Compute LCS on normalised words for better matching
  const m = oldWords.length;
  const n = newWords.length;

  // For very large texts, fall back to a cheaper heuristic
  if (m * n > 2_000_000) {
    return cheapDiff(oldWords, newWords);
  }

  // Standard DP-based LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        norm(oldWords[i - 1]) === norm(newWords[j - 1])
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build segments
  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  let i = m;
  let j = n;

  // Temp accumulators (collected in reverse)
  const leftAcc: DiffSegment[] = [];
  const rightAcc: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && norm(oldWords[i - 1]) === norm(newWords[j - 1])) {
      leftAcc.push({ text: oldWords[i - 1], type: 'same' });
      rightAcc.push({ text: newWords[j - 1], type: 'same' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rightAcc.push({ text: newWords[j - 1], type: 'added' });
      j--;
    } else {
      leftAcc.push({ text: oldWords[i - 1], type: 'removed' });
      i--;
    }
  }

  leftAcc.reverse();
  rightAcc.reverse();

  // Merge consecutive segments of the same type for cleaner display
  const merge = (segs: DiffSegment[]): DiffSegment[] => {
    const merged: DiffSegment[] = [];
    for (const seg of segs) {
      const last = merged[merged.length - 1];
      if (last && last.type === seg.type) {
        last.text += ' ' + seg.text;
      } else {
        merged.push({ ...seg });
      }
    }
    return merged;
  };

  return { left: merge(leftAcc), right: merge(rightAcc) };
}

/** Cheap word-set diff for very long texts. */
function cheapDiff(
  oldWords: string[],
  newWords: string[],
): { left: DiffSegment[]; right: DiffSegment[] } {
  const oldSet = new Set(oldWords.map(norm));
  const newSet = new Set(newWords.map(norm));

  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];

  let curType: DiffSegment['type'] | null = null;
  let buf = '';
  for (const w of oldWords) {
    const t = newSet.has(norm(w)) ? 'same' : 'removed';
    if (t === curType) {
      buf += ' ' + w;
    } else {
      if (curType) left.push({ text: buf, type: curType });
      curType = t;
      buf = w;
    }
  }
  if (curType) left.push({ text: buf, type: curType });

  curType = null;
  buf = '';
  for (const w of newWords) {
    const t = oldSet.has(norm(w)) ? 'same' : 'added';
    if (t === curType) {
      buf += ' ' + w;
    } else {
      if (curType) right.push({ text: buf, type: curType });
      curType = t;
      buf = w;
    }
  }
  if (curType) right.push({ text: buf, type: curType });

  return { left, right };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeStats(left: DiffSegment[], right: DiffSegment[]) {
  // Count words in each segment type for accurate stats
  const countWords = (segs: DiffSegment[], type: DiffSegment['type']) =>
    segs.filter((s) => s.type === type).reduce((acc, s) => acc + s.text.split(/\s+/).filter(Boolean).length, 0);

  const removed = countWords(left, 'removed');
  const added = countWords(right, 'added');
  const sameLeft = countWords(left, 'same');
  const sameRight = countWords(right, 'same');
  const totalLeft = sameLeft + removed;
  const totalRight = sameRight + added;
  const total = Math.max(totalLeft, totalRight, 1);
  const similarity = Math.round((Math.max(sameLeft, sameRight) / total) * 100);
  return { removed, added, same: Math.max(sameLeft, sameRight), similarity };
}

/**
 * Replace [Web Source N] / [Document N] citation patterns with actual source titles.
 * Handles both `[Web Source N]` and `[Web Source N](url)` markdown link formats.
 */
function resolveCitationTitles(content: string, sources?: Source[]): string {
  if (!sources || sources.length === 0) return content;

  const webSources = sources.filter((s) => s.type === 'web');
  const docSources = sources.filter((s) => s.type === 'document');

  return content.replace(
    /\[(Web Source|Document)\s+(\d+)\](?:\(([^)]+)\))?/gi,
    (fullMatch, typeStr, numStr, url) => {
      const type = typeStr.toLowerCase().includes('web') ? 'web' : 'document';
      const idx = parseInt(numStr, 10) - 1;
      const pool = type === 'web' ? webSources : docSources;
      const source = pool[idx];

      if (!source) return fullMatch; // keep original if not found

      const title = source.title || fullMatch;
      const href = url || source.url || '#';
      return `[${title}](${href})`;
    },
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MessageVersionCompareProps {
  versions: MessageVersionSummary[];
  /** Initial indices for left/right panes (default: first and last). */
  initialLeft?: number;
  initialRight?: number;
  onClose: () => void;
}

export const MessageVersionCompare: React.FC<MessageVersionCompareProps> = ({
  versions,
  initialLeft,
  initialRight,
  onClose,
}) => {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => a.version - b.version),
    [versions],
  );

  const { isMobile } = useMobile();
  const [leftIdx, setLeftIdx] = useState(initialLeft ?? 0);
  const [rightIdx, setRightIdx] = useState(initialRight ?? sorted.length - 1);
  const [viewMode, setViewMode] = useState<'formatted' | 'changes'>('formatted');

  const leftVersion = sorted[leftIdx];
  const rightVersion = sorted[rightIdx];

  const { left: leftDiff, right: rightDiff } = useMemo(
    () => diffWords(leftVersion?.content ?? '', rightVersion?.content ?? ''),
    [leftVersion?.content, rightVersion?.content],
  );

  const stats = useMemo(() => computeStats(leftDiff, rightDiff), [leftDiff, rightDiff]);

  if (sorted.length < 2) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center bg-black/50",
      isMobile ? "p-0" : "p-4"
    )}>
      <div className={cn(
        "bg-white shadow-2xl w-full flex flex-col",
        isMobile
          ? "h-full rounded-none max-h-none"
          : "rounded-xl max-w-5xl max-h-[85vh]"
      )}
      style={isMobile ? {
        marginTop: 'env(safe-area-inset-top)',
        marginBottom: 'env(safe-area-inset-bottom)',
      } : {}}
      >
        {/* Header */}
        <div className={cn(
          "flex items-start justify-between border-b border-gray-200 flex-shrink-0",
          isMobile ? "px-4 py-3" : "px-5 py-3"
        )}>
          <div className={cn(isMobile ? "flex flex-col gap-2" : "flex items-center gap-3")}>
            <h2 className={cn(
              "font-semibold text-gray-900",
              isMobile ? "text-base" : "text-lg"
            )}>Compare Versions</h2>
            <div className={cn(
              "flex items-center gap-1.5 text-xs text-gray-500",
              isMobile && "flex-wrap"
            )}>
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">{stats.removed} removed</span>
              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">{stats.added} added</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{stats.similarity}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                onClick={() => setViewMode('formatted')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors touch-manipulation',
                  isMobile && 'min-h-[36px] min-w-[36px] justify-center',
                  viewMode === 'formatted'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                {!isMobile && 'Formatted'}
              </button>
              <button
                onClick={() => setViewMode('changes')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors touch-manipulation',
                  isMobile && 'min-h-[36px] min-w-[36px] justify-center',
                  viewMode === 'changes'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <GitCompare className="w-3.5 h-3.5" />
                {!isMobile && 'Changes'}
              </button>
            </div>
            <button
              onClick={onClose}
              className={cn(
                "rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors touch-manipulation",
                isMobile ? "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" : "p-1.5"
              )}
              aria-label="Close comparison"
            >
              <X className={cn(isMobile ? "w-6 h-6" : "w-5 h-5")} />
            </button>
          </div>
        </div>

        {/* Version selectors */}
        <div className={cn(
          "bg-gray-50 border-b border-gray-100 flex-shrink-0",
          isMobile
            ? "flex flex-col gap-2 px-4 py-2"
            : "flex items-center justify-between px-5 py-2"
        )}>
          <VersionSelector
            label={isMobile ? 'Old' : 'Left'}
            versions={sorted}
            selectedIdx={leftIdx}
            onChange={setLeftIdx}
            disabledIdx={rightIdx}
            compact={isMobile}
          />
          <VersionSelector
            label={isMobile ? 'New' : 'Right'}
            versions={sorted}
            selectedIdx={rightIdx}
            onChange={setRightIdx}
            disabledIdx={leftIdx}
            compact={isMobile}
          />
        </div>

        {/* Source comparison */}
        {(leftVersion.sources?.length || rightVersion.sources?.length) ? (
          <SourceComparison left={leftVersion} right={rightVersion} />
        ) : null}

        {/* Diff panes */}
        <div className={cn(
          "flex-1 overflow-hidden grid",
          isMobile
            ? "grid-cols-1 divide-y divide-gray-200 overflow-y-auto"
            : "grid-cols-2 divide-x divide-gray-200"
        )}>
          {viewMode === 'changes' ? (
            <>
              <DiffPane
                segments={leftDiff}
                label={`v${leftVersion.version}`}
                date={leftVersion.created_at}
                colorScheme="removed"
              />
              <DiffPane
                segments={rightDiff}
                label={`v${rightVersion.version}`}
                date={rightVersion.created_at}
                colorScheme="added"
              />
            </>
          ) : (
            <>
              <FormattedPane
                content={leftVersion.content}
                sources={leftVersion.sources}
                label={`v${leftVersion.version}`}
                date={leftVersion.created_at}
              />
              <FormattedPane
                content={rightVersion.content}
                sources={rightVersion.sources}
                label={`v${rightVersion.version}`}
                date={rightVersion.created_at}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function VersionSelector({
  label,
  versions,
  selectedIdx,
  onChange,
  disabledIdx,
  compact = false,
}: {
  label: string;
  versions: MessageVersionSummary[];
  selectedIdx: number;
  onChange: (idx: number) => void;
  disabledIdx: number;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      <button
        onClick={() => onChange(Math.max(0, selectedIdx - 1))}
        disabled={selectedIdx === 0}
        className={cn(
          "rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation",
          compact ? "p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center" : "p-0.5"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select
        value={selectedIdx}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "border border-gray-200 rounded bg-white",
          compact ? "text-sm px-2 py-1.5 min-h-[36px] flex-1" : "text-sm px-2 py-1"
        )}
      >
        {versions.map((v, i) => (
          <option key={v.id} value={i} disabled={i === disabledIdx}>
            v{v.version} — {new Date(v.created_at).toLocaleDateString()}
          </option>
        ))}
      </select>
      <button
        onClick={() => onChange(Math.min(versions.length - 1, selectedIdx + 1))}
        disabled={selectedIdx === versions.length - 1}
        className={cn(
          "rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation",
          compact ? "p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center" : "p-0.5"
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function DiffPane({
  segments,
  label,
  date,
  colorScheme,
}: {
  segments: DiffSegment[];
  label: string;
  date?: string;
  colorScheme: 'added' | 'removed';
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {date && <span>{new Date(date).toLocaleString()}</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-gray-800">
        {segments.map((seg, i) => (
          <span
            key={i}
            className={cn(
              'inline',
              seg.type === 'same' && '',
              seg.type === 'removed' && 'bg-red-100 text-red-800 line-through decoration-red-400/60',
              seg.type === 'added' && 'bg-green-100 text-green-800',
            )}
          >
            {seg.text}{' '}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Markdown-rendered pane for the "Formatted" view mode. */
function FormattedPane({
  content,
  sources,
  label,
  date,
}: {
  content: string;
  sources?: Source[];
  label: string;
  date?: string;
}) {
  const mdComponents = useMemo(() => getMarkdownComponents(false), []);
  const resolvedContent = useMemo(() => resolveCitationTitles(content, sources), [content, sources]);

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {date && <span>{new Date(date).toLocaleString()}</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-gray-800 prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
          {resolvedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function SourceComparison({ left, right }: { left: MessageVersionSummary; right: MessageVersionSummary }) {
  const leftSources = left.sources || [];
  const rightSources = right.sources || [];
  const leftUrls = new Set(leftSources.map((s) => s.url || s.title));
  const rightUrls = new Set(rightSources.map((s) => s.url || s.title));

  const commonCount = leftSources.filter((s) => rightUrls.has(s.url || s.title)).length;
  const leftOnly = leftSources.filter((s) => !rightUrls.has(s.url || s.title));
  const rightOnly = rightSources.filter((s) => !leftUrls.has(s.url || s.title));

  const leftOption = left.metadata?.regenerateOptions;
  const rightOption = right.metadata?.regenerateOptions;

  const getOptionLabel = (opts: any): string | null => {
    if (!opts) return null;
    if (opts.maxSearchResults > 5) return 'More sources';
    if (opts.temperature <= 0.3 && opts.maxTokens <= 600) return 'Shorter & precise';
    if (opts.temperature >= 0.9 && opts.maxTokens >= 4096) return 'Longer & creative';
    return null;
  };

  return (
    <div className="px-4 sm:px-5 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-gray-500 font-medium">Sources:</span>
          <span className="text-gray-600">v{left.version}: {leftSources.length}</span>
          <span className="text-gray-400">vs</span>
          <span className="text-gray-600">v{right.version}: {rightSources.length}</span>
          {commonCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{commonCount} shared</span>
          )}
          {leftOnly.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600">{leftOnly.length} only in v{left.version}</span>
          )}
          {rightOnly.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600">{rightOnly.length} only in v{right.version}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {leftOption && getOptionLabel(leftOption) && (
            <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
              v{left.version}: {getOptionLabel(leftOption)}
            </span>
          )}
          {rightOption && getOptionLabel(rightOption) && (
            <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
              v{right.version}: {getOptionLabel(rightOption)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
