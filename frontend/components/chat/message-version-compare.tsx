'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MessageVersionSummary } from './chat-message';

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
    () => diffWords(leftVersion?.content ?? '', rightVersion?.content ?? ''),
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
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">{stats.removed} words removed</span>
              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">{stats.added} words added</span>
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
            )}
          >
            {seg.text}{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
