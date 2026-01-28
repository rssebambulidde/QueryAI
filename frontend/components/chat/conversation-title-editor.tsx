'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Check, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/hooks/use-toast';
import { conversationApi } from '@/lib/api';

interface ConversationTitleEditorProps {
  conversationId: string;
  currentTitle?: string;
  firstMessage?: string;
  onTitleChange?: (title: string) => void;
  className?: string;
  autoGenerate?: boolean;
}

export const ConversationTitleEditor: React.FC<ConversationTitleEditorProps> = ({
  conversationId,
  currentTitle,
  firstMessage,
  onTitleChange,
  className,
  autoGenerate = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(currentTitle || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setEditTitle(currentTitle || '');
  }, [currentTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Auto-generate title from first message if no title exists
  useEffect(() => {
    if (autoGenerate && !currentTitle && firstMessage && firstMessage.trim()) {
      generateTitleFromMessage(firstMessage);
    }
  }, [autoGenerate, currentTitle, firstMessage]);

  const generateTitleFromMessage = async (message: string) => {
    if (!message || message.trim().length === 0) return;

    setIsGenerating(true);
    try {
      // Generate a title from the first message (first 100 chars, truncated intelligently)
      const truncated = message.length > 100 
        ? message.slice(0, 100).replace(/\s+\S*$/, '') + '...'
        : message;
      
      // Use first sentence or first 50 chars
      const title = truncated.split(/[.!?]/)[0].trim().slice(0, 50) || truncated.slice(0, 50);
      
      if (title.length > 0) {
        await handleSave(title);
      }
    } catch (error: any) {
      console.error('Failed to auto-generate title:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const validateTitle = (title: string): { valid: boolean; error?: string } => {
    const trimmed = title.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'Title cannot be empty' };
    }
    
    if (trimmed.length > 200) {
      return { valid: false, error: 'Title must be 200 characters or less' };
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmed)) {
      return { valid: false, error: 'Title contains invalid characters' };
    }
    
    return { valid: true };
  };

  const handleSave = async (title?: string) => {
    const titleToSave = title || editTitle.trim();
    
    if (!titleToSave) {
      setIsEditing(false);
      setEditTitle(currentTitle || '');
      return;
    }

    const validation = validateTitle(titleToSave);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid title');
      return;
    }

    try {
      const response = await conversationApi.update(conversationId, { title: titleToSave });
      if (response.success) {
        setEditTitle(titleToSave);
        setIsEditing(false);
        onTitleChange?.(titleToSave);
        toast.success('Title updated');
      } else {
        throw new Error(response.message || 'Failed to update title');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update title');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(currentTitle || '');
  };

  const handleGenerate = async () => {
    if (!firstMessage) {
      toast.error('No message available to generate title from');
      return;
    }
    setIsGenerating(true);
    await generateTitleFromMessage(firstMessage);
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
          }}
          onBlur={() => {
            // Don't auto-save on blur, require explicit save
            // handleSave();
          }}
          className="h-8 text-sm"
          placeholder="Enter conversation title..."
          maxLength={200}
        />
        <button
          onClick={() => handleSave()}
          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Save title"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <span className="text-sm font-medium text-gray-900 truncate flex-1">
        {currentTitle || 'New Conversation'}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {firstMessage && !currentTitle && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
            title="Generate title from first message"
          >
            <Sparkles className={cn('w-4 h-4', isGenerating && 'animate-pulse')} />
          </button>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Edit title"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
