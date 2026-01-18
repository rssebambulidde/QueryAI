'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { documentApi, DocumentItem } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export const DocumentManager = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  }, [documents]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await documentApi.list();
      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        toast.error(response.message || 'Failed to load documents');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please choose a file to upload');
      return;
    }

    setIsUploading(true);
    try {
      const response = await documentApi.upload(selectedFile);
      if (response.success) {
        toast.success('Document uploaded');
        setSelectedFile(null);
        await loadDocuments();
      } else {
        toast.error(response.message || 'Upload failed');
      }
    } catch (error: any) {
      if (error?.code === 'ECONNABORTED') {
        toast.error('Upload timed out. Please try again.');
      } else {
        toast.error(error.message || 'Upload failed');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (path: string) => {
    setIsLoading(true);
    try {
      const response = await documentApi.delete(path);
      if (response.success) {
        toast.success('Document deleted');
        setDocuments((prev) => prev.filter((doc) => doc.path !== path));
      } else {
        toast.error(response.message || 'Delete failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Your Documents</h2>
          <p className="text-xs text-gray-500">Upload PDF, TXT, MD, or DOCX files (max 10MB).</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
        <input
          type="file"
          accept=".pdf,.txt,.md,.docx"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            setSelectedFile(file);
          }}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading documents...</p>
        ) : sortedDocuments.length === 0 ? (
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedDocuments.map((doc) => (
              <div
                key={doc.path}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(doc.size)} · {doc.mimeType}
                    {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDelete(doc.path)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
