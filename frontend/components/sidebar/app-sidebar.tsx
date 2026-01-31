'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Folder, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Search, X, FolderOpen, Settings, TestTube, CheckSquare, LogOut, User, ArrowUp, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
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
import { isEnterpriseTier } from '@/lib/pricing';

type TabType = 'chat' | 'collections';

interface AppSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  ragSettings: RAGSettings;
  onRagSettingsChange: (settings: RAGSettings) => void;
  documentCount: number;
  hasProcessedDocuments: boolean;
  subscriptionTier?: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
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
  const { toast } = useToast();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'Enterprise';
      case 'pro':
        return 'Pro';
      case 'premium':
        return 'Premium';
      case 'starter':
        return 'Starter';
      default:
        return 'Free';
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleUpgrade = () => {
    router.push('/dashboard/settings/subscription');
  };
  
  // Check if user is admin/internal
  const isAdmin =
    subscriptionTier === 'pro' ||
    user?.email?.includes('@admin') ||
    user?.email?.includes('@internal');
  
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
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
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
          {isAdmin && (
            <>
              <button
                onClick={() => router.push('/dashboard/ab-testing')}
                className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
                title="A/B Testing"
              >
                <TestTube className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/dashboard/validation')}
                className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
                title="Validation Reports"
              >
                <CheckSquare className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            onClick={() => router.push('/dashboard/settings/profile')}
            className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </nav>
        
        {/* Bottom Section - Collapsed */}
        <div className="border-t border-gray-200 p-2 space-y-1">
          {subscriptionTier !== 'enterprise' && (
            <button
              onClick={handleUpgrade}
              className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-orange-600 hover:bg-orange-50"
              title={`Upgrade from ${getTierName(subscriptionTier)}`}
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
            title={`Logout (${user?.full_name || user?.email || 'User'})`}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
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
          {isAdmin && (
            <>
              <button
                onClick={() => router.push('/dashboard/ab-testing')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <TestTube className="w-5 h-5" />
                A/B Testing
              </button>
              <button
                onClick={() => router.push('/dashboard/validation')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <CheckSquare className="w-5 h-5" />
                Validation Reports
              </button>
            </>
          )}
          <button
            onClick={() => router.push('/dashboard/settings/profile')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
        </nav>

      </div>

      {/* Bottom Section - User Info, Plan, Upgrade, Logout */}
      <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-2 flex-shrink-0">
        {/* User Info */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.full_name || user?.email || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {getTierName(subscriptionTier)} Plan
            </p>
          </div>
        </div>

        {/* Upgrade Button (if not Enterprise) */}
        {subscriptionTier !== 'enterprise' && (
          <Button
            onClick={handleUpgrade}
            variant="outline"
            size="sm"
            className="w-full text-xs h-8 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <ArrowUp className="w-3 h-3 mr-1.5" />
            Upgrade Plan
          </Button>
        )}

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-gray-700 hover:bg-gray-100"
        >
          <LogOut className="w-3 h-3 mr-1.5" />
          Logout
        </Button>
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
