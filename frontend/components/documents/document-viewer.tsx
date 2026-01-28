'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentItem, documentApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface DocumentViewerProps {
  document: DocumentItem;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  className,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && document.path) {
      loadDocument();
    }
    return () => {
      // Cleanup URLs
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [isOpen, document.path]);

  const loadDocument = async () => {
    setIsLoading(true);
    try {
      const blob = await documentApi.download(document.path);
      const url = URL.createObjectURL(blob);
      const mimeType = document.mimeType || '';

      // Handle PDF
      if (mimeType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf')) {
        setPdfUrl(url);
        setContent(null);
        setImageUrl(null);
      }
      // Handle Images
      else if (mimeType.startsWith('image/')) {
        setImageUrl(url);
        setContent(null);
        setPdfUrl(null);
      }
      // Handle Text Files
      else if (mimeType.startsWith('text/') || document.name.toLowerCase().endsWith('.txt') || document.name.toLowerCase().endsWith('.md')) {
        const text = await blob.text();
        setContent(text);
        setImageUrl(null);
        setPdfUrl(null);
      }
      // Default: try to display as text
      else {
        try {
          const text = await blob.text();
          setContent(text);
          setImageUrl(null);
          setPdfUrl(null);
        } catch {
          toast.error('Unsupported file type for preview');
          onClose();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load document');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFullscreen = () => {
    if (!isFullscreen) {
      const elem = viewerRef.current;
      if (elem?.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any)?.webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any)?.mozRequestFullScreen) {
        (elem as any).mozRequestFullScreen();
      } else if ((elem as any)?.msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
    } else {
      const doc = document as any;
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = async () => {
    try {
      const blob = await documentApi.download(document.path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download document');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/90 flex flex-col',
        className
      )}
      ref={viewerRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-gray-800">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{document.name}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {onPrevious && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="h-7 px-2 text-white hover:bg-gray-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            {onNext && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNext}
                disabled={!hasNext}
                className="h-7 px-2 text-white hover:bg-gray-800"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          {(imageUrl || pdfUrl) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="h-7 px-2 text-white hover:bg-gray-800"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-400 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="h-7 px-2 text-white hover:bg-gray-800"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              {imageUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRotate}
                  className="h-7 px-2 text-white hover:bg-gray-800"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              )}
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullscreen}
            className="h-7 px-2 text-white hover:bg-gray-800"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-white hover:bg-gray-800"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 px-2 text-white hover:bg-gray-800"
            title="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center p-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading document...</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            style={{ minHeight: '600px' }}
            title={document.name}
          />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={document.name}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s',
            }}
          />
        ) : content ? (
          <pre className="w-full max-w-4xl bg-gray-950 text-gray-100 p-6 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap">
            {content}
          </pre>
        ) : (
          <div className="text-center text-gray-400">
            <p>Unable to preview this document</p>
          </div>
        )}
      </div>
    </div>
  );
};
