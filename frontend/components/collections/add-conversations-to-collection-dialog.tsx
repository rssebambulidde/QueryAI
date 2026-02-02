'use client';

import React, { useState, useEffect } from 'react';
import { conversationApi, Conversation, collectionApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, X, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

interface AddConversationsToCollectionDialogProps {
  collectionId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export const AddConversationsToCollectionDialog: React.FC<AddConversationsToCollectionDialogProps> = ({
  collectionId,
  isOpen,
  onClose,
  onAdded,
}) => {
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      loadCollectionConversations();
    }
  }, [isOpen, collectionId]);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const response = await conversationApi.list({ includeMetadata: true });
      if (response.success && response.data) {
        setConversations(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCollectionConversations = async () => {
    try {
      const response = await collectionApi.get(collectionId);
      if (response.success && response.data) {
        const existingIds = new Set(
          response.data.conversations?.map((c: Conversation) => c.id) || []
        );
        setSelectedConversations(existingIds);
      }
    } catch (error: any) {
      console.error('Failed to load collection conversations:', error);
    }
  };

  const handleToggleConversation = (conversationId: string) => {
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  const handleAdd = async () => {
    try {
      setIsAdding(true);

      // Get current conversations in collection
      const response = await collectionApi.get(collectionId);
      const currentIds = new Set(
        response.data?.conversations?.map((c: Conversation) => c.id) || []
      );

      // Add new conversations
      const toAdd = Array.from(selectedConversations).filter((id) => !currentIds.has(id));
      await Promise.all(
        toAdd.map((conversationId) =>
          collectionApi.addConversation(collectionId, conversationId)
        )
      );

      // Remove deselected conversations
      const toRemove = Array.from(currentIds).filter((id) => !selectedConversations.has(id));
      await Promise.all(
        toRemove.map((conversationId) =>
          collectionApi.removeConversation(collectionId, conversationId)
        )
      );

      toast.success('Conversations updated in collection');
      if (onAdded) {
        onAdded();
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update collection');
    } finally {
      setIsAdding(false);
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className={cn(
        "bg-white shadow-xl w-full flex flex-col",
        isMobile
          ? "h-full rounded-none"
          : "rounded-lg max-w-2xl mx-4 max-h-[80vh]"
      )}
      style={isMobile ? {
        marginTop: 'env(safe-area-inset-top, 0)',
        marginBottom: 'env(safe-area-inset-bottom, 0)'
      } : {}}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between border-b border-gray-200 flex-shrink-0",
          isMobile ? "p-4" : "p-4"
        )}>
          <h2 className={cn(
            "font-semibold text-gray-900",
            isMobile ? "text-base" : "text-lg"
          )}>
            Add Conversations
          </h2>
          <button
            onClick={onClose}
            className={cn(
              "text-gray-400 hover:text-gray-600 transition-colors touch-manipulation",
              isMobile ? "min-w-[44px] min-h-[44px] flex items-center justify-center" : ""
            )}
          >
            <X className={cn(isMobile ? "w-6 h-6" : "w-5 h-5")} />
          </button>
        </div>

        {/* Search */}
        <div className={cn(
          "border-b border-gray-200 flex-shrink-0",
          isMobile ? "p-4" : "p-4"
        )}>
          <div className="relative">
            <Search className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
              isMobile ? "w-5 h-5" : "w-4 h-4"
            )} />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-10 pr-10",
                isMobile ? "h-11 text-base" : ""
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={cn(
                  "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-manipulation",
                  isMobile ? "w-8 h-8 flex items-center justify-center" : ""
                )}
              >
                <X className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
              </button>
            )}
          </div>
        </div>

        {/* Content - scrollable so footer (Add to Collection) stays visible on iPhone 7 */}
        <div
          className={cn(
            "flex-1 overflow-y-auto min-h-0",
            isMobile ? "p-4" : "p-4"
          )}
          style={isMobile ? { maxHeight: 'calc(100% - 180px)' } : undefined}
        >
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conversation) => {
                const isSelected = selectedConversations.has(conversation.id);
                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleToggleConversation(conversation.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border transition-all text-left touch-manipulation',
                      isMobile ? "p-4 min-h-[60px]" : "p-3",
                      isSelected
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      'rounded-lg flex items-center justify-center flex-shrink-0',
                      isMobile ? "w-10 h-10" : "w-8 h-8",
                      isSelected ? 'bg-orange-600' : 'bg-gray-100'
                    )}>
                      {isSelected ? (
                        <Check className={cn(isMobile ? "w-5 h-5" : "w-4 h-4", "text-white")} />
                      ) : (
                        <MessageSquare className={cn(isMobile ? "w-5 h-5" : "w-4 h-4", "text-gray-600")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-gray-900",
                        isMobile ? "text-base" : ""
                      )}>
                        {conversation.title || 'Untitled Conversation'}
                      </p>
                      {conversation.lastMessage && (
                        <p className={cn(
                          "text-gray-500 truncate mt-1",
                          isMobile ? "text-sm" : "text-sm"
                        )}>
                          {conversation.lastMessage}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - always visible on small screens (iPhone 7) */}
        <div
          className={cn(
            "border-t border-gray-200 flex-shrink-0",
            isMobile ? "flex flex-col p-4 space-y-3" : "flex items-center justify-between p-4"
          )}
          style={isMobile ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0))', minHeight: 56 } : undefined}
        >
          <div className={cn(
            "text-gray-600",
            isMobile ? "text-base text-center" : "text-sm"
          )}>
            {selectedConversations.size} conversation{selectedConversations.size !== 1 ? 's' : ''} selected
          </div>
          <div className={cn(
            "flex items-center gap-2",
            isMobile ? "w-full flex-row flex-wrap justify-center" : ""
          )}>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isAdding}
              className={cn(
                "touch-manipulation min-h-[44px]",
                isMobile ? "w-full" : ""
              )}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isAdding || isLoading}
              className={cn(
                "bg-orange-600 hover:bg-orange-700 touch-manipulation min-h-[44px]",
                isMobile ? "w-full" : ""
              )}
            >
              {isAdding ? 'Adding...' : 'Add to Collection'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
