'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, Tag, Key, Bot, Folder, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Search, X, FolderOpen, BarChart3, CreditCard } from 'lucide-react';
import { SidebarTopicFilters } from './sidebar-topic-filters';
import { cn } from '@/lib/utils';
import { RAGSourceSelector, RAGSettings } from '@/components/chat/rag-source-selector';
import { useConversationStore } from '@/lib/store/conversation-store';
import { ConversationItem as ConversationItemComponent } from '@/components/chat/conversation-item';
import { SaveToCollectionDialog } from '@/components/collections/save-to-collection-dialog';
import { collectionApi, Collection } from '@/lib/api';
import { CollectionConversationsList } from './collection-conversations-list';
import { useToast } from '@/lib/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type TabType = 'chat' | 'documents' | 'topics' | 'api-keys' | 'embeddings' | 'collections' | 'analytics' | 'subscription';

interface AppSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  ragSettings: RAGSettings;
  onRagSettingsChange: (settings: RAGSettings) => void;
  documentCount: number;
  hasProcessedDocuments: boolean;
  subscriptionTier?: 'free' | 'premium' | 'pro';
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onTabChange,
  ragSettings,
  onRagSettingsChange,
  documentCount,
  hasProcessedDocuments,
  subscriptionTier = 'free',
}) => {
  // Debug: Log subscription tier (only in browser)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[AppSidebar] Subscription tier:', subscriptionTier);
      console.log('[AppSidebar] Should show analytics:', subscriptionTier === 'premium' || subscriptionTier === 'pro');
      // Also log to help debug Cloudflare deployment
      if (subscriptionTier === 'free') {
        console.warn('[AppSidebar] Analytics tab hidden - subscription tier is "free". Update to "premium" or "pro" in database.');
      }
    }
  }, [subscriptionTier]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSourceSelection, setShowSourceSelection] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedConversationForCollection, setSelectedConversationForCollection] = useState<string | null>(null);
  const [showCollections, setShowCollections] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [showTopicsFilters, setShowTopicsFilters] = useState(false);
  const { toast } = useToast();
  
  const {
    conversations,
    currentConversationId,
    isLoading,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useConversationStore();

  // Load conversations when chat tab is active
  useEffect(() => {
    if (activeTab === 'chat') {
      loadConversations().catch((error) => {
        console.error('Failed to load conversations:', error);
      });
    }
  }, [activeTab, loadConversations]);

  // Load collections when chat tab is active
  useEffect(() => {
    if (activeTab === 'chat') {
      loadCollections();
    }
  }, [activeTab]);

  const loadCollections = async () => {
    try {
      setIsLoadingCollections(true);
      const response = await collectionApi.list();
      if (response.success && response.data) {
        setCollections(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load collections:', error);
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const handleCollectionClick = async (collectionId: string) => {
    if (expandedCollectionId === collectionId) {
      setExpandedCollectionId(null);
    } else {
      setExpandedCollectionId(collectionId);
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewConversation = async () => {
    try {
      await createConversation();
      toast.success('New conversation created');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create conversation');
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      try {
        await deleteConversation(id);
        toast.success('Conversation deleted');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete conversation');
      }
    }
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Collapsed sidebar
  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full bg-white border-r border-gray-200 w-12 flex-shrink-0">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 hover:bg-gray-50 border-b border-gray-200 flex items-center justify-center"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <button
            onClick={() => onTabChange('chat')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              activeTab === 'chat'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title="Query Assistant"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => onTabChange('documents')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              activeTab === 'documents'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title="Your Documents"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={() => onTabChange('topics')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              activeTab === 'topics'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title="Topics"
          >
            <Tag className="w-5 h-5" />
          </button>
          <button
            onClick={() => onTabChange('api-keys')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              activeTab === 'api-keys'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title="API Keys"
          >
            <Key className="w-5 h-5" />
          </button>
          <button
            onClick={() => onTabChange('embeddings')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              activeTab === 'embeddings'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title="Embeddings"
          >
            <Bot className="w-5 h-5" />
          </button>
          {(() => {
            // Debug logging
            if (typeof window !== 'undefined') {
              console.log('[Sidebar Collapsed] Analytics tab check:', { 
                subscriptionTier, 
                shouldShow: subscriptionTier === 'premium' || subscriptionTier === 'pro'
              });
            }
            const shouldShow = subscriptionTier === 'premium' || subscriptionTier === 'pro';
            return shouldShow ? (
              <button
                onClick={() => onTabChange('analytics')}
                className={cn(
                  'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
                  activeTab === 'analytics'
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
                title="Analytics"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            ) : null;
          })()}
          <button
            onClick={() => onTabChange('subscription')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              activeTab === 'subscription'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title="Subscription"
          >
            <CreditCard className="w-5 h-5" />
          </button>
        </nav>
      </div>
    );
  }

  // Expanded sidebar
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-64 flex-shrink-0">
      {/* Collapse Button */}
      <div className="p-2 border-b border-gray-200">
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-full flex items-center justify-center p-2 hover:bg-gray-50 rounded transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 py-4 space-y-1">
          {/* Query Assistant Tab */}
          <div>
            <button
              onClick={() => onTabChange('chat')}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'chat'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                Query Assistant
              </div>
              {activeTab === 'chat' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSourceSelection(!showSourceSelection);
                  }}
                  className="p-1 hover:bg-orange-100 rounded transition-colors"
                >
                  {showSourceSelection ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}
            </button>
            
            {/* Collapsible Source Selection */}
            {activeTab === 'chat' && showSourceSelection && (
              <div className="mt-2 ml-11 mr-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-700">Source Selection:</span>
                </div>
                <RAGSourceSelector
                  settings={ragSettings}
                  onChange={onRagSettingsChange}
                  documentCount={documentCount}
                  hasProcessedDocuments={hasProcessedDocuments}
                  className="flex-col gap-2"
                />
              </div>
            )}

            {/* Collapsible Conversations Section */}
            {activeTab === 'chat' && (
              <div className="mt-2">
                <button
                  onClick={() => setShowConversations(!showConversations)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Conversations</span>
                    {conversations.length > 0 && (
                      <span className="text-xs text-gray-500">({conversations.length})</span>
                    )}
                  </div>
                  {showConversations ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showConversations && (
                  <div className="mt-2 space-y-1">
                    {/* Search */}
                    <div className="px-3 mb-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-7 pr-7 h-8 text-xs"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* New Conversation Button */}
                    <div className="px-3 mb-2">
                      <Button
                        onClick={handleNewConversation}
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        New Chat
                      </Button>
                    </div>

                    {/* Conversation List - Scrollable */}
                    <div className="max-h-[400px] overflow-y-auto px-1">
                      {isLoading ? (
                        <div className="px-3 py-2 text-xs text-gray-500 text-center">
                          Loading...
                        </div>
                      ) : filteredConversations.length === 0 ? (
                        <div className="px-3 py-2 text-center">
                          <p className="text-xs text-gray-500 mb-2">
                            {searchQuery ? 'No conversations found' : 'No conversations yet'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredConversations.map((conversation) => (
                            <ConversationItemComponent
                              key={conversation.id}
                              conversation={conversation}
                              isActive={conversation.id === currentConversationId}
                              onSelect={() => selectConversation(conversation.id)}
                              onDelete={(e) => handleDeleteConversation(conversation.id, e)}
                              onSaveToCollection={(conversationId) => {
                                setSelectedConversationForCollection(conversationId);
                                setShowSaveDialog(true);
                              }}
                              formatTime={formatTime}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Other Navigation Items */}
          <button
            onClick={() => onTabChange('documents')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'documents'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <FileText className="w-5 h-5" />
            Your Documents
          </button>
          <div>
            <button
              onClick={() => onTabChange('topics')}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'topics'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5" />
                Topics
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTopicsFilters(!showTopicsFilters);
                }}
                className="p-1 hover:bg-orange-100 rounded transition-colors"
                title={showTopicsFilters ? 'Collapse filters' : 'Expand topic & filters'}
              >
                {showTopicsFilters ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </button>

            {showTopicsFilters && (
              <div className="mt-2">
                <SidebarTopicFilters />
              </div>
            )}
          </div>
          <button
            onClick={() => onTabChange('api-keys')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'api-keys'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Key className="w-5 h-5" />
            API Keys
          </button>
          <button
            onClick={() => onTabChange('embeddings')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'embeddings'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Bot className="w-5 h-5" />
            Embeddings
          </button>
          <button
            onClick={() => onTabChange('collections')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'collections'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Folder className="w-5 h-5" />
            Collections
          </button>
          {(() => {
            // Debug logging
            if (typeof window !== 'undefined') {
              console.log('[Sidebar] Analytics tab check:', { 
                subscriptionTier, 
                shouldShow: subscriptionTier === 'premium' || subscriptionTier === 'pro',
                isPremium: subscriptionTier === 'premium',
                isPro: subscriptionTier === 'pro'
              });
            }
            const shouldShow = subscriptionTier === 'premium' || subscriptionTier === 'pro';
            return shouldShow ? (
              <button
                onClick={() => onTabChange('analytics')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'analytics'
                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <BarChart3 className="w-5 h-5" />
                Analytics
              </button>
            ) : null;
          })()}
        </nav>
      </div>

      {/* Save to Collection Dialog */}
      {selectedConversationForCollection && (
        <SaveToCollectionDialog
          conversationId={selectedConversationForCollection}
          isOpen={showSaveDialog}
          onClose={() => {
            setShowSaveDialog(false);
            setSelectedConversationForCollection(null);
          }}
          onSaved={() => {
            // Refresh conversations if needed
          }}
        />
      )}
    </div>
  );
};
