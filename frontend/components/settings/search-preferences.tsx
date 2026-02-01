'use client';

import React, { useState, useEffect } from 'react';
import { Search, FileText, Globe, Save, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';
import { RAGSettings, RAGSourceSelector } from '@/components/chat/rag-source-selector';
import { topicApi, Topic } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SearchPreferencesProps {
  className?: string;
  documentCount?: number;
  hasProcessedDocuments?: boolean;
}

export const SearchPreferences: React.FC<SearchPreferencesProps> = ({
  className,
  documentCount = 0,
  hasProcessedDocuments = false,
}) => {
  const [ragSettings, setRagSettings] = useState<RAGSettings>({
    enableDocumentSearch: true,
    enableWebSearch: true,
    maxDocumentChunks: 5,
    minScore: 0.7,
    maxWebResults: 5,
  });
  const [defaultTopicId, setDefaultTopicId] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load saved preferences
  useEffect(() => {
    loadPreferences();
    loadTopics();
  }, []);

  const loadPreferences = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('defaultRAGSettings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setRagSettings(parsed);
        } catch (e) {
          console.error('Failed to parse saved RAG settings:', e);
        }
      }
      
      const savedTopic = localStorage.getItem('defaultTopicId');
      if (savedTopic) {
        setDefaultTopicId(savedTopic);
      }
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (can be extended to save to backend)
      if (typeof window !== 'undefined') {
        localStorage.setItem('defaultRAGSettings', JSON.stringify(ragSettings));
        if (defaultTopicId) {
          localStorage.setItem('defaultTopicId', defaultTopicId);
        } else {
          localStorage.removeItem('defaultTopicId');
        }
      }

      // Note: Backend API endpoint for saving preferences may need to be implemented
      // await userApi.updatePreferences({ ragSettings, defaultTopicId });

      toast.success('Search preferences saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaultSettings: RAGSettings = {
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      minScore: 0.7,
      maxWebResults: 5,
    };
    setRagSettings(defaultSettings);
    setDefaultTopicId(null);
    toast.success('Preferences reset to defaults');
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Search Preferences</h2>
        <p className="text-sm text-gray-500">
          Configure default settings for AI-powered search and retrieval
        </p>
      </div>

      {/* RAG Source Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5" />
          Default RAG Source Settings
        </h3>
        <RAGSourceSelector
          settings={ragSettings}
          onChange={setRagSettings}
          documentCount={documentCount}
          hasProcessedDocuments={hasProcessedDocuments}
        />
      </div>

      {/* Advanced Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h3>
        <div className="space-y-6">
          {/* Max Document Chunks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Document Chunks: {ragSettings.maxDocumentChunks}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={ragSettings.maxDocumentChunks || 5}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  maxDocumentChunks: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of document chunks to retrieve per query
            </p>
          </div>

          {/* Min Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Relevance Score: {(ragSettings.minScore || 0.7).toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={ragSettings.minScore || 0.7}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  minScore: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.00</span>
              <span>1.00</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Minimum similarity score for document chunks (higher = more relevant)
            </p>
          </div>

          {/* Max Web Results */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Web Results: {ragSettings.maxWebResults}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={ragSettings.maxWebResults || 5}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  maxWebResults: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of web search results to include per query
            </p>
          </div>
        </div>
      </div>

      {/* Default Topic Filter */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Topic Filter</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="defaultTopic"
              checked={defaultTopicId === null}
              onChange={() => setDefaultTopicId(null)}
              className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">No Default Topic</div>
              <div className="text-xs text-gray-500">Search across all topics</div>
            </div>
          </label>
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading topics...</div>
          ) : (
            availableTopics.map((topic) => (
              <label
                key={topic.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="defaultTopic"
                  checked={defaultTopicId === topic.id}
                  onChange={() => setDefaultTopicId(topic.id)}
                  className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                  {topic.description && (
                    <div className="text-xs text-gray-500">{topic.description}</div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={handleReset}>
          <RotateCw className="w-4 h-4 mr-2" />
          Reset to Defaults
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
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
