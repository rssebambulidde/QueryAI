'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { embeddingApi, EmbeddingConfig, topicApi, Topic } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Edit2, Trash2, X, Save, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';

export const EmbeddingManager: React.FC = () => {
  const [embeddings, setEmbeddings] = useState<EmbeddingConfig[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEmbedding, setEditingEmbedding] = useState<EmbeddingConfig | null>(null);
  const [showEmbedCode, setShowEmbedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    topicId: '',
    customization: {
      primaryColor: '#f97316',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      greetingMessage: 'Hello! How can I help you today?',
      showBranding: true,
    },
  });

  // Load data
  useEffect(() => {
    loadEmbeddings();
    loadTopics();
  }, []);

  const loadEmbeddings = async () => {
    setIsLoading(true);
    try {
      const response = await embeddingApi.list();
      if (response.success && response.data) {
        setEmbeddings(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load embeddings');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Configuration name is required');
      return;
    }

    if (!formData.topicId) {
      toast.error('Topic is required');
      return;
    }

    try {
      const response = await embeddingApi.create({
        name: formData.name.trim(),
        topicId: formData.topicId,
        customization: formData.customization,
      });

      if (response.success && response.data) {
        toast.success('Embedding configuration created successfully');
        setFormData({
          name: '',
          topicId: '',
          customization: {
            primaryColor: '#f97316',
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            greetingMessage: 'Hello! How can I help you today?',
            showBranding: true,
          },
        });
        setShowCreateForm(false);
        loadEmbeddings();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create embedding configuration');
    }
  };

  const handleUpdate = async () => {
    if (!editingEmbedding) return;
    if (!formData.name.trim()) {
      toast.error('Configuration name is required');
      return;
    }

    try {
      const response = await embeddingApi.update(editingEmbedding.id, {
        name: formData.name.trim(),
        customization: formData.customization,
      });

      if (response.success && response.data) {
        toast.success('Embedding configuration updated successfully');
        setEditingEmbedding(null);
        setFormData({
          name: '',
          topicId: '',
          customization: {
            primaryColor: '#f97316',
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            greetingMessage: 'Hello! How can I help you today?',
            showBranding: true,
          },
        });
        loadEmbeddings();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update embedding configuration');
    }
  };

  const handleDelete = async (embedding: EmbeddingConfig) => {
    if (!confirm(`Are you sure you want to delete "${embedding.name}"?`)) {
      return;
    }

    try {
      const response = await embeddingApi.delete(embedding.id);
      if (response.success) {
        toast.success('Embedding configuration deleted successfully');
        loadEmbeddings();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete embedding configuration');
    }
  };

  const handleToggleActive = async (embedding: EmbeddingConfig) => {
    try {
      const response = await embeddingApi.update(embedding.id, {
        isActive: !embedding.is_active,
      });
      if (response.success) {
        toast.success(`Embedding ${!embedding.is_active ? 'activated' : 'deactivated'}`);
        loadEmbeddings();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update embedding configuration');
    }
  };

  const handleEdit = (embedding: EmbeddingConfig) => {
    setEditingEmbedding(embedding);
    const defaultCustomization = {
      primaryColor: '#f97316',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      greetingMessage: 'Hello! How can I help you today?',
      showBranding: true,
    };
    
    // Safely extract customization with type checking
    let customization = defaultCustomization;
    if (embedding.customization) {
      const custom = embedding.customization as any;
      customization = {
        primaryColor: custom.primaryColor || defaultCustomization.primaryColor,
        backgroundColor: custom.backgroundColor || defaultCustomization.backgroundColor,
        textColor: custom.textColor || defaultCustomization.textColor,
        greetingMessage: custom.greetingMessage || defaultCustomization.greetingMessage,
        showBranding: custom.showBranding !== undefined ? custom.showBranding : defaultCustomization.showBranding,
      };
    }
    
    setFormData({
      name: embedding.name,
      topicId: embedding.topic_id,
      customization,
    });
    setShowCreateForm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getEmbedUrl = (configId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `${apiUrl}/api/embed/${configId}`;
  };

  const getEmbedCode = (configId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return `<iframe src="${getEmbedUrl(configId)}" width="100%" height="600" frameborder="0"></iframe>`;
  };

  const getTopicName = (topicId: string) => {
    const topic = topics.find((t) => t.id === topicId);
    return topic ? topic.name : 'Unknown topic';
  };

  const cancelEdit = () => {
    setEditingEmbedding(null);
    setFormData({
      name: '',
      topicId: '',
      customization: {
        primaryColor: '#f97316',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        greetingMessage: 'Hello! How can I help you today?',
        showBranding: true,
      },
    });
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setFormData({
      name: '',
      topicId: '',
      customization: {
        primaryColor: '#f97316',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        greetingMessage: 'Hello! How can I help you today?',
        showBranding: true,
      },
    });
    setShowEmbedCode(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Embeddable Chatbots</h3>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage embeddable chatbot widgets for your websites
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreateForm(true);
            setEditingEmbedding(null);
            setFormData({
              name: '',
              topicId: '',
              customization: {
                primaryColor: '#f97316',
                backgroundColor: '#ffffff',
                textColor: '#1f2937',
                greetingMessage: 'Hello! How can I help you today?',
                showBranding: true,
              },
            });
          }}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Embedding
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingEmbedding) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              {editingEmbedding ? 'Edit Embedding Configuration' : 'Create New Embedding'}
            </h4>
            <Button variant="ghost" size="sm" onClick={editingEmbedding ? cancelEdit : cancelCreate}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input
            placeholder="Configuration name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
            <select
              value={formData.topicId}
              onChange={(e) => setFormData({ ...formData, topicId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              disabled={!!editingEmbedding}
            >
              <option value="">Select a topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
              <Input
                type="color"
                value={formData.customization.primaryColor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customization: { ...formData.customization, primaryColor: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
              <Input
                type="color"
                value={formData.customization.backgroundColor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customization: { ...formData.customization, backgroundColor: e.target.value },
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
            <Textarea
              value={formData.customization.greetingMessage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  customization: { ...formData.customization, greetingMessage: e.target.value },
                })
              }
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showBranding"
              checked={formData.customization.showBranding}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  customization: { ...formData.customization, showBranding: e.target.checked },
                })
              }
              className="rounded"
            />
            <label htmlFor="showBranding" className="text-sm text-gray-700">
              Show "Powered by QueryAI" branding
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={editingEmbedding ? handleUpdate : handleCreate}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editingEmbedding ? 'Update' : 'Create'}
            </Button>
            <Button variant="outline" size="sm" onClick={editingEmbedding ? cancelEdit : cancelCreate}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Embeddings List */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading embeddings...</div>
      ) : embeddings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No embedding configurations yet. Create one to get started!</p>
          <p className="text-sm mt-2">
            Embedding configurations allow you to deploy topic-scoped chatbots on your websites.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {embeddings.map((embedding) => (
            <div
              key={embedding.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                embedding.is_active
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{embedding.name}</span>
                  {!embedding.is_active && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Topic: {getTopicName(embedding.topic_id)}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => setShowEmbedCode(showEmbedCode === embedding.id ? null : embedding.id)}
                    className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {showEmbedCode === embedding.id ? 'Hide' : 'Show'} Embed Code
                  </button>
                  <a
                    href={getEmbedUrl(embedding.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </a>
                </div>
                {showEmbedCode === embedding.id && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">Embed Code (iframe):</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(getEmbedCode(embedding.id))}
                        className="flex items-center gap-1 h-6 text-xs"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                    <code className="block text-xs bg-white p-2 rounded border border-gray-300 font-mono break-all">
                      {getEmbedCode(embedding.id)}
                    </code>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Direct URL:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(getEmbedUrl(embedding.id))}
                        className="flex items-center gap-1 h-6 text-xs"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                    <code className="block text-xs bg-white p-2 rounded border border-gray-300 font-mono break-all mt-1">
                      {getEmbedUrl(embedding.id)}
                    </code>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(embedding)}
                  className="h-8 w-8 p-0"
                  title={embedding.is_active ? 'Deactivate' : 'Activate'}
                >
                  {embedding.is_active ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(embedding)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(embedding)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
