import { useState, useCallback, useRef } from 'react';
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

  const calculateETA = useCallback((loaded: number, total: number, speed: number): number => {
    if (speed <= 0 || total <= loaded) return 0;
    const remaining = total - loaded;
    return remaining / speed;
  }, []);

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
          // Update to processing status
          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === id
                ? {
                    ...upload,
                    progress: 100,
                    status: 'processing',
                  }
                : upload
            )
          );

          // Wait a bit, then mark as completed
          setTimeout(() => {
            setUploads((prev) =>
              prev.map((upload) =>
                upload.id === id
                  ? {
                      ...upload,
                      status: 'completed',
                    }
                  : upload
              )
            );

            // Auto-dismiss after 3 seconds
            setTimeout(() => {
              setUploads((prev) => prev.filter((upload) => upload.id !== id));
            }, 3000);
          }, 1000);

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
    [options, calculateETA]
  );

  const cancelUpload = useCallback((uploadId: string) => {
    const abortController = abortControllersRef.current.get(uploadId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(uploadId);
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
