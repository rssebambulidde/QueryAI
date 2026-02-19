'use client';

import React, { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  FileText,
  MessageSquare,
  BookOpen,
  Hash,
  Star,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ───────────────────────────────────────────────────────────────────
// Types — match the backend response shape
// ───────────────────────────────────────────────────────────────────

export interface WorkspaceTopicNode {
  id: string;
  name: string;
  description: string | null;
  conversationCount: number;
  documentCount: number;
  createdAt: string;
}

export interface WorkspaceDocumentNode {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  topicId: string | null;
  status: string;
  createdAt: string;
}

export interface WorkspaceConversationEdge {
  topicId: string;
  count: number;
}

export interface TopicCitationData {
  topicId: string;
  citations: Array<{
    sourceTitle: string;
    sourceType: 'document' | 'web';
    documentId: string | null;
    citationCount: number;
  }>;
}

export interface WorkspaceGraphData {
  topics: WorkspaceTopicNode[];
  documents: WorkspaceDocumentNode[];
  conversationCounts: WorkspaceConversationEdge[];
  topicCitations: TopicCitationData[];
}

// ───────────────────────────────────────────────────────────────────
// Colour palette for topic nodes (deterministic by index)
// ───────────────────────────────────────────────────────────────────

const TOPIC_COLORS = [
  { bg: '#EFF6FF', border: '#3B82F6', accent: '#2563EB', text: '#1E40AF' }, // Blue
  { bg: '#F0FDF4', border: '#22C55E', accent: '#16A34A', text: '#166534' }, // Green
  { bg: '#FFF7ED', border: '#F97316', accent: '#EA580C', text: '#9A3412' }, // Orange
  { bg: '#FAF5FF', border: '#A855F7', accent: '#9333EA', text: '#6B21A8' }, // Purple
  { bg: '#FFF1F2', border: '#F43F5E', accent: '#E11D48', text: '#9F1239' }, // Rose
  { bg: '#ECFEFF', border: '#06B6D4', accent: '#0891B2', text: '#155E75' }, // Cyan
  { bg: '#FFFBEB', border: '#F59E0B', accent: '#D97706', text: '#92400E' }, // Amber
  { bg: '#F0FDFA', border: '#14B8A6', accent: '#0D9488', text: '#115E59' }, // Teal
];

function getTopicColor(index: number) {
  return TOPIC_COLORS[index % TOPIC_COLORS.length];
}

// ───────────────────────────────────────────────────────────────────
// File type icon helpers
// ───────────────────────────────────────────────────────────────────

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#EF4444',
  docx: '#3B82F6',
  txt: '#6B7280',
  md: '#8B5CF6',
};

function fileTypeLabel(type: string) {
  return type.toUpperCase();
}

// ───────────────────────────────────────────────────────────────────
// Custom node components
// ───────────────────────────────────────────────────────────────────

interface TopicNodeData {
  label: string;
  description: string | null;
  conversationCount: number;
  documentCount: number;
  colorIndex: number;
  [key: string]: unknown;
}

function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const colors = getTopicColor(data.colorIndex);
  return (
    <div
      className="rounded-xl shadow-lg border-2 px-5 py-4 min-w-[180px] max-w-[240px] cursor-pointer transition-shadow hover:shadow-xl"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <Handle type="source" position={Position.Right} className="!w-2 !h-2" style={{ background: colors.accent }} />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" style={{ background: colors.accent }} />

      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: colors.accent }}
        >
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm truncate" style={{ color: colors.text }}>
          {data.label}
        </span>
      </div>

      {data.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{data.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {data.documentCount}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {data.conversationCount}
        </span>
      </div>
    </div>
  );
}

interface DocumentNodeData {
  label: string;
  fileType: string;
  fileSize: number;
  [key: string]: unknown;
}

function DocumentNode({ data }: NodeProps<Node<DocumentNodeData>>) {
  const typeColor = FILE_TYPE_COLORS[data.fileType] || '#6B7280';
  return (
    <div className="rounded-lg shadow-md border border-gray-200 bg-white px-3 py-2.5 min-w-[140px] max-w-[200px] cursor-pointer transition-shadow hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-gray-400" />

      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white"
          style={{ backgroundColor: typeColor }}
        >
          {fileTypeLabel(data.fileType)}
        </div>
        <span className="text-xs font-medium text-gray-800 truncate">
          {data.label}
        </span>
      </div>

      <p className="text-[10px] text-gray-400">
        {formatFileSize(data.fileSize)}
      </p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Register custom node types (must be stable reference)
const nodeTypes = {
  topic: TopicNode,
  document: DocumentNode,
};

// ───────────────────────────────────────────────────────────────────
// Layout helpers — arrange nodes in a force-directed-ish layout
// ───────────────────────────────────────────────────────────────────

function buildGraph(
  data: WorkspaceGraphData
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Map conversation counts for edge thickness
  const convCountMap = new Map<string, number>();
  for (const c of data.conversationCounts) {
    convCountMap.set(c.topicId, c.count);
  }

  // Maximum conversation count (for edge thickness scaling)
  const maxConvCount = Math.max(1, ...data.conversationCounts.map((c) => c.count));

  // ── Place topic nodes in a vertical column on the left ──────────
  const topicSpacingY = 200;
  const topicX = 100;
  const topicStartY = 50;

  data.topics.forEach((topic, idx) => {
    nodes.push({
      id: `topic-${topic.id}`,
      type: 'topic',
      position: { x: topicX, y: topicStartY + idx * topicSpacingY },
      data: {
        label: topic.name,
        description: topic.description,
        conversationCount: topic.conversationCount,
        documentCount: topic.documentCount,
        colorIndex: idx,
      },
    });
  });

  // ── Place document nodes to the right, grouped by topic ─────────
  const docX = 450;
  const docSpacingY = 70;
  let docY = topicStartY;

  // Group documents by topic
  const docsByTopic = new Map<string, WorkspaceDocumentNode[]>();
  const orphanDocs: WorkspaceDocumentNode[] = [];

  for (const doc of data.documents) {
    if (doc.topicId) {
      const list = docsByTopic.get(doc.topicId) || [];
      list.push(doc);
      docsByTopic.set(doc.topicId, list);
    } else {
      orphanDocs.push(doc);
    }
  }

  // Topic-assigned documents
  data.topics.forEach((topic, topicIdx) => {
    const topicDocs = docsByTopic.get(topic.id) || [];
    const topicNodeY = topicStartY + topicIdx * topicSpacingY;

    // Centre docs vertically around their topic node
    const groupStartY = topicDocs.length > 0
      ? topicNodeY - ((topicDocs.length - 1) * docSpacingY) / 2
      : topicNodeY;

    topicDocs.forEach((doc, docIdx) => {
      const currentDocY = groupStartY + docIdx * docSpacingY;
      nodes.push({
        id: `doc-${doc.id}`,
        type: 'document',
        position: { x: docX, y: currentDocY },
        data: {
          label: doc.filename,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
        },
      });

      edges.push({
        id: `edge-topic-${topic.id}-doc-${doc.id}`,
        source: `topic-${topic.id}`,
        target: `doc-${doc.id}`,
        type: 'default',
        animated: false,
        style: { stroke: getTopicColor(topicIdx).border, strokeWidth: 1.5, opacity: 0.6 },
      });
    });

    // Conversation edge (invisible source node not needed — we indicate
    // activity via edge thickness on the topic→doc edges and the topic
    // node badge already shows the count; but we add a self-referencing
    // pseudo-marker for visual weight on the topic node border)
  });

  // Orphan documents (no topic) — place below all topic groups
  if (orphanDocs.length > 0) {
    const orphanStartY = topicStartY + data.topics.length * topicSpacingY + 40;
    orphanDocs.forEach((doc, idx) => {
      nodes.push({
        id: `doc-${doc.id}`,
        type: 'document',
        position: { x: docX, y: orphanStartY + idx * docSpacingY },
        data: {
          label: doc.filename,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
        },
      });
    });
  }

  return { nodes, edges };
}

// ───────────────────────────────────────────────────────────────────
// Research Map panel (most-cited docs per topic)
// ───────────────────────────────────────────────────────────────────

interface ResearchMapPanelProps {
  topicCitations: TopicCitationData[];
  topics: WorkspaceTopicNode[];
  onDocumentClick?: (documentId: string) => void;
}

function ResearchMapPanel({ topicCitations, topics, onDocumentClick }: ResearchMapPanelProps) {
  const topicNameMap = useMemo(() => {
    const m = new Map<string, string>();
    topics.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [topics]);

  if (topicCitations.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-8">
        No citations tracked yet. Start asking questions to build your research map.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topicCitations.map((tc) => {
        const topicName = topicNameMap.get(tc.topicId) || 'Unknown Topic';
        return (
          <div key={tc.topicId}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {topicName}
            </h4>
            <ul className="space-y-1">
              {tc.citations.map((c, idx) => (
                <li
                  key={`${tc.topicId}-${idx}`}
                  className={cn(
                    'flex items-center gap-2 text-sm px-2 py-1.5 rounded-md',
                    c.documentId ? 'hover:bg-gray-50 cursor-pointer' : ''
                  )}
                  onClick={() => c.documentId && onDocumentClick?.(c.documentId)}
                >
                  <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span className="truncate flex-1 text-gray-700">{c.sourceTitle}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    <Hash className="w-3 h-3 inline" />
                    {c.citationCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────

interface ResearchGraphProps {
  data: WorkspaceGraphData;
  onTopicClick?: (topicId: string) => void;
  onDocumentClick?: (documentId: string) => void;
}

function ResearchGraphInner({ data, onTopicClick, onDocumentClick }: ResearchGraphProps) {
  const [showResearchMap, setShowResearchMap] = useState(true);
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => buildGraph(data), [data]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('topic-')) {
        const topicId = node.id.replace('topic-', '');
        onTopicClick?.(topicId);
      } else if (node.id.startsWith('doc-')) {
        const docId = node.id.replace('doc-', '');
        onDocumentClick?.(docId);
      }
    },
    [onTopicClick, onDocumentClick]
  );

  return (
    <div className="flex h-full w-full">
      {/* Graph canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#f1f5f9" />
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-gray-200 !shadow-md !rounded-lg"
          />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-white !border !border-gray-200 !shadow-md !rounded-lg"
            maskColor="rgba(0,0,0,0.08)"
          />
        </ReactFlow>

        {/* Empty state overlay */}
        {data.topics.length === 0 && data.documents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center max-w-sm">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">No research data yet</h3>
              <p className="text-sm text-gray-400">
                Create topics and upload documents to see your research graph
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Research Map side panel */}
      <div
        className={cn(
          'border-l border-gray-200 bg-white transition-all duration-200 overflow-hidden flex flex-col',
          showResearchMap ? 'w-72' : 'w-0'
        )}
      >
        {showResearchMap && (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Research Map</h3>
              <button
                onClick={() => setShowResearchMap(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-xs text-gray-400 mb-3">Most cited sources per topic</p>
              <ResearchMapPanel
                topicCitations={data.topicCitations}
                topics={data.topics}
                onDocumentClick={onDocumentClick}
              />
            </div>
          </>
        )}
      </div>

      {/* Toggle button when panel is collapsed */}
      {!showResearchMap && (
        <button
          onClick={() => setShowResearchMap(true)}
          className="absolute right-4 top-4 z-10 bg-white border border-gray-200 shadow-md rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <Star className="w-3 h-3 text-amber-400" />
          Research Map
        </button>
      )}
    </div>
  );
}

export function ResearchGraph(props: ResearchGraphProps) {
  return (
    <ReactFlowProvider>
      <ResearchGraphInner {...props} />
    </ReactFlowProvider>
  );
}
