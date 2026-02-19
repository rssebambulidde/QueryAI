import { useState, useCallback, useRef, useEffect } from 'react';
import { documentApi, DocumentItem } from '@/lib/api';
import { UploadProgressItem } from '@/components/documents/upload-progress';

interface UseDocumentUploadOptions {
  onSuccess?: (document: DocumentItem) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  topicId?: string;
}

export const useDocumentUpload = (options: UseDocumentUploadOptions = {}) => {
  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const calculateETA = useCallback((loaded: number, total: number, speed: number): number => {
    if (speed <= 0 || total <= loaded) return 0;
    const remaining = total - loaded;
    return remaining / speed;
  }, []);

  // Clean up polling timers on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((timer) => clearTimeout(timer));
      pollingRef.current.clear();
    };
  }, []);

  /**
   * Poll GET /api/documents/:id/status every 2s until completed or failed.
   * Updates the upload entry with real stage labels and progress.
   */
  const pollProcessingStatus = useCallback(
    (uploadId: string, documentId: string) => {
      let pollCount = 0;
      const MAX_POLLS = 150; // 5 minutes at 2s intervals

      const tick = async () => {
        pollCount++;
        if (pollCount > MAX_POLLS) {
          // Timeout — mark completed (document-manager polling will take over)
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId ? { ...u, status: 'completed' as const } : u
            )
          );
          pollingRef.current.delete(uploadId);
          setTimeout(() => {
            setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          }, 3000);
          return;
        }

        try {
          const res = await documentApi.getProcessingStatus(documentId);
          if (!res.success || !res.data) return;

          const { status, processing } = res.data;

          // Terminal states
          if (status === 'processed' || status === 'embedded') {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? { ...u, status: 'completed' as const, processingProgress: 100, stageLabel: 'Completed' }
                  : u
              )
            );
            pollingRef.current.delete(uploadId);
            setTimeout(() => {
              setUploads((prev) => prev.filter((u) => u.id !== uploadId));
            }, 3000);
            return;
          }

          if (status === 'failed' || status === 'embedding_failed') {
            const errorMsg = processing?.error
              || res.data.extractionError
              || res.data.embeddingError
              || 'Processing failed';
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? { ...u, status: 'error' as const, error: errorMsg, stageLabel: processing?.stageLabel }
                  : u
              )
            );
            pollingRef.current.delete(uploadId);
            return;
          }

          // Still processing — update stage info
          if (processing) {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? {
                      ...u,
                      stageLabel: processing.stageLabel,
                      processingProgress: processing.progressPercent,
                    }
                  : u
              )
            );
          }
        } catch {
          // Silently ignore polling errors — retry on next tick
        }

        // Schedule next tick
        const timer = setTimeout(tick, 2000);
        pollingRef.current.set(uploadId, timer);
      };

      // First poll after a short delay to let the backend start processing
      const timer = setTimeout(tick, 1000);
      pollingRef.current.set(uploadId, timer);
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File, uploadId?: string): Promise<DocumentItem | null> => {
      const id = uploadId || `upload-${Date.now()}-${Math.random()}`;
      const abortController = new AbortController();
      abortControllersRef.current.set(id, abortController);

      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      // Initialize upload item
      setUploads((prev) => [
        ...prev,
        {
          id,
          fileName: file.name,
          progress: 0,
          status: 'uploading',
        },
      ]);

      try {
        const response = await documentApi.upload(
          file,
          (progress) => {
            const now = Date.now();
            const timeDelta = (now - lastTime) / 1000; // seconds
            const loadedDelta = progress - lastLoaded;

            if (timeDelta > 0 && loadedDelta > 0) {
              const totalBytes = file.size;
              const loadedBytes = (progress / 100) * totalBytes;
              const speed = (loadedDelta / timeDelta) * (totalBytes / 100); // bytes per second
              const eta = calculateETA(loadedBytes, totalBytes, speed);

              setUploads((prev) =>
                prev.map((upload) =>
                  upload.id === id
                    ? {
                        ...upload,
                        progress,
                        speed,
                        eta,
                      }
                    : upload
                )
              );

              lastLoaded = progress;
              lastTime = now;
            } else {
              // Update progress even if speed calculation isn't ready
              setUploads((prev) =>
                prev.map((upload) =>
                  upload.id === id
                    ? {
                        ...upload,
                        progress,
                      }
                    : upload
                )
              );
            }

            options.onProgress?.(progress);
          },
          options.topicId
        );

        if (response.success && response.data) {
          const docId = response.data.id;

          // Update to processing status with the document ID for polling
          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === id
                ? {
                    ...upload,
                    progress: 100,
                    status: 'processing',
                    documentId: docId,
                    stageLabel: 'Queued…',
                    processingProgress: 0,
                  }
                : upload
            )
          );

          // Start polling for real processing progress
          if (docId) {
            pollProcessingStatus(id, docId);
          }

          options.onSuccess?.(response.data);
          return response.data;
        } else {
          throw new Error(response.message || 'Upload failed');
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('abort')) {
          // Upload was cancelled
          setUploads((prev) => prev.filter((upload) => upload.id !== id));
          return null;
        }

        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === id
              ? {
                  ...upload,
                  status: 'error',
                  error: error.message || 'Upload failed',
                }
              : upload
          )
        );

        options.onError?.(error);
        throw error;
      } finally {
        abortControllersRef.current.delete(id);
      }
    },
    [options, calculateETA, pollProcessingStatus]
  );

  const cancelUpload = useCallback((uploadId: string) => {
    const abortController = abortControllersRef.current.get(uploadId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(uploadId);
    }
    // Stop any active polling
    const timer = pollingRef.current.get(uploadId);
    if (timer) {
      clearTimeout(timer);
      pollingRef.current.delete(uploadId);
    }
    setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
  }, []);

  const dismissUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((upload) => upload.status !== 'completed'));
  }, []);

  return {
    uploads,
    uploadFile,
    cancelUpload,
    dismissUpload,
    clearCompleted,
  };
};
