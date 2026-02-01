'use client';

import React, { useState, useEffect } from 'react';
import { collectionApi, Collection } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Folder, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/lib/hooks/use-mobile';

interface SaveToCollectionDialogProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const SaveToCollectionDialog: React.FC<SaveToCollectionDialogProps> = ({
  conversationId,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const response = await collectionApi.list();
      if (response.success && response.data) {
        setCollections(response.data);
        // Load which collections this conversation is already in
        const conversationCollections = new Set<string>();
        await Promise.all(
          response.data.map(async (collection) => {
            const detailResponse = await collectionApi.get(collection.id);
            if (detailResponse.success && detailResponse.data) {
              const hasConversation = detailResponse.data.conversations?.some(
                (c) => c.id === conversationId
              );
              if (hasConversation) {
                conversationCollections.add(collection.id);
              }
            }
          })
        );
        setSelectedCollections(conversationCollections);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCollection = (collectionId: string) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelectedCollections(newSelected);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Get current collections for this conversation
      const currentCollections = new Set<string>();
      await Promise.all(
        collections.map(async (collection) => {
          const detailResponse = await collectionApi.get(collection.id);
          if (detailResponse.success && detailResponse.data) {
            const hasConversation = detailResponse.data.conversations?.some(
              (c) => c.id === conversationId
            );
            if (hasConversation) {
              currentCollections.add(collection.id);
            }
          }
        })
      );

      // Add to new collections
      const toAdd = Array.from(selectedCollections).filter((id) => !currentCollections.has(id));
      await Promise.all(
        toAdd.map((collectionId) =>
          collectionApi.addConversation(collectionId, conversationId)
        )
      );

      // Remove from collections that were deselected
      const toRemove = Array.from(currentCollections).filter(
        (id) => !selectedCollections.has(id)
      );
      await Promise.all(
        toRemove.map((collectionId) =>
          collectionApi.removeConversation(collectionId, conversationId)
        )
      );

      toast.success('Conversation saved to collections');
      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save to collections');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className={cn(
        "bg-white shadow-xl w-full flex flex-col",
        isMobile
          ? "h-full rounded-none"
          : "rounded-lg max-w-md mx-4 max-h-[80vh]"
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
            Save to Collection
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

        {/* Content */}
        <div className={cn(
          "flex-1 overflow-y-auto min-h-0",
          isMobile ? "p-4" : "p-4"
        )}>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading collections...</div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No collections yet</p>
              <Button
                onClick={() => {
                  onClose();
                  // Navigate to collections tab - this would need to be handled by parent
                  window.location.hash = '#collections';
                }}
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Collection
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((collection) => {
                const isSelected = selectedCollections.has(collection.id);
                return (
                  <button
                    key={collection.id}
                    onClick={() => handleToggleCollection(collection.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border transition-all text-left touch-manipulation',
                      isMobile ? "p-4 min-h-[60px]" : "p-3",
                      isSelected
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg flex items-center justify-center flex-shrink-0",
                        isMobile ? "w-10 h-10" : "w-8 h-8"
                      )}
                      style={{ backgroundColor: collection.color || '#f97316' }}
                    >
                      {isSelected ? (
                        <Check className={cn(isMobile ? "w-5 h-5" : "w-4 h-4", "text-white")} />
                      ) : (
                        <Folder className={cn(isMobile ? "w-5 h-5" : "w-4 h-4", "text-white")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-gray-900",
                        isMobile ? "text-base" : ""
                      )}>
                        {collection.name}
                      </p>
                      {collection.description && (
                        <p className={cn(
                          "text-gray-500 truncate",
                          isMobile ? "text-sm mt-1" : "text-sm"
                        )}>
                          {collection.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "flex items-center gap-2 border-t border-gray-200 flex-shrink-0",
          isMobile ? "flex-col p-4" : "justify-end p-4"
        )}>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isSaving}
            className={cn(
              "touch-manipulation min-h-[44px]",
              isMobile ? "w-full" : ""
            )}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={cn(
              "bg-orange-600 hover:bg-orange-700 touch-manipulation min-h-[44px]",
              isMobile ? "w-full" : ""
            )}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
