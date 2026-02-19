'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MessageVersionSummary } from './chat-message';

// ─── Diff helpers ─────────────────────────────────────────────────────────────

/** Split text into sentences for comparison. */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type DiffSegment = {
  text: string;
  type: 'same' | 'added' | 'removed' | 'changed';
};

/**
 * Simple sentence-level diff between two texts.
 * Returns diff segments for both left (old) and right (new) sides.
 */
function diffSentences(
  oldText: string,
  newText: string,
): { left: DiffSegment[]; right: DiffSegment[] } {
  const oldSentences = splitSentences(oldText);
  const newSentences = splitSentences(newText);

  // Build a set for quick lookup
  const oldSet = new Set(oldSentences);
  const newSet = new Set(newSentences);

  // Use longest common subsequence for alignment
  const lcs = computeLCS(oldSentences, newSentences);
  const lcsSet = new Set(lcs);

  const left: DiffSegment[] = oldSentences.map((s) => ({
    text: s,
    type: lcsSet.has(s) ? 'same' : (newSet.has(s) ? 'same' : 'removed'),
  }));

  const right: DiffSegment[] = newSentences.map((s) => ({
    text: s,
    type: lcsSet.has(s) ? 'same' : (oldSet.has(s) ? 'same' : 'added'),
  }));

  return { left, right };
}

/** Compute longest common subsequence of two string arrays. */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  // Use compact DP
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeStats(left: DiffSegment[], right: DiffSegment[]) {
  const removed = left.filter((s) => s.type === 'removed').length;
  const added = right.filter((s) => s.type === 'added').length;
  const same = left.filter((s) => s.type === 'same').length;
  const total = Math.max(left.length, right.length, 1);
  const similarity = Math.round((same / total) * 100);
  return { removed, added, same, similarity };
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

  const [leftIdx, setLeftIdx] = useState(initialLeft ?? 0);
  const [rightIdx, setRightIdx] = useState(initialRight ?? sorted.length - 1);

  const leftVersion = sorted[leftIdx];
  const rightVersion = sorted[rightIdx];

  const { left: leftDiff, right: rightDiff } = useMemo(
    () => diffSentences(leftVersion?.content ?? '', rightVersion?.content ?? ''),
    [leftVersion?.content, rightVersion?.content],
  );

  const stats = useMemo(() => computeStats(leftDiff, rightDiff), [leftDiff, rightDiff]);

  if (sorted.length < 2) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Compare Versions</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">{stats.removed} removed</span>
              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">{stats.added} added</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{stats.similarity}% similar</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close comparison"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version selectors */}
        <div className="flex items-center justify-between px-5 py-2 bg-gray-50 border-b border-gray-100">
          <VersionSelector
            label="Left"
            versions={sorted}
            selectedIdx={leftIdx}
            onChange={setLeftIdx}
            disabledIdx={rightIdx}
          />
          <VersionSelector
            label="Right"
            versions={sorted}
            selectedIdx={rightIdx}
            onChange={setRightIdx}
            disabledIdx={leftIdx}
          />
        </div>

        {/* Diff panes */}
        <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-gray-200">
          <DiffPane
            segments={leftDiff}
            label={`v${leftVersion.version}`}
            model={leftVersion.metadata?.model}
            date={leftVersion.created_at}
            colorScheme="removed"
          />
          <DiffPane
            segments={rightDiff}
            label={`v${rightVersion.version}`}
            model={rightVersion.metadata?.model}
            date={rightVersion.created_at}
            colorScheme="added"
          />
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
}: {
  label: string;
  versions: MessageVersionSummary[];
  selectedIdx: number;
  onChange: (idx: number) => void;
  disabledIdx: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      <button
        onClick={() => onChange(Math.max(0, selectedIdx - 1))}
        disabled={selectedIdx === 0}
        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select
        value={selectedIdx}
        onChange={(e) => onChange(Number(e.target.value))}
        className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
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
        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function DiffPane({
  segments,
  label,
  model,
  date,
  colorScheme,
}: {
  segments: DiffSegment[];
  label: string;
  model?: string;
  date?: string;
  colorScheme: 'added' | 'removed';
}) {
  const bgColor = colorScheme === 'added' ? 'bg-green-50' : 'bg-red-50';
  const textColor = colorScheme === 'added' ? 'text-green-800' : 'text-red-800';

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {model && <span>{model}</span>}
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
              seg.type === 'changed' && cn(bgColor, textColor),
            )}
          >
            {seg.text}{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
