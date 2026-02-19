/**
 * Processing Progress Service
 *
 * In-memory tracker for document processing stages.
 * Provides real-time progress data for the GET /api/documents/:id/status endpoint.
 *
 * Progress is ephemeral — the authoritative status lives in the documents table.
 * This service adds granular sub-stage tracking (extract → chunk → embed → index)
 * and per-stage progress percentages that the documents.status column doesn't capture.
 */

import logger from '../config/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProcessingStage =
  | 'queued'
  | 'downloading'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

export interface StageRecord {
  name: ProcessingStage;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ProcessingProgress {
  documentId: string;
  stage: ProcessingStage;
  /** 0-100. Reflects approximate progress within the overall pipeline. */
  progressPercent: number;
  /** Human-readable label for the current activity. */
  stageLabel: string;
  /** When overall processing started. */
  startedAt: string;
  /** When the current stage started. */
  stageStartedAt: string;
  /** If the pipeline failed, which stage and what error. */
  error?: string;
  failedStage?: ProcessingStage;
  /** Ordered log of completed stages. */
  stages: StageRecord[];
}

// Stage ordering with approximate progress weights (out of 100).
const STAGE_WEIGHTS: Record<ProcessingStage, { start: number; end: number; label: string }> = {
  queued:       { start: 0,  end: 2,   label: 'Queued…' },
  downloading:  { start: 2,  end: 10,  label: 'Downloading file…' },
  extracting:   { start: 10, end: 35,  label: 'Extracting text…' },
  chunking:     { start: 35, end: 50,  label: 'Splitting into chunks…' },
  embedding:    { start: 50, end: 85,  label: 'Creating embeddings…' },
  indexing:     { start: 85, end: 98,  label: 'Indexing in vector store…' },
  completed:    { start: 100, end: 100, label: 'Completed' },
  failed:       { start: 0,  end: 0,   label: 'Failed' },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ProcessingProgressService {
  /** In-memory map: documentId → progress */
  private static progressMap = new Map<string, ProcessingProgress>();

  /** Auto-cleanup: remove completed entries after this many ms. */
  private static readonly CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialise tracking for a document that's about to be processed.
   */
  static start(documentId: string): void {
    const now = new Date().toISOString();
    const entry: ProcessingProgress = {
      documentId,
      stage: 'queued',
      progressPercent: 0,
      stageLabel: STAGE_WEIGHTS.queued.label,
      startedAt: now,
      stageStartedAt: now,
      stages: [{ name: 'queued', startedAt: now }],
    };
    this.progressMap.set(documentId, entry);
    logger.debug('Processing progress: started tracking', { documentId });
  }

  /**
   * Transition to a new stage. Automatically completes the previous stage.
   */
  static advanceStage(documentId: string, stage: ProcessingStage): void {
    const entry = this.progressMap.get(documentId);
    if (!entry) {
      // Late start — create an entry on the fly.
      this.start(documentId);
      if (stage !== 'queued') {
        this.advanceStage(documentId, stage);
      }
      return;
    }

    const now = new Date().toISOString();

    // Complete previous stage record
    const prev = entry.stages[entry.stages.length - 1];
    if (prev && !prev.completedAt) {
      prev.completedAt = now;
    }

    const weight = STAGE_WEIGHTS[stage] || STAGE_WEIGHTS.queued;

    entry.stage = stage;
    entry.progressPercent = weight.start;
    entry.stageLabel = weight.label;
    entry.stageStartedAt = now;
    entry.stages.push({ name: stage, startedAt: now });

    logger.debug('Processing progress: stage advanced', { documentId, stage, progress: weight.start });

    // If completed, schedule cleanup
    if (stage === 'completed') {
      entry.progressPercent = 100;
      const lastStage = entry.stages[entry.stages.length - 1];
      if (lastStage) lastStage.completedAt = now;
      this.scheduleCleanup(documentId);
    }
  }

  /**
   * Update progress percentage within the current stage (interpolated).
   * `stageProgress` is 0–1 representing how far through the current stage.
   */
  static updateStageProgress(documentId: string, stageProgress: number): void {
    const entry = this.progressMap.get(documentId);
    if (!entry) return;

    const weight = STAGE_WEIGHTS[entry.stage];
    if (!weight) return;

    const clamped = Math.min(1, Math.max(0, stageProgress));
    entry.progressPercent = Math.round(weight.start + clamped * (weight.end - weight.start));
  }

  /**
   * Record a failure. Preserves stage history for diagnostics.
   */
  static fail(documentId: string, error: string): void {
    const entry = this.progressMap.get(documentId);
    if (!entry) return;

    const now = new Date().toISOString();
    const failedStage = entry.stage;

    // Complete current stage record as failed
    const current = entry.stages[entry.stages.length - 1];
    if (current && !current.completedAt) {
      current.completedAt = now;
      current.error = error;
    }

    entry.stage = 'failed';
    entry.stageLabel = `Failed at: ${STAGE_WEIGHTS[failedStage]?.label || failedStage}`;
    entry.error = error;
    entry.failedStage = failedStage;

    logger.debug('Processing progress: failed', { documentId, failedStage, error });
    this.scheduleCleanup(documentId);
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  /**
   * Get current progress for a document.
   * Returns `null` if no active tracking (client should fall back to documents.status).
   */
  static getProgress(documentId: string): ProcessingProgress | null {
    return this.progressMap.get(documentId) ?? null;
  }

  /** Check if a document is currently being tracked. */
  static isTracking(documentId: string): boolean {
    return this.progressMap.has(documentId);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  private static scheduleCleanup(documentId: string): void {
    setTimeout(() => {
      this.progressMap.delete(documentId);
      logger.debug('Processing progress: cleaned up', { documentId });
    }, this.CLEANUP_DELAY_MS);
  }

  /** Manual cleanup — useful for clear-processing. */
  static clear(documentId: string): void {
    this.progressMap.delete(documentId);
  }

  /** How many documents are currently tracked (for diagnostics). */
  static get activeCount(): number {
    return this.progressMap.size;
  }
}
