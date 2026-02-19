/**
 * Workspace Routes
 *
 * GET /api/workspace — returns the full research graph data structure
 * (topics, documents, conversation counts, citation counts) for
 * the React Flow graph visualisation.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

const router = Router();

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

interface WorkspaceTopicNode {
  id: string;
  name: string;
  description: string | null;
  conversationCount: number;
  documentCount: number;
  createdAt: string;
}

interface WorkspaceDocumentNode {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  topicId: string | null;
  status: string;
  createdAt: string;
}

interface WorkspaceConversationEdge {
  topicId: string;
  count: number;
}

interface TopicCitation {
  topicId: string;
  citations: Array<{
    sourceTitle: string;
    sourceType: 'document' | 'web';
    documentId: string | null;
    citationCount: number;
  }>;
}

interface WorkspaceGraphData {
  topics: WorkspaceTopicNode[];
  documents: WorkspaceDocumentNode[];
  conversationCounts: WorkspaceConversationEdge[];
  topicCitations: TopicCitation[];
}

// ───────────────────────────────────────────────────────────────────
// GET /api/workspace
// ───────────────────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Run all queries in parallel for speed
    const [
      topicsResult,
      documentsResult,
      conversationCountsResult,
    ] = await Promise.all([
      // 1. All topics
      supabaseAdmin
        .from('topics')
        .select('id, name, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // 2. All documents (with topic linkage)
      supabaseAdmin
        .from('documents')
        .select('id, filename, file_type, file_size, topic_id, status, created_at')
        .eq('user_id', userId)
        .in('status', ['extracted', 'embedded', 'processed']),

      // 3. Conversation counts per topic
      supabaseAdmin
        .from('conversations')
        .select('topic_id')
        .eq('user_id', userId)
        .not('topic_id', 'is', null),
    ]);

    // Check for errors
    if (topicsResult.error) {
      logger.error('Workspace: failed to fetch topics', { error: topicsResult.error.message, userId });
      throw topicsResult.error;
    }
    if (documentsResult.error) {
      logger.error('Workspace: failed to fetch documents', { error: documentsResult.error.message, userId });
      throw documentsResult.error;
    }
    if (conversationCountsResult.error) {
      logger.error('Workspace: failed to fetch conversation counts', { error: conversationCountsResult.error.message, userId });
      throw conversationCountsResult.error;
    }

    const topics = topicsResult.data || [];
    const documents = documentsResult.data || [];
    const conversations = conversationCountsResult.data || [];

    // Aggregate conversation counts per topic
    const convCountMap = new Map<string, number>();
    for (const conv of conversations) {
      if (conv.topic_id) {
        convCountMap.set(conv.topic_id, (convCountMap.get(conv.topic_id) || 0) + 1);
      }
    }

    // Aggregate document counts per topic from the docs array
    const docCountMap = new Map<string, number>();
    for (const doc of documents) {
      if (doc.topic_id) {
        docCountMap.set(doc.topic_id, (docCountMap.get(doc.topic_id) || 0) + 1);
      }
    }

    // Build topic nodes
    const topicNodes: WorkspaceTopicNode[] = topics.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description || null,
      conversationCount: convCountMap.get(t.id) || 0,
      documentCount: docCountMap.get(t.id) || 0,
      createdAt: t.created_at,
    }));

    // Build document nodes
    const documentNodes: WorkspaceDocumentNode[] = documents.map((d: any) => ({
      id: d.id,
      filename: d.filename,
      fileType: d.file_type,
      fileSize: d.file_size,
      topicId: d.topic_id || null,
      status: d.status,
      createdAt: d.created_at,
    }));

    // Conversation count edges (for edge thickness)
    const conversationCounts: WorkspaceConversationEdge[] = Array.from(convCountMap.entries()).map(
      ([topicId, count]) => ({ topicId, count })
    );

    // Fetch top-cited sources per topic (max 5 per topic, run in parallel)
    const topicCitations: TopicCitation[] = [];
    if (topics.length > 0) {
      const { CitedSourceService } = await import('../services/cited-source.service');
      const citationPromises = topics.map(async (t: any) => {
        try {
          const sources = await CitedSourceService.getTopicCitedSources(userId, t.id, 5);
          return {
            topicId: t.id,
            citations: sources.map((s) => ({
              sourceTitle: s.source_title,
              sourceType: s.source_type,
              documentId: s.document_id,
              citationCount: s.topic_citation_count,
            })),
          };
        } catch {
          return { topicId: t.id, citations: [] };
        }
      });
      const results = await Promise.all(citationPromises);
      topicCitations.push(...results.filter((r) => r.citations.length > 0));
    }

    const graphData: WorkspaceGraphData = {
      topics: topicNodes,
      documents: documentNodes,
      conversationCounts,
      topicCitations,
    };

    logger.info('Workspace graph data fetched', {
      userId,
      topics: topicNodes.length,
      documents: documentNodes.length,
      conversationEdges: conversationCounts.length,
      topicsWithCitations: topicCitations.length,
    });

    res.json({ success: true, data: graphData });
  })
);

export default router;
