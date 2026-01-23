'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { topicApi, Topic } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

interface TopicManagerProps {
  onTopicSelect?: (topic: Topic | null) => void;
  selectedTopicId?: string | null;
}

export const TopicManager: React.FC<TopicManagerProps> = ({
  onTopicSelect,
  selectedTopicId,
}) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    suggestedStarters: '',
    strict: true,
  });

  // Load topics
  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setIsLoading(true);
    try {
      const response = await topicApi.list();
      if (response.success && response.data) {
        setTopics(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load topics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Topic name is required');
      return;
    }

    try {
      const suggested_starters = formData.suggestedStarters
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const response = await topicApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        scopeConfig: { suggested_starters, strict: formData.strict },
      });

      if (response.success && response.data) {
        toast.success('Topic created successfully');
        setFormData({ name: '', description: '', suggestedStarters: '', strict: true });
        setShowCreateForm(false);
        loadTopics();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create topic');
    }
  };

  const handleUpdate = async () => {
    if (!editingTopic) return;
    if (!formData.name.trim()) {
      toast.error('Topic name is required');
      return;
    }

    try {
      const suggested_starters = formData.suggestedStarters
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const scopeConfig = {
        ...(editingTopic.scope_config || {}),
        suggested_starters,
        strict: formData.strict,
      };
      const response = await topicApi.update(editingTopic.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        scopeConfig,
      });

      if (response.success && response.data) {
        toast.success('Topic updated successfully');
        setEditingTopic(null);
        setFormData({ name: '', description: '' });
        loadTopics();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update topic');
    }
  };

  const handleDelete = async (topic: Topic) => {
    if (!confirm(`Are you sure you want to delete "${topic.name}"?`)) {
      return;
    }

    try {
      const response = await topicApi.delete(topic.id);
      if (response.success) {
        toast.success('Topic deleted successfully');
        loadTopics();
        // If deleted topic was selected, clear selection
        if (selectedTopicId === topic.id && onTopicSelect) {
          onTopicSelect(null);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete topic');
    }
  };

  const handleEdit = (topic: Topic) => {
    setEditingTopic(topic);
    const sc = topic.scope_config || {};
    const starters = Array.isArray(sc.suggested_starters) ? sc.suggested_starters : [];
    setFormData({
      name: topic.name,
      description: topic.description || '',
      suggestedStarters: starters.join('\n'),
      strict: sc.strict !== false,
    });
    setShowCreateForm(false);
  };

  const handleSelect = (topic: Topic) => {
    if (onTopicSelect) {
      onTopicSelect(topic);
    }
  };

  const cancelEdit = () => {
    setEditingTopic(null);
    setFormData({ name: '', description: '', suggestedStarters: '', strict: true });
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setFormData({ name: '', description: '', suggestedStarters: '', strict: true });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Topics</h3>
        <Button
          onClick={() => {
            setShowCreateForm(true);
            setEditingTopic(null);
            setFormData({ name: '', description: '', suggestedStarters: '', strict: true });
          }}
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Topic
        </Button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingTopic) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              {editingTopic ? 'Edit Topic' : 'Create New Topic'}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={editingTopic ? cancelEdit : cancelCreate}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input
            placeholder="Topic name (e.g., Bank of Uganda, Politics in Uganda)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.strict}
              onChange={(e) => setFormData({ ...formData, strict: e.target.checked })}
              className="rounded border-gray-300"
            />
            Research mode only (refuse off-topic questions)
          </label>
          <div>
            <label className="text-sm text-gray-600">Suggested starter questions (one per line, optional)</label>
            <Textarea
              placeholder="e.g. What are the key concepts?&#10;How does X work in practice?"
              value={formData.suggestedStarters}
              onChange={(e) => setFormData({ ...formData, suggestedStarters: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={editingTopic ? handleUpdate : handleCreate}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editingTopic ? 'Update' : 'Create'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={editingTopic ? cancelEdit : cancelCreate}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Topics List */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Loading topics...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No topics yet. Create one to get started!</p>
          <p className="text-sm mt-2">Topics help scope your AI queries to specific domains.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                selectedTopicId === topic.id
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => handleSelect(topic)}
              >
                <div className="font-medium text-gray-900">{topic.name}</div>
                {topic.description && (
                  <div className="text-sm text-gray-500 mt-1">{topic.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(topic)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(topic)}
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
