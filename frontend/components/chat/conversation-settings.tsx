'use client';

import React, { useState, useEffect } from 'react';
import { Settings, X, Save, FileText, Globe, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Conversation, Topic, Document } from '@/lib/api';
import { RAGSettings, RAGSourceSelector } from './rag-source-selector';
import { useToast } from '@/lib/hooks/use-toast';
import { conversationApi, documentApi, topicApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConversationSettingsProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: ConversationSettings) => void;
  className?: string;
}

export interface ConversationSettings {
  ragSettings: RAGSettings;
  documentIds?: string[];
  topicId?: string | null;
}

export const ConversationSettingsPanel: React.FC<ConversationSettingsProps> = ({
  conversation,
  isOpen,
  onClose,
  onSave,
  className,
}) => {
  const [ragSettings, setRagSettings] = useState<RAGSettings>({
    enableDocumentSearch: true,
    enableWebSearch: true,
    documentIds: [],
    maxDocumentChunks: 5,
    minScore: 0.7,
    maxWebResults: 5,
  });
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(conversation.topic_id || null);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load conversation settings from metadata
  useEffect(() => {
    if (conversation.metadata) {
      const metadata = conversation.metadata as any;
      if (metadata.ragSettings) {
        setRagSettings(metadata.ragSettings);
      }
      if (metadata.documentIds) {
        setSelectedDocuments(metadata.documentIds);
      }
    }
  }, [conversation]);

  // Load available documents and topics
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      loadTopics();
    }
  }, [isOpen]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await documentApi.list();
      if (response.success && response.data) {
        setAvailableDocuments(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTopics = async () => {
    try {
      const response = await topicApi.list();
      if (response.success && response.data) {
        setAvailableTopics(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load topics:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings: ConversationSettings = {
        ragSettings: {
          ...ragSettings,
          documentIds: selectedDocuments,
        },
        documentIds: selectedDocuments,
        topicId: selectedTopicId,
      };

      // Save to conversation metadata
      const response = await conversationApi.update(conversation.id, {
        metadata: {
          ...conversation.metadata,
          ragSettings: settings.ragSettings,
          documentIds: settings.documentIds,
        },
        topicId: selectedTopicId,
      });

      if (response.success) {
        toast.success('Settings saved');
        onSave?.(settings);
        onClose();
      } else {
        throw new Error(response.message || 'Failed to save settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
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
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Conversation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* RAG Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              RAG Source Settings
            </label>
            <RAGSourceSelector
              settings={ragSettings}
              onChange={setRagSettings}
              documentCount={availableDocuments.length}
              hasProcessedDocuments={availableDocuments.length > 0}
            />
          </div>

          {/* Document Selection */}
          {ragSettings.enableDocumentSearch && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Selected Documents
              </label>
              {isLoading ? (
                <div className="text-sm text-gray-500">Loading documents...</div>
              ) : availableDocuments.length === 0 ? (
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  No documents available. Upload documents to use document search.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {availableDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleDocumentToggle(doc.id)}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {doc.filename || doc.name || 'Untitled Document'}
                        </div>
                        {doc.metadata?.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {doc.metadata.description}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedDocuments.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''}{' '}
                  selected
                </div>
              )}
            </div>
          )}

          {/* Topic Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Topic Assignment
            </label>
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
                  <div className="text-xs text-gray-500">General conversation</div>
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
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
