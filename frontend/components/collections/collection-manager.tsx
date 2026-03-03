'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collectionApi, Collection, CreateCollectionInput, conversationApi, Conversation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, Folder, Search, X, MessageSquare, FolderPlus } from 'lucide-react';
import { AddConversationsToCollectionDialog } from './add-conversations-to-collection-dialog';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useMobileNavStore } from '@/lib/store/mobile-nav-store';
import { useMobile } from '@/lib/hooks/use-mobile';

interface CollectionManagerProps {
  onConversationSelect?: (conversationId: string) => void;
}

export const CollectionManager: React.FC<CollectionManagerProps> = ({ onConversationSelect }) => {
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [collectionSearchResults, setCollectionSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddConversationsDialog, setShowAddConversationsDialog] = useState(false);

  const setNavVisible = useMobileNavStore((state) => state.setNavVisible);
  const lastScrollYRef = useRef(0);

  // Form state
  const [formData, setFormData] = useState<CreateCollectionInput>({
    name: '',
    description: '',
    color: '#f97316',
  });

  // Load collections on mount
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const response = await collectionApi.list();
      if (response.success && response.data) {
        setCollections(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Collection name is required');
      return;
    }

    try {
      setIsCreating(true);
      const response = await collectionApi.create(formData);
      if (response.success && response.data) {
        toast.success('Collection created successfully');
        setFormData({ name: '', description: '', color: '#f97316' });
        await loadCollections();
      } else {
        // API returned but without success/data
        toast.error(response.message || 'Failed to create collection. Please try again.');
      }
    } catch (error: any) {
      const code = error.response?.data?.error?.code;
      let errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create collection';

      // Provide helpful message for migration errors
      if (errorMessage.includes('MIGRATION_REQUIRED') || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        errorMessage = 'Collections feature requires database migration. Please contact support or check migration guide.';
      }

      if (code === 'COLLECTION_LIMIT_EXCEEDED') {
        toast.warning(errorMessage);
      } else {
        toast.error(errorMessage);
      }
      console.error('Collection creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) {
      toast.error('Collection name is required');
      return;
    }

    try {
      const response = await collectionApi.update(id, formData);
      if (response.success && response.data) {
        toast.success('Collection updated successfully');
        setEditingId(null);
        setFormData({ name: '', description: '', color: '#f97316' });
        await loadCollections();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to update collection';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collection? Conversations will not be deleted, only removed from the collection.')) {
      return;
    }

    try {
      const response = await collectionApi.delete(id);
      if (response.success) {
        toast.success('Collection deleted successfully');
        if (selectedCollection?.id === id) {
          setSelectedCollection(null);
        }
        await loadCollections();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to delete collection';
      toast.error(errorMessage);
    }
  };

  const startEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setFormData({
      name: collection.name,
      description: collection.description || '',
      color: collection.color || '#f97316',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', color: '#f97316' });
  };

  const handleViewCollection = async (collection: Collection) => {
    try {
      const response = await collectionApi.get(collection.id);
      if (response.success && response.data) {
        setSelectedCollection(response.data);
        setCollectionSearchQuery('');
        setCollectionSearchResults([]);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load collection details');
    }
  };

  const handleSearchCollection = async (query: string) => {
    if (!selectedCollection || !query.trim()) {
      setCollectionSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await collectionApi.search(selectedCollection.id, query.trim());
      if (response.success && response.data) {
        setCollectionSearchResults(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to search collection');
      setCollectionSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isMobile) return;

    const currentScrollY = e.currentTarget.scrollTop;
    const distanceFromBottom = e.currentTarget.scrollHeight - currentScrollY - e.currentTarget.clientHeight;
    const diff = currentScrollY - lastScrollYRef.current;

    if (diff > 5 && currentScrollY > 50) {
      setNavVisible(false);
    } else if (diff < -5) {
      setNavVisible(true);
    }

    // Show nav if near extremes
    if (distanceFromBottom < 20 || currentScrollY < 20) {
      setNavVisible(true);
    }

    lastScrollYRef.current = currentScrollY;
  };

  const predefinedColors = [
    '#f97316', // Orange
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#ef4444', // Red
  ];

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col pt-4 overflow-y-auto" onScroll={handleScroll}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Collections</h1>
        <p className="text-gray-600">Organize your conversations into collections for better management</p>
      </div>

      <div className={cn(
        "grid gap-6",
        isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"
      )}>
        {/* Left Panel: Collections List */}
        <div className={cn(isMobile ? "" : "lg:col-span-2")}>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
                isMobile ? "w-5 h-5" : "w-4 h-4"
              )} />
              <Input
                type="text"
                placeholder="Search collections..."
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

          {/* Create/Edit Form */}
          <div className={cn(
            "bg-white rounded-lg border border-gray-200 mb-4",
            isMobile ? "p-4" : "p-4"
          )}>
            <h2 className={cn(
              "font-semibold text-gray-900 mb-4",
              isMobile ? "text-base" : "text-lg"
            )}>
              {editingId ? 'Edit Collection' : 'Create New Collection'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className={cn(
                  "block font-medium text-gray-700 mb-1",
                  isMobile ? "text-sm" : "text-sm"
                )}>
                  Name *
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Collection name"
                  disabled={isCreating}
                  className={cn(isMobile && "min-h-[44px] text-base")}
                />
              </div>
              <div>
                <label className={cn(
                  "block font-medium text-gray-700 mb-1",
                  isMobile ? "text-sm" : "text-sm"
                )}>
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                  disabled={isCreating}
                  className={cn(isMobile && "min-h-[44px] text-base")}
                />
              </div>
              <div>
                <label className={cn(
                  "block font-medium text-gray-700 mb-2",
                  isMobile ? "text-sm" : "text-sm"
                )}>
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={cn(
                        'rounded-full border-2 transition-all touch-manipulation',
                        isMobile ? "w-10 h-10" : "w-8 h-8",
                        formData.color === color
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className={cn(
                "flex gap-2",
                isMobile ? "flex-col" : ""
              )}>
                {editingId ? (
                  <>
                    <Button
                      onClick={() => handleUpdate(editingId)}
                      disabled={isCreating}
                      className={cn(
                        "touch-manipulation min-h-[44px]",
                        isMobile ? "w-full" : "flex-1"
                      )}
                    >
                      Update Collection
                    </Button>
                    <Button
                      onClick={cancelEdit}
                      variant="outline"
                      disabled={isCreating}
                      className={cn(
                        "touch-manipulation min-h-[44px]",
                        isMobile ? "w-full" : ""
                      )}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating || !formData.name.trim()}
                    isLoading={isCreating}
                    className={cn(
                      "touch-manipulation min-h-[44px]",
                      isMobile ? "w-full" : "flex-1"
                    )}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isCreating ? 'Creating...' : 'Create Collection'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Collections List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading collections...</div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery ? 'No collections found' : 'No collections yet. Create your first collection!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCollections.map((collection) => (
                <div
                  key={collection.id}
                  className={cn(
                    'bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer',
                    selectedCollection?.id === collection.id && 'border-orange-300 shadow-md'
                  )}
                  onClick={() => handleViewCollection(collection)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: collection.color || '#f97316' }}
                      >
                        <Folder className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{collection.name}</h3>
                        {collection.description && (
                          <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {collection.conversation_count || 0} conversations
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(collection)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(collection.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Collection Details */}
        {selectedCollection && (
          <div className={cn(
            isMobile ? "fixed inset-0 z-50 bg-white overflow-y-auto" : "lg:col-span-1"
          )}>
            <div className={cn(
              "bg-white rounded-lg border border-gray-200",
              isMobile ? "min-h-full p-4" : "p-4 sticky top-4"
            )}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn(
                  "font-semibold text-gray-900",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  Collection Details
                </h2>
                <button
                  onClick={() => setSelectedCollection(null)}
                  className={cn(
                    "text-gray-400 hover:text-gray-600 touch-manipulation",
                    isMobile ? "min-w-[44px] min-h-[44px] flex items-center justify-center" : ""
                  )}
                >
                  <X className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: selectedCollection.color || '#f97316' }}
                  >
                    <Folder className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{selectedCollection.name}</h3>
                  {selectedCollection.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedCollection.description}</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Conversations ({selectedCollection.conversation_count || 0})
                    </p>
                    <Button
                      size={isMobile ? "md" : "sm"}
                      variant="outline"
                      onClick={() => {
                        setShowAddConversationsDialog(true);
                      }}
                      className={cn(
                        "touch-manipulation",
                        isMobile ? "h-11 text-sm" : "h-7 text-xs"
                      )}
                    >
                      <FolderPlus className={cn(isMobile ? "w-4 h-4" : "w-3 h-3", "mr-1")} />
                      Add Conversations
                    </Button>
                  </div>

                  {/* Search within collection */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search conversations..."
                        value={collectionSearchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCollectionSearchQuery(value);
                          if (value.trim()) {
                            handleSearchCollection(value);
                          } else {
                            setCollectionSearchResults([]);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchCollection(collectionSearchQuery);
                          }
                        }}
                        className="pl-7 pr-7 h-8 text-xs"
                      />
                      {collectionSearchQuery && (
                        <button
                          onClick={() => {
                            setCollectionSearchQuery('');
                            setCollectionSearchResults([]);
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Conversations List */}
                  {isSearching ? (
                    <div className={cn(
                      "text-center py-4 text-gray-500",
                      isMobile ? "text-base" : "text-sm"
                    )}>
                      Searching...
                    </div>
                  ) : collectionSearchQuery && collectionSearchResults.length > 0 ? (
                    <div className={cn(
                      "space-y-2 overflow-y-auto",
                      isMobile ? "max-h-[50vh]" : "max-h-96"
                    )}>
                      <p className={cn(
                        "text-gray-500 mb-2",
                        isMobile ? "text-sm" : "text-xs"
                      )}>
                        Found {collectionSearchResults.length} conversation(s)
                      </p>
                      {collectionSearchResults.map((conversation) => (
                        <div
                          key={conversation.id}
                          onClick={() => {
                            if (onConversationSelect) {
                              onConversationSelect(conversation.id);
                            }
                          }}
                          className={cn(
                            "bg-gray-50 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors touch-manipulation",
                            isMobile ? "p-3 text-base min-h-[60px]" : "p-2 text-sm",
                            onConversationSelect && "hover:shadow-sm"
                          )}
                        >
                          <p className="font-medium text-gray-900">
                            {conversation.title || 'Untitled Conversation'}
                          </p>
                          <p className={cn(
                            "text-gray-500 mt-1",
                            isMobile ? "text-sm" : "text-xs"
                          )}>
                            {new Date(conversation.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : selectedCollection.conversations && selectedCollection.conversations.length > 0 ? (
                    <div className={cn(
                      "space-y-2 overflow-y-auto",
                      isMobile ? "max-h-[50vh]" : "max-h-96"
                    )}>
                      {selectedCollection.conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          onClick={() => {
                            if (onConversationSelect) {
                              onConversationSelect(conversation.id);
                            }
                          }}
                          className={cn(
                            "bg-gray-50 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors touch-manipulation",
                            isMobile ? "p-3 text-base min-h-[60px]" : "p-2 text-sm",
                            onConversationSelect && "hover:shadow-sm"
                          )}
                        >
                          <p className="font-medium text-gray-900">
                            {conversation.title || 'Untitled Conversation'}
                          </p>
                          <p className={cn(
                            "text-gray-500 mt-1",
                            isMobile ? "text-sm" : "text-xs"
                          )}>
                            {new Date(conversation.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={cn(
                      "text-gray-500",
                      isMobile ? "text-base" : "text-sm"
                    )}>
                      {collectionSearchQuery ? 'No conversations found' : 'No conversations in this collection yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Conversations Dialog */}
        {selectedCollection && (
          <AddConversationsToCollectionDialog
            collectionId={selectedCollection.id}
            isOpen={showAddConversationsDialog}
            onClose={() => {
              setShowAddConversationsDialog(false);
            }}
            onAdded={async () => {
              // Reload collection to show updated conversations
              await handleViewCollection(selectedCollection);
            }}
          />
        )}
      </div>
    </div>
  );
};
