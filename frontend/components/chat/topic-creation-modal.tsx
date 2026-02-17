'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Topic, topicApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

interface TopicCreationModalProps {
  /** Controls visibility */
  isOpen: boolean;
  /** Pre-fill the topic name (e.g. from keyword) */
  initialName?: string;
  disabled?: boolean;
  onClose: () => void;
  /** Called after a topic is successfully created */
  onCreated: (topic: Topic) => void;
}

export const TopicCreationModal: React.FC<TopicCreationModalProps> = ({
  isOpen,
  initialName = '',
  disabled = false,
  onClose,
  onCreated,
}) => {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');

  // Keep name in sync with initialName changes
  React.useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Topic name is required');
      return;
    }
    try {
      const response = await topicApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (response.success && response.data) {
        toast.success('Topic created successfully');
        onCreated(response.data);
        setName('');
        setDescription('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create topic');
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-900">Create New Topic</span>
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-3 h-3" />
        </button>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Topic name (e.g., Bank of Uganda)"
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-400"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        disabled={disabled}
        rows={2}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={disabled || !name.trim()}
          className="flex-1 px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create
        </button>
        <button
          onClick={handleClose}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
