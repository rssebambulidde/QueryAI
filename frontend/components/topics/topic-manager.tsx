'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { topicApi, Topic } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TopicManagerProps {
  onTopicSelect?: (topic: Topic | null) => void;
  selectedTopicId?: string | null;
}

export const TopicManager: React.FC<TopicManagerProps> = ({
  onTopicSelect,
  selectedTopicId,
}) => {
  const { isMobile } = useMobile();
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
        setFormData({ name: '', description: '', suggestedStarters: '', strict: true });
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

      {/* Create/Edit Form - Full-screen modal on mobile */}
      {(showCreateForm || editingTopic) && (
        <>
          {/* Backdrop for mobile */}
          {isMobile && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={editingTopic ? cancelEdit : cancelCreate}
            />
          )}
          
          <div className={cn(
            "bg-gray-50 border border-gray-200 rounded-lg space-y-3",
            isMobile
              ? "fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto p-4 rounded-t-2xl shadow-2xl"
              : "p-4"
          )}
          style={isMobile ? {
            marginBottom: 'env(safe-area-inset-bottom, 0)',
          } : {}}
          >
            <div className="flex items-center justify-between">
              <h4 className={cn(
                "font-medium text-gray-900",
                isMobile ? "text-base" : ""
              )}>
                {editingTopic ? 'Edit Topic' : 'Create New Topic'}
              </h4>
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={editingTopic ? cancelEdit : cancelCreate}
                className={cn(
                  "touch-manipulation",
                  isMobile ? "min-w-[44px] min-h-[44px]" : ""
                )}
              >
                <X className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
              </Button>
            </div>
            <Input
              placeholder="Topic name (e.g., Bank of Uganda, Politics in Uganda)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={cn(isMobile && "min-h-[44px] text-base")}
            />
            <Textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className={cn(isMobile && "min-h-[44px] text-base")}
            />
            <label className={cn(
              "flex items-center gap-2 cursor-pointer touch-manipulation",
              isMobile ? "text-base min-h-[44px]" : "text-sm"
            )}>
              <input
                type="checkbox"
                checked={formData.strict}
                onChange={(e) => setFormData({ ...formData, strict: e.target.checked })}
                className={cn(
                  "rounded border-gray-300",
                  isMobile ? "w-5 h-5" : ""
                )}
              />
              Research mode only (refuse off-topic questions)
            </label>
            <div>
              <label className={cn(
                "text-gray-600",
                isMobile ? "text-base mb-2 block" : "text-sm"
              )}>
                Suggested starter questions (one per line, optional)
              </label>
              <Textarea
                placeholder="e.g. What are the key concepts?&#10;How does X work in practice?"
                value={formData.suggestedStarters}
                onChange={(e) => setFormData({ ...formData, suggestedStarters: e.target.value })}
                rows={2}
                className={cn(
                  "mt-1",
                  isMobile && "min-h-[44px] text-base"
                )}
              />
            </div>
            <div className={cn(
              "flex gap-2",
              isMobile ? "flex-col" : ""
            )}>
              <Button
                onClick={editingTopic ? handleUpdate : handleCreate}
                size={isMobile ? "default" : "sm"}
                className={cn(
                  "flex items-center gap-2 touch-manipulation min-h-[44px]",
                  isMobile ? "w-full" : ""
                )}
              >
                <Save className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                {editingTopic ? 'Update' : 'Create'}
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={editingTopic ? cancelEdit : cancelCreate}
                className={cn(
                  "touch-manipulation min-h-[44px]",
                  isMobile ? "w-full" : ""
                )}
              >
                Cancel
              </Button>
            </div>
          </div>
        </>
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
        <div className={cn(
          "space-y-2 overflow-y-auto",
          isMobile ? "max-h-[60vh]" : ""
        )}>
          {topics.map((topic) => (
            <div
              key={topic.id}
              className={cn(
                "flex items-center justify-between rounded-lg border transition-colors touch-manipulation",
                isMobile ? "p-4 min-h-[60px]" : "p-3",
                selectedTopicId === topic.id
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <div
                className="flex-1 cursor-pointer min-h-[44px] flex items-center"
                onClick={() => handleSelect(topic)}
              >
                <div>
                  <div className={cn(
                    "font-medium text-gray-900",
                    isMobile ? "text-base" : ""
                  )}>
                    {topic.name}
                  </div>
                  {topic.description && (
                    <div className={cn(
                      "text-gray-500 mt-1",
                      isMobile ? "text-sm" : "text-sm"
                    )}>
                      {topic.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(topic)}
                  className={cn(
                    "p-0 touch-manipulation",
                    isMobile ? "h-11 w-11" : "h-8 w-8"
                  )}
                >
                  <Edit2 className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(topic)}
                  className={cn(
                    "p-0 text-red-600 hover:text-red-700 touch-manipulation",
                    isMobile ? "h-11 w-11" : "h-8 w-8"
                  )}
                >
                  <Trash2 className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
