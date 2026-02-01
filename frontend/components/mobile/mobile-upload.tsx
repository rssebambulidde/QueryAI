'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, FileText, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/lib/hooks/use-mobile';
import { useHapticFeedback } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';

interface MobileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  className?: string;
}

export const MobileUpload: React.FC<MobileUploadProps> = ({
  onFileSelect,
  accept = '*/*',
  multiple = false,
  maxSize = 50 * 1024 * 1024, // 50MB default
  className,
}) => {
  const { isMobile } = useMobile();
  const { triggerHaptic } = useHapticFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  if (!isMobile) {
    return null;
  }

  const handleFileSelect = (file: File) => {
    // Validate file size
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    setSelectedFile(file);
    triggerHaptic('light');

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    onFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input to allow capturing again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreview(null);
    triggerHaptic('light');
  };

  const openFilePicker = () => {
    triggerHaptic('light');
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    triggerHaptic('light');
    cameraInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Options */}
      {!selectedFile && (
        <div className="grid grid-cols-2 gap-3">
          {/* File Picker Button */}
          <Button
            onClick={openFilePicker}
            className="h-20 flex flex-col items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-gray-700"
            style={{ minHeight: '80px' }}
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">Choose File</span>
          </Button>

          {/* Camera Button */}
          <Button
            onClick={openCamera}
            className="h-20 flex flex-col items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-gray-700"
            style={{ minHeight: '80px' }}
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm font-medium">Take Photo</span>
          </Button>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="relative bg-white border-2 border-orange-200 rounded-lg p-4">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-48 object-contain rounded-lg bg-gray-50"
              />
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label="Remove file"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 rounded-lg">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={handleRemove}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraInputChange}
        className="hidden"
      />
    </div>
  );
};
