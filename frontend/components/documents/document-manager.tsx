'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { documentApi, DocumentItem, topicApi, Topic } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { FileText, File, FileCode, FileType, Download, Eye, Trash2, Upload, X, CheckCircle2, Clock, AlertCircle, RefreshCw, Play, Eraser, Settings, Tag, Edit2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { DocumentViewer } from './document-viewer';
import { DocumentMetadataEditor } from './document-metadata-editor';
import { DocumentSearch } from './document-search';
import { DocumentStatusBadge } from './document-status-badge';
import { UploadProgress } from './upload-progress';
import { useDocumentUpload } from '@/lib/hooks/use-document-upload';
import { MobileUpload } from '@/components/mobile/mobile-upload';
import { useMobile } from '@/lib/hooks/use-mobile';

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
    return <FileCode className="w-5 h-5 text-orange-600" />;
  } else if (mimeType === 'text/plain' || extension === 'txt') {
    return <FileType className="w-5 h-5 text-gray-600" />;
  } else if (extension === 'docx') {
    return <File className="w-5 h-5 text-orange-700" />;
  }
  return <File className="w-5 h-5 text-gray-500" />;
};

const getTotalSize = (documents: DocumentItem[]): number => {
  return documents.reduce((sum, doc) => sum + doc.size, 0);
};

const getTotalCharacters = (documents: DocumentItem[]): number => {
  return documents.reduce((sum, doc) => sum + (doc.textLength || 0), 0);
};

const getTotalChunks = (documents: DocumentItem[]): number => {
  return documents.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0);
};

export const DocumentManager = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showChunkingSettings, setShowChunkingSettings] = useState(false);
  const [processingDocument, setProcessingDocument] = useState<DocumentItem | null>(null);
  const [chunkingSettings, setChunkingSettings] = useState({
    maxChunkSize: 800,
    overlapSize: 100,
  });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<DocumentItem | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isMobile } = useMobile();
  
  // Enhanced upload with progress tracking
  const { uploads, uploadFile, cancelUpload, dismissUpload } = useDocumentUpload({
    onSuccess: (document) => {
      toast.success('Document uploaded successfully');
      loadDocuments();
    },
    onError: (error) => {
      toast.error(error.message || 'Upload failed');
    },
  });

  // Update filtered documents when documents change
  useEffect(() => {
    setFilteredDocuments(documents);
  }, [documents]);

  const totalSize = useMemo(() => getTotalSize(documents), [documents]);
  const totalCharacters = useMemo(() => getTotalCharacters(documents), [documents]);
  const totalChunks = useMemo(() => getTotalChunks(documents), [documents]);

  const loadDocuments = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const response = await documentApi.list();
      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        if (showLoading) {
          toast.error(response.message || 'Failed to load documents');
        }
      }
    } catch (error: any) {
      if (showLoading) {
        toast.error(error.message || 'Failed to load documents');
      }
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Load topics on mount
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await topicApi.list();
        if (response.success && response.data) {
          setTopics(response.data);
        }
      } catch (error) {
        console.warn('Failed to load topics:', error);
      }
    };
    loadTopics();
  }, []);

  // Auto-refresh every 5 seconds if there are documents with 'processing' or 'embedding' status
  useEffect(() => {
    const hasProcessing = documents.some(doc => 
      doc.status === 'processing' || doc.status === 'embedding'
    );
    if (!hasProcessing) {
      return; // No processing documents, no need to set up interval
    }

    const interval = setInterval(() => {
      loadDocuments(false); // Don't show loading spinner for auto-refresh
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, loadDocuments]);

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

    try {
      await uploadFile(selectedFile);
      setSelectedFile(null);
      setSelectedTopicId(null);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      // Error handled by useDocumentUpload
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (!doc.path) {
      toast.error('Document path not available');
      return;
    }
    
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
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to download document');
    }
  };

  const handleView = (doc: DocumentItem) => {
    setViewingDocument(doc);
  };

  const handleEditMetadata = (doc: DocumentItem) => {
    setEditingDocument(doc);
  };

  const handleBulkSelect = (docId: string) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map((d) => d.id || d.path)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedDocuments.size} document(s)?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const deletePromises = Array.from(selectedDocuments).map((id) =>
        documentApi.delete(id).catch((err) => {
          console.error(`Failed to delete ${id}:`, err);
          return null;
        })
      );
      
      await Promise.all(deletePromises);
      toast.success(`${selectedDocuments.size} document(s) deleted`);
      setSelectedDocuments(new Set());
      await loadDocuments();
    } catch (error: any) {
      toast.error('Some documents could not be deleted');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (pathOrId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await documentApi.delete(pathOrId);
      if (response.success) {
        toast.success('Document deleted');
        setDocuments((prev) => prev.filter((doc) => (doc.id || doc.path) !== pathOrId));
      } else {
        toast.error(response.message || 'Delete failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async (doc: DocumentItem) => {
    if (!doc.id) {
      toast.error('Document ID not available');
      return;
    }

    // Show settings dialog first
    setProcessingDocument(doc);
    setShowChunkingSettings(true);
  };

  const handleProcessWithSettings = async () => {
    if (!processingDocument?.id) {
      toast.error('Document ID not available');
      return;
    }

    setShowChunkingSettings(false);
    
    try {
      toast.info('Processing document (extraction + chunking)...');
      const response = await documentApi.process(processingDocument.id, {
        maxChunkSize: chunkingSettings.maxChunkSize,
        overlapSize: chunkingSettings.overlapSize,
      });
      if (response.success) {
        toast.success('Document processing started');
        // Refresh immediately and periodically
        await loadDocuments();
        // The existing auto-refresh will handle periodic updates
      } else {
        toast.error(response.message || 'Failed to start processing');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process document');
    } finally {
      setProcessingDocument(null);
    }
  };

  const handleClearProcessing = async (doc: DocumentItem) => {
    if (!doc.id) {
      toast.error('Document ID not available');
      return;
    }

    if (!confirm('Clear processing data (extracted text, chunks, embeddings)? The document will remain in storage.')) {
      return;
    }

    try {
      const response = await documentApi.clearProcessing(doc.id);
      if (response.success) {
        toast.success('Processing data cleared. Document remains in storage.');
        setTimeout(() => loadDocuments(), 1000);
      } else {
        toast.error(response.message || 'Failed to clear processing data');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear processing data');
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
            {totalCharacters > 0 && ` · Total characters: ${totalCharacters.toLocaleString()}`}
            {totalChunks > 0 && ` · Total chunks: ${totalChunks.toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="mb-4">
          <UploadProgress
            uploads={uploads}
            onCancel={cancelUpload}
            onDismiss={dismissUpload}
          />
        </div>
      )}

      {/* Mobile Upload Component */}
      {isMobile ? (
        <div className="mb-4">
          <MobileUpload
            onFileSelect={handleFileSelect}
            accept=".pdf,.txt,.md,.docx,image/*"
            maxSize={10 * 1024 * 1024}
          />
          {selectedFile && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                <Tag className="w-3 h-3" />
                Tag with Topic (Optional)
              </label>
              <select
                value={selectedTopicId || ''}
                onChange={(e) => setSelectedTopicId(e.target.value || null)}
                disabled={uploads.some(u => u.status === 'uploading')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                <option value="">No topic (general document)</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Tagging documents with topics helps organize them and filter search results.
              </p>
              <Button
                onClick={handleUpload}
                disabled={uploads.some(u => u.status === 'uploading') || !selectedFile}
                className="w-full mt-3 touch-manipulation"
                style={{ minHeight: '44px' }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Desktop Drag and Drop Zone */
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 mb-4 transition-colors',
            isDragging
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50',
            selectedFile && 'border-orange-400 bg-orange-50'
          )}
        >
          <div className="flex flex-col items-center text-center">
            <Upload className={cn('w-8 h-8 mb-2', isDragging ? 'text-orange-600' : 'text-gray-400')} />
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
                disabled={uploads.some(u => u.status === 'uploading')}
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
                disabled={uploads.some(u => u.status === 'uploading') || !selectedFile}
                className="min-w-[100px]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>
            
            {/* Topic Selection */}
            {selectedFile && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                  <Tag className="w-3 h-3" />
                  Tag with Topic (Optional)
                </label>
                <select
                  value={selectedTopicId || ''}
                  onChange={(e) => setSelectedTopicId(e.target.value || null)}
                  disabled={uploads.some(u => u.status === 'uploading')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">No topic (general document)</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Tagging documents with topics helps organize them and filter search results.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="border-t border-gray-100 pt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-orange-600 border-r-transparent mb-2"></div>
            <p className="text-sm text-gray-500">Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {documents.length === 0
                ? 'No documents uploaded yet.'
                : 'No documents match your filters.'}
            </p>
            {documents.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Upload your first document to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select All */}
            {filteredDocuments.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {selectedDocuments.size === filteredDocuments.length ? (
                    <CheckSquare className="w-4 h-4 text-orange-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>Select All</span>
                </button>
              </div>
            )}
            {filteredDocuments.map((doc) => {
              const docId = doc.id || doc.path;
              const isSelected = selectedDocuments.has(docId);
              return (
              <div
                key={docId}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  isSelected
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-100 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Selection Checkbox */}
                  <button
                    onClick={() => handleBulkSelect(docId)}
                    className="flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-orange-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  {getFileIcon(doc.mimeType, doc.name)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      <DocumentStatusBadge
                        document={doc}
                        onRefresh={() => loadDocuments(false)}
                        showProgress={true}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatBytes(doc.size)}
                      {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ''}
                      {(doc.status === 'extracted' || doc.status === 'processed' || doc.status === 'embedded') && doc.textLength && ` · ${doc.textLength.toLocaleString()} chars`}
                      {doc.chunkCount && doc.chunkCount > 0 && ` · ${doc.chunkCount} chunk${doc.chunkCount !== 1 ? 's' : ''}`}
                      {doc.status === 'failed' && doc.extractionError && ` · ${doc.extractionError}`}
                      {doc.status === 'embedding_failed' && doc.embeddingError && ` · ${doc.embeddingError}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Edit Metadata Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditMetadata(doc)}
                    className="h-8 px-3"
                    title="Edit metadata"
                  >
                    <Edit2 className="w-3 h-3 mr-1.5" />
                    Edit
                  </Button>
                  
                  {/* Process button - show for stored documents or documents that aren't processed yet */}
                  {doc.id && (doc.status === 'stored' || (doc.status !== 'processed' && doc.status !== 'processing' && doc.status !== 'embedding' && doc.status !== 'extracted' && doc.status !== 'embedded')) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProcess(doc)}
                      className="h-8 px-3 text-orange-600 border-orange-200 hover:bg-orange-50"
                      disabled={isLoading}
                    >
                      <Play className="w-3 h-3 mr-1.5" />
                      Process
                    </Button>
                  )}
                  {/* Retry button - show for failed documents */}
                  {(doc.status === 'failed' || doc.status === 'embedding_failed') && doc.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await documentApi.process(doc.id!);
                          toast.success('Processing retry started');
                          setTimeout(() => loadDocuments(), 2000);
                        } catch (error: any) {
                          toast.error(error.message || 'Failed to retry processing');
                        }
                      }}
                      className="h-8 px-3"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Retry
                    </Button>
                  )}
                  {/* Clear processing button - show for processed/extracted documents */}
                  {doc.id && (doc.status === 'processed' || doc.status === 'extracted' || doc.status === 'embedded') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClearProcessing(doc)}
                      className="h-8 px-3 text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <Eraser className="w-3 h-3 mr-1.5" />
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(doc)}
                    className="h-8 px-3"
                    disabled={!doc.path || (doc.status && (doc.status === 'stored' || doc.status === 'processing' || doc.status === 'embedding' || doc.status === 'failed' || doc.status === 'embedding_failed'))}
                    title={!doc.path ? 'Document path not available' : doc.status && (doc.status === 'stored' || doc.status === 'processing' || doc.status === 'embedding') ? `Document is ${doc.status}` : 'View document'}
                  >
                    <Eye className="w-3 h-3 mr-1.5" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    className="h-8 px-3"
                    disabled={!doc.path || (doc.status && (doc.status === 'stored' || doc.status === 'processing' || doc.status === 'embedding' || doc.status === 'failed' || doc.status === 'embedding_failed'))}
                    title={!doc.path ? 'Document path not available' : doc.status && (doc.status === 'stored' || doc.status === 'processing' || doc.status === 'embedding') ? `Document is ${doc.status}` : 'Download document'}
                  >
                    <Download className="w-3 h-3 mr-1.5" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(doc.id || doc.path)}
                    className="h-8 px-3 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
            })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Viewer */}
      {viewingDocument && (
        <DocumentViewer
          document={viewingDocument}
          isOpen={!!viewingDocument}
          onClose={() => setViewingDocument(null)}
          onNext={() => {
            const currentIndex = filteredDocuments.findIndex(
              (d) => (d.id || d.path) === (viewingDocument.id || viewingDocument.path)
            );
            if (currentIndex < filteredDocuments.length - 1) {
              setViewingDocument(filteredDocuments[currentIndex + 1]);
            }
          }}
          onPrevious={() => {
            const currentIndex = filteredDocuments.findIndex(
              (d) => (d.id || d.path) === (viewingDocument.id || viewingDocument.path)
            );
            if (currentIndex > 0) {
              setViewingDocument(filteredDocuments[currentIndex - 1]);
            }
          }}
          hasNext={
            filteredDocuments.findIndex(
              (d) => (d.id || d.path) === (viewingDocument.id || viewingDocument.path)
            ) < filteredDocuments.length - 1
          }
          hasPrevious={
            filteredDocuments.findIndex(
              (d) => (d.id || d.path) === (viewingDocument.id || viewingDocument.path)
            ) > 0
          }
        />
      )}

      {/* Document Metadata Editor */}
      {editingDocument && (
        <DocumentMetadataEditor
          document={editingDocument}
          isOpen={!!editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={(updated) => {
            setDocuments((prev) =>
              prev.map((d) => (d.id || d.path) === (updated.id || updated.path) ? updated : d)
            );
            loadDocuments();
          }}
        />
      )}

      {/* Chunking Settings Dialog */}
      {showChunkingSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Chunking Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowChunkingSettings(false);
                  setProcessingDocument(null);
                }}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Input
                  type="number"
                  label="Max Chunk Size (tokens)"
                  value={chunkingSettings.maxChunkSize}
                  onChange={(e) => setChunkingSettings({
                    ...chunkingSettings,
                    maxChunkSize: parseInt(e.target.value) || 800,
                  })}
                  min={100}
                  max={2000}
                  step={50}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum tokens per chunk (default: 800, ~600 words). Range: 100-2000
                </p>
              </div>
              
              <div>
                <Input
                  type="number"
                  label="Overlap Size (tokens)"
                  value={chunkingSettings.overlapSize}
                  onChange={(e) => setChunkingSettings({
                    ...chunkingSettings,
                    overlapSize: parseInt(e.target.value) || 100,
                  })}
                  min={0}
                  max={500}
                  step={25}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Overlap tokens between chunks (default: 100, ~75 words). Range: 0-500
                </p>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-800">
                  <strong>Tip:</strong> Larger chunks preserve more context but may be less precise. 
                  Overlap helps maintain continuity between chunks.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowChunkingSettings(false);
                  setProcessingDocument(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProcessWithSettings}
                className="flex-1"
                disabled={!processingDocument}
              >
                <Play className="w-4 h-4 mr-2" />
                Process with Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
