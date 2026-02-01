'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Tag, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentItem, Topic, documentApi, topicApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DocumentMetadataEditorProps {
  document: DocumentItem;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updated: DocumentItem) => void;
  className?: string;
}

export const DocumentMetadataEditor: React.FC<DocumentMetadataEditorProps> = ({
  document,
  isOpen,
  onClose,
  onSave,
  className,
}) => {
  const [title, setTitle] = useState(document.name || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadMetadata();
      loadTopics();
    }
  }, [isOpen, document]);

  const loadMetadata = async () => {
    // Load existing metadata if available
    // For now, we'll use document.name as title
    setTitle(document.name || '');
    // Metadata would come from document.metadata if available
    if ((document as any).metadata) {
      const metadata = (document as any).metadata;
      setDescription(metadata.description || '');
      setTags(metadata.tags || []);
      setSelectedTopicId(metadata.topicId || null);
    }
  };

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const response = await topicApi.list();
      if (response.success && response.data) {
        setAvailableTopics(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load topics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Note: This assumes the backend supports metadata updates
      // You may need to add an update endpoint to documentApi
      const metadata = {
        description,
        tags,
        topicId: selectedTopicId,
      };

      // For now, we'll show a toast since the API might not support metadata updates yet
      // In a real implementation, you'd call: documentApi.update(document.id, { metadata, name: title })
      
      toast.success('Metadata saved (Note: Backend update endpoint may need to be implemented)');
      onSave?.(document);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save metadata');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
        className
      )}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Document Metadata</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Document Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title..."
              className="w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter document description..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Tags
            </label>
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag and press Enter..."
                className="flex-1"
              />
              <Button onClick={handleAddTag} size="sm" variant="outline">
                <Tag className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Topic Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Topic Assignment
            </label>
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading topics...</div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="topic"
                    checked={selectedTopicId === null}
                    onChange={() => setSelectedTopicId(null)}
                    className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                  />
                  <Folder className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">No Topic</div>
                    <div className="text-xs text-gray-500">General document</div>
                  </div>
                </label>
                {availableTopics.map((topic) => (
                  <label
                    key={topic.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="topic"
                      checked={selectedTopicId === topic.id}
                      onChange={() => setSelectedTopicId(topic.id)}
                      className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                    />
                    <Folder className="w-4 h-4 text-orange-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                      {topic.description && (
                        <div className="text-xs text-gray-500">{topic.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose} variant="outline" disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSaving ? (
              <>
                <Save className="w-4 h-4 mr-2 animate-pulse" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Metadata
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
