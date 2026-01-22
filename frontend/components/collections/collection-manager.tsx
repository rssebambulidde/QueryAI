'use client';

import React, { useState, useEffect } from 'react';
import { collectionApi, Collection, CreateCollectionInput } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, Folder, Search, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CollectionManager: React.FC = () => {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

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
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create collection';
      toast.error(errorMessage);
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

  const handleSearchCollection = async () => {
    if (!selectedCollection || !collectionSearchQuery.trim()) {
      setCollectionSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await collectionApi.search(selectedCollection.id, collectionSearchQuery.trim());
      if (response.success && response.data) {
        setCollectionSearchResults(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to search collection');
    } finally {
      setIsSearching(false);
    }
  };

  const filteredCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Collections</h1>
        <p className="text-gray-600">Organize your conversations into collections for better management</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Collections List */}
        <div className="lg:col-span-2">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Create/Edit Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Collection' : 'Create New Collection'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Collection name"
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        formData.color === color
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {editingId ? (
                  <>
                    <Button
                      onClick={() => handleUpdate(editingId)}
                      disabled={isCreating}
                      className="flex-1"
                    >
                      Update Collection
                    </Button>
                    <Button
                      onClick={cancelEdit}
                      variant="outline"
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating || !formData.name.trim()}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Collection
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
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Collection Details</h2>
                <button
                  onClick={() => setSelectedCollection(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
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
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Conversations ({selectedCollection.conversation_count || 0})
                  </p>
                  
                  {/* Search within collection */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search conversations..."
                        value={collectionSearchQuery}
                        onChange={(e) => {
                          setCollectionSearchQuery(e.target.value);
                          if (e.target.value.trim()) {
                            handleSearchCollection();
                          } else {
                            setCollectionSearchResults([]);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchCollection();
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
                    <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
                  ) : collectionSearchQuery && collectionSearchResults.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <p className="text-xs text-gray-500 mb-2">
                        Found {collectionSearchResults.length} conversation(s)
                      </p>
                      {collectionSearchResults.map((conversation) => (
                        <div
                          key={conversation.id}
                          className="p-2 bg-gray-50 rounded border border-gray-200 text-sm"
                        >
                          <p className="font-medium text-gray-900">
                            {conversation.title || 'Untitled Conversation'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(conversation.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : selectedCollection.conversations && selectedCollection.conversations.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedCollection.conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className="p-2 bg-gray-50 rounded border border-gray-200 text-sm"
                        >
                          <p className="font-medium text-gray-900">
                            {conversation.title || 'Untitled Conversation'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(conversation.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {collectionSearchQuery ? 'No conversations found' : 'No conversations in this collection yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
