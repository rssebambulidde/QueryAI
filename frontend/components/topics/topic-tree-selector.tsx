'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Topic, TopicTreeNode } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────

/** Build a tree from a flat Topic[] using parent_topic_id. */
export function buildTopicTree(flat: Topic[]): TopicTreeNode[] {
  const map = new Map<string, TopicTreeNode>();
  for (const t of flat) {
    map.set(t.id, { ...t, children: [] });
  }
  const roots: TopicTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parent_topic_id && map.has(node.parent_topic_id)) {
      map.get(node.parent_topic_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort children alphabetically at each level
  const sortChildren = (nodes: TopicTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortChildren(n.children);
  };
  sortChildren(roots);
  return roots;
}

/** Get ancestor breadcrumb trail for a topic. */
export function getAncestorPath(topicId: string, flat: Topic[]): Topic[] {
  const map = new Map<string, Topic>();
  for (const t of flat) map.set(t.id, t);
  const path: Topic[] = [];
  let current = map.get(topicId);
  while (current?.parent_topic_id) {
    const parent = map.get(current.parent_topic_id);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

// ── Tree node component ────────────────────────────────────────────────

interface TreeNodeProps {
  node: TopicTreeNode;
  depth: number;
  selectedId?: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (topic: Topic) => void;
  onCreateChild?: (parentId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
  onCreateChild,
}) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          'w-full flex items-center gap-1 px-2 py-1.5 text-xs rounded transition-colors text-left group',
          isSelected
            ? 'bg-orange-100 text-orange-900 font-medium'
            : 'hover:bg-gray-100 text-gray-700'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="shrink-0 p-0.5 rounded hover:bg-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="w-4" /> /* spacer */
        )}

        {/* Icon */}
        {hasChildren ? (
          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-orange-500" />
        ) : (
          <FileText className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        )}

        {/* Label */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Add child button */}
        {onCreateChild && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(node.id);
            }}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-400 hover:text-orange-600 transition-opacity"
            title="Add sub-topic"
          >
            <Plus className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main selector component ────────────────────────────────────────────

export interface TopicTreeSelectorProps {
  topics: Topic[];
  selectedTopicId?: string | null;
  onSelect: (topic: Topic | null) => void;
  onCreateChild?: (parentId: string) => void;
  className?: string;
  /** Show root-level "New topic" button */
  showCreateRoot?: boolean;
  onCreateRoot?: () => void;
}

export const TopicTreeSelector: React.FC<TopicTreeSelectorProps> = ({
  topics,
  selectedTopicId,
  onSelect,
  onCreateChild,
  className,
  showCreateRoot,
  onCreateRoot,
}) => {
  const tree = useMemo(() => buildTopicTree(topics), [topics]);

  // Auto-expand ancestors of selected topic
  const initialExpanded = useMemo(() => {
    const ids = new Set<string>();
    if (selectedTopicId) {
      const ancestors = getAncestorPath(selectedTopicId, topics);
      for (const a of ancestors) ids.add(a.id);
    }
    // Also expand all nodes that have children (for small trees)
    if (topics.length <= 20) {
      for (const t of topics) {
        if (topics.some((c) => c.parent_topic_id === t.id)) {
          ids.add(t.id);
        }
      }
    }
    return ids;
  }, [selectedTopicId, topics]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (topics.length === 0) {
    return (
      <div className={cn('px-3 py-2 text-xs text-gray-500', className)}>
        No topics yet
      </div>
    );
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {showCreateRoot && onCreateRoot && (
        <button
          type="button"
          onClick={onCreateRoot}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded border-b border-gray-100 mb-1"
        >
          <Plus className="w-3 h-3" />
          New topic
        </button>
      )}
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedTopicId}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
        />
      ))}
    </div>
  );
};
