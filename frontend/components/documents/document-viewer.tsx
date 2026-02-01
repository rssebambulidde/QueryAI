'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentItem, documentApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';

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
  const { isMobile } = useMobile();
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
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
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
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
      onClick={() => isMobile && setShowControls(!showControls)}
    >
      {/* Header - Hidden on mobile when controls are hidden */}
      {(!isMobile || showControls) && (
        <div className={cn(
          "flex items-center justify-between bg-black/80 border-b border-gray-800 flex-shrink-0",
          isMobile ? "px-3 py-2" : "px-4 py-3"
        )}>
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <h3 className={cn("font-medium text-white truncate", isMobile ? "text-xs" : "text-sm")}>
              {document.name}
            </h3>
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-400">
              {onPrevious && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPrevious}
                  disabled={!hasPrevious}
                  className={cn(
                    "text-white hover:bg-gray-800 touch-manipulation",
                    isMobile ? "h-9 px-2.5" : "h-7 px-2"
                  )}
                >
                  <ChevronLeft className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                </Button>
              )}
              {onNext && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNext}
                  disabled={!hasNext}
                  className={cn(
                    "text-white hover:bg-gray-800 touch-manipulation",
                    isMobile ? "h-9 px-2.5" : "h-7 px-2"
                  )}
                >
                  <ChevronRight className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                </Button>
              )}
            </div>
          </div>

          {!isMobile && (
            <div className="flex items-center gap-2">
              {/* Zoom Controls - Desktop only in header */}
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
          )}

          {/* Mobile: Close button only in header */}
          {isMobile && (
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-9 px-2.5 text-white hover:bg-gray-800 touch-manipulation min-w-[44px] min-h-[44px]"
              title="Close"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn(
        "flex-1 overflow-auto bg-gray-900 flex items-center justify-center",
        isMobile ? "p-2" : "p-4"
      )}>
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading document...</p>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            style={{ minHeight: isMobile ? '100%' : '600px' }}
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
          <pre className={cn(
            "w-full bg-gray-950 text-gray-100 rounded-lg overflow-auto font-mono whitespace-pre-wrap",
            isMobile ? "max-w-full p-3 text-xs" : "max-w-4xl p-6 text-sm"
          )}>
            {content}
          </pre>
        ) : (
          <div className="text-center text-gray-400">
            <p>Unable to preview this document</p>
          </div>
        )}
      </div>

      {/* Mobile: Bottom Sheet Controls */}
      {isMobile && (!showControls || (imageUrl || pdfUrl)) && (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-black/90 border-t border-gray-800 transition-transform duration-300",
            showControls ? "translate-y-0" : "translate-y-full"
          )}
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-12 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Controls */}
          <div className="px-4 py-3 space-y-3">
            {/* Document name */}
            <div className="text-center">
              <p className="text-xs text-gray-400 truncate">{document.name}</p>
            </div>

            {/* Zoom Controls */}
            {(imageUrl || pdfUrl) && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="h-11 w-11 text-white hover:bg-gray-800 touch-manipulation flex items-center justify-center"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </Button>
                <span className="text-sm text-white min-w-[4rem] text-center font-medium">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="h-11 w-11 text-white hover:bg-gray-800 touch-manipulation flex items-center justify-center"
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </Button>
                {imageUrl && (
                  <Button
                    variant="ghost"
                    onClick={handleRotate}
                    className="h-11 w-11 text-white hover:bg-gray-800 touch-manipulation flex items-center justify-center ml-2"
                    title="Rotate"
                  >
                    <RotateCw className="w-5 h-5" />
                  </Button>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                onClick={handleDownload}
                className="flex-1 h-11 text-white hover:bg-gray-800 touch-manipulation flex items-center justify-center gap-2"
                title="Download"
              >
                <Download className="w-5 h-5" />
                <span className="text-sm">Download</span>
              </Button>
              {!isMobile && (
                <Button
                  variant="ghost"
                  onClick={handleFullscreen}
                  className="h-11 w-11 text-white hover:bg-gray-800 touch-manipulation flex items-center justify-center"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
