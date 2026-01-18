'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { documentApi, DocumentItem } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { FileText, File, FileCode, FileType, Download, Eye, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const getFileIcon = (mimeType: string, fileName: string): React.ReactElement => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return <FileText className="w-5 h-5 text-red-600" />;
  } else if (mimeType === 'text/markdown' || extension === 'md') {
    return <FileCode className="w-5 h-5 text-blue-600" />;
  } else if (mimeType === 'text/plain' || extension === 'txt') {
    return <FileType className="w-5 h-5 text-gray-600" />;
  } else if (extension === 'docx') {
    return <File className="w-5 h-5 text-blue-700" />;
  }
  return <File className="w-5 h-5 text-gray-500" />;
};

const getTotalSize = (documents: DocumentItem[]): number => {
  return documents.reduce((sum, doc) => sum + doc.size, 0);
};

export const DocumentManager = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  }, [documents]);

  const totalSize = useMemo(() => getTotalSize(documents), [documents]);

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

  const handleFileSelect = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    const allowedTypes = ['.pdf', '.txt', '.md', '.docx'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(extension)) {
      toast.error('Unsupported file type. Allowed: PDF, TXT, MD, DOCX.');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please choose a file to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const response = await documentApi.upload(selectedFile, (progress) => {
        setUploadProgress(progress);
      });
      if (response.success) {
        toast.success('Document uploaded successfully');
        setSelectedFile(null);
        setUploadProgress(0);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadDocuments();
      } else {
        toast.error(response.message || 'Upload failed');
      }
    } catch (error: any) {
      if (error?.code === 'ECONNABORTED') {
        toast.error('Upload timed out. Please try again.');
      } else if (error?.response?.data?.error?.message) {
        toast.error(error.response.data.error.message);
      } else if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.message || 'Upload failed');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const blob = await documentApi.download(doc.path);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download document');
    }
  };

  const handleView = async (doc: DocumentItem) => {
    try {
      const blob = await documentApi.download(doc.path);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error: any) {
      toast.error(error.message || 'Failed to open document');
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

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

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Your Documents
            {documents.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({documents.length} {documents.length === 1 ? 'document' : 'documents'})
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500">
            Upload PDF, TXT, MD, or DOCX files (max 10MB).
            {totalSize > 0 && ` · Total storage: ${formatBytes(totalSize)}`}
          </p>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 mb-4 transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50',
          selectedFile && 'border-blue-400 bg-blue-50'
        )}
      >
        <div className="flex flex-col items-center text-center">
          <Upload className={cn('w-8 h-8 mb-2', isDragging ? 'text-blue-600' : 'text-gray-400')} />
          <p className="text-sm font-medium text-gray-700 mb-1">
            {isDragging ? 'Drop file here' : 'Drag & drop file here'}
          </p>
          <p className="text-xs text-gray-500 mb-3">or</p>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              accept=".pdf,.txt,.md,.docx"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <File className="w-4 h-4 mr-2" />
              Choose File
            </Button>
            {selectedFile && (
              <>
                <span className="text-sm text-gray-700 truncate max-w-xs">
                  {selectedFile.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
              className="min-w-[100px]"
            >
              {isUploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {isUploading && uploadProgress > 0 && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="border-t border-gray-100 pt-4">
        {isLoading && !isUploading ? (
          <p className="text-sm text-gray-500">Loading documents...</p>
        ) : sortedDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Upload your first document to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedDocuments.map((doc) => (
              <div
                key={doc.path}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.mimeType, doc.name)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(doc.size)}
                      {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(doc)}
                    className="h-8 px-2"
                    title="View document"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    className="h-8 px-2"
                    title="Download document"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(doc.path)}
                    className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
