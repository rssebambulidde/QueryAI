'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MessageSquare, Folder, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Search, X, FolderOpen, Settings, LogOut, User, ArrowUp, CreditCard, Star, Pin, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';
import { useConversationStore } from '@/lib/store/conversation-store';
import { ConversationItem as ConversationItemComponent } from '@/components/chat/conversation-item';
import { SaveToCollectionDialog } from '@/components/collections/save-to-collection-dialog';
import { collectionApi, Collection } from '@/lib/api';
import { CollectionConversationsList } from './collection-conversations-list';
import { useToast } from '@/lib/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isEnterpriseTier } from '@/lib/pricing';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useMobile } from '@/lib/hooks/use-mobile';
import { ConversationSkeleton, CollectionSkeleton } from './skeleton-loader';
import { AccountDropdown } from './account-dropdown';
import { ConversationHoverPreview } from './conversation-hover-preview';
import { CollectionHoverPreview } from './collection-hover-preview';

type TabType = 'chat' | 'collections';

interface AppSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  subscriptionTier?: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onTabChange,
  subscriptionTier = 'free',
}) => {
  const { isMobile } = useMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedConversationForCollection, setSelectedConversationForCollection] = useState<string | null>(null);
  const [showCollections, setShowCollections] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(new Set());
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [showConversationPreview, setShowConversationPreview] = useState(false);
  const [showCollectionPreview, setShowCollectionPreview] = useState(false);
  const accountButtonRef = React.useRef<HTMLButtonElement>(null);
  const conversationButtonRef = React.useRef<HTMLButtonElement>(null);
  const collectionButtonRef = React.useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  
  // Debug: Log user role for super admin visibility
  React.useEffect(() => {
    if (user && typeof window !== 'undefined') {
      console.log('[Sidebar] User role:', user.role || 'not set');
      console.log('[Sidebar] Is super admin:', user.role === 'super_admin');
    }
  }, [user]);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const debouncedCollectionSearchQuery = useDebounce(collectionSearchQuery, 300);

  // Load pinned conversations from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pinnedConversations');
      if (saved) {
        try {
          setPinnedConversations(new Set(JSON.parse(saved)));
        } catch (e) {
          console.error('Failed to load pinned conversations:', e);
        }
      }
    }
  }, []);

  // Save pinned conversations to localStorage
  const savePinnedConversations = (pinned: Set<string>) => {
    setPinnedConversations(pinned);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pinnedConversations', JSON.stringify(Array.from(pinned)));
    }
  };

  // Toggle pin conversation
  const handleTogglePin = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = new Set(pinnedConversations);
    if (newPinned.has(conversationId)) {
      newPinned.delete(conversationId);
      toast.success('Conversation unpinned');
    } else {
      newPinned.add(conversationId);
      toast.success('Conversation pinned');
    }
    savePinnedConversations(newPinned);
  };

  // Get user initials for avatar
  const getUserInitials = (): string => {
    if (user?.full_name) {
      const names = user.full_name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.full_name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

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
  
  // Check if user is admin or super_admin using role
  
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (activeTab === 'chat' && showConversations) {
          const searchInput = document.querySelector('input[placeholder*="Search conversations"]') as HTMLInputElement;
          searchInput?.focus();
        } else if (activeTab === 'collections' && showCollections) {
          const searchInput = document.querySelector('input[placeholder*="Search collections"]') as HTMLInputElement;
          searchInput?.focus();
        }
      }
      // Cmd/Ctrl + N for new conversation
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        if (activeTab === 'chat') {
          handleNewConversation();
        }
      }
      // Escape to clear search
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName === 'INPUT') {
          setSearchQuery('');
          setCollectionSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showConversations, showCollections]);

  // Load collections when collections tab is active
  useEffect(() => {
    if (activeTab === 'collections') {
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

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter((conv) =>
      conv.title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      conv.lastMessage?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );

    // Separate pinned and unpinned
    const pinned = filtered.filter((conv) => pinnedConversations.has(conv.id));
    const unpinned = filtered.filter((conv) => !pinnedConversations.has(conv.id));

    // Sort by updated_at (newest first)
    pinned.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    unpinned.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return [...pinned, ...unpinned];
  }, [conversations, debouncedSearchQuery, pinnedConversations]);

  // Filter collections
  const filteredCollections = useMemo(() => {
    if (!debouncedCollectionSearchQuery) return collections;
    return collections.filter((col) =>
      col.name?.toLowerCase().includes(debouncedCollectionSearchQuery.toLowerCase()) ||
      col.description?.toLowerCase().includes(debouncedCollectionSearchQuery.toLowerCase())
    );
  }, [collections, debouncedCollectionSearchQuery]);

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
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors relative',
              activeTab === 'chat'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title={`Query Assistant${conversations.length > 0 ? ` (${conversations.length})` : ''}`}
          >
            <MessageSquare className="w-5 h-5" />
            {conversations.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {conversations.length > 9 ? '9+' : conversations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('collections')}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors relative',
              activeTab === 'collections'
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
            title={`Collections${collections.length > 0 ? ` (${collections.length})` : ''}`}
          >
            <Folder className="w-5 h-5" />
            {collections.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {collections.length > 9 ? '9+' : collections.length}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          {user?.role === 'super_admin' && (
            <button
              onClick={() => router.push('/dashboard/settings/super-admin')}
              className="w-full flex items-center justify-center p-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
              title="Super Admin"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}
        </nav>
        
        {/* Bottom Section - Collapsed - Account Button */}
        <div className="border-t border-gray-200 p-2 relative">
          <button
            ref={accountButtonRef}
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
              isAccountDropdownOpen
                ? 'bg-gray-100'
                : 'hover:bg-gray-50'
            )}
            title={`Account (${user?.full_name || user?.email || 'User'})`}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user?.full_name || user?.email || 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">
                {getUserInitials()}
              </div>
            )}
          </button>

          {/* Account Dropdown for Collapsed Sidebar */}
          <AccountDropdown
            isOpen={isAccountDropdownOpen}
            onClose={() => setIsAccountDropdownOpen(false)}
            subscriptionTier={subscriptionTier}
            anchorRef={accountButtonRef}
          />
        </div>
      </div>
    );
  }

  // Expanded sidebar (min-h-0 so when inside mobile overlay the account section stays visible)
  return (
    <div className={cn(
      'flex flex-col bg-white border-r border-gray-200 w-64 flex-shrink-0',
      isMobile ? 'h-full min-h-0' : 'h-full'
    )}>
      {/* Collapse Button — hidden on mobile (overlay has its own close) */}
      {!isMobile && (
        <div className="p-2 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-full flex items-center justify-center p-2 hover:bg-gray-50 rounded transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <nav className="px-2 py-4 space-y-1">
          {/* Query Assistant Tab */}
          <div>
            <button
              onClick={() => onTabChange('chat')}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                activeTab === 'chat'
                  ? 'bg-orange-50 text-orange-700 border-l-4 border-l-orange-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
              title="Query Assistant (⌘K to search)"
            >
              <MessageSquare className="w-5 h-5" />
              Query Assistant
            </button>

            {/* Collapsible Conversations Section */}
            {activeTab === 'chat' && (
              <div className="mt-2 relative">
                <button
                  ref={conversationButtonRef}
                  onClick={() => setShowConversations(!showConversations)}
                  onMouseEnter={() => setShowConversationPreview(true)}
                  onMouseLeave={() => setShowConversationPreview(false)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <MessageSquare className="w-4 h-4" />
                    <span>Conversations</span>
                    {debouncedSearchQuery ? (
                      <span className="text-xs text-gray-500">
                        ({filteredConversations.length} of {conversations.length})
                      </span>
                    ) : conversations.length > 0 ? (
                      <span className="text-xs text-gray-500">({conversations.length})</span>
                    ) : null}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNewConversation();
                      }}
                      className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
                      title="New Conversation"
                    >
                      <Plus className="w-3.5 h-3.5 text-gray-500" />
                    </button>
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
                          placeholder="Search conversations..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setSearchQuery('');
                            }
                          }}
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


                    {/* Conversation List - Scrollable */}
                    <div className="max-h-[400px] overflow-y-auto px-1" style={{ scrollbarWidth: 'thin' }}>
                      {isLoading ? (
                        <ConversationSkeleton count={5} />
                      ) : filteredConversations.length === 0 ? (
                        <div className="px-3 py-2 text-center">
                          <p className="text-xs text-gray-500 mb-2">
                            {debouncedSearchQuery ? `No conversations found for "${debouncedSearchQuery}"` : 'No conversations yet'}
                          </p>
                          {debouncedSearchQuery && (
                            <Button
                              onClick={() => setSearchQuery('')}
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                            >
                              Clear search
                            </Button>
                          )}
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
                              onPin={(conversationId) => {
                                handleTogglePin(conversationId, { stopPropagation: () => {} } as React.MouseEvent);
                              }}
                              isPinned={pinnedConversations.has(conversation.id)}
                              formatTime={formatTime}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Conversation Hover Preview */}
                {showConversationPreview && conversations.length > 0 && (
                  <div
                    onMouseEnter={() => setShowConversationPreview(true)}
                    onMouseLeave={() => setShowConversationPreview(false)}
                  >
                    <ConversationHoverPreview
                      conversations={conversations}
                      currentConversationId={currentConversationId}
                      onSelect={(id) => {
                        selectConversation(id);
                        setShowConversationPreview(false);
                      }}
                      pinnedConversations={pinnedConversations}
                      formatTime={formatTime}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-gray-200" />

          {/* Collections Tab */}
          <div className="relative">
            <button
              ref={collectionButtonRef}
              onClick={() => onTabChange('collections')}
              onMouseEnter={() => setShowCollectionPreview(true)}
              onMouseLeave={() => setShowCollectionPreview(false)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                activeTab === 'collections'
                  ? 'bg-orange-50 text-orange-700 border-l-4 border-l-orange-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Folder className="w-5 h-5" />
              Collections
              {collections.length > 0 && (
                <span className="ml-auto text-xs text-gray-500">({collections.length})</span>
              )}
            </button>
            {/* Collection Hover Preview */}
            {showCollectionPreview && collections.length > 0 && (
              <div
                onMouseEnter={() => setShowCollectionPreview(true)}
                onMouseLeave={() => setShowCollectionPreview(false)}
              >
                <CollectionHoverPreview
                  collections={collections}
                  onSelect={(id) => {
                    handleCollectionClick(id);
                    onTabChange('collections');
                    setShowCollectionPreview(false);
                  }}
                  onCreateNew={() => {
                    router.push('/dashboard?tab=collections');
                    setShowCollectionPreview(false);
                  }}
                />
              </div>
            )}

            {/* Collapsible Collections Section */}
            {activeTab === 'collections' && (
              <div className="mt-2">
                <button
                  onClick={() => setShowCollections(!showCollections)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    <span>My Collections</span>
                    {debouncedCollectionSearchQuery ? (
                      <span className="text-xs text-gray-500">
                        ({filteredCollections.length} of {collections.length})
                      </span>
                    ) : collections.length > 0 ? (
                      <span className="text-xs text-gray-500">({collections.length})</span>
                    ) : null}
                  </div>
                  {showCollections ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showCollections && (
                  <div className="mt-2 space-y-1">
                    {/* Collection Search */}
                    <div className="px-3 mb-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search collections..."
                          value={collectionSearchQuery}
                          onChange={(e) => setCollectionSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setCollectionSearchQuery('');
                            }
                          }}
                          className="pl-7 pr-7 h-8 text-xs"
                        />
                        {collectionSearchQuery && (
                          <button
                            onClick={() => setCollectionSearchQuery('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* New Collection Button */}
                    <div className="px-3 mb-2">
                      <Button
                        onClick={() => router.push('/dashboard?tab=collections')}
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        New Collection
                      </Button>
                    </div>

                    {/* Collections List */}
                    <div className="max-h-[400px] overflow-y-auto px-1">
                      {isLoadingCollections ? (
                        <CollectionSkeleton count={5} />
                      ) : filteredCollections.length === 0 ? (
                        <div className="px-3 py-2 text-center">
                          <p className="text-xs text-gray-500 mb-2">
                            {debouncedCollectionSearchQuery ? `No collections found for "${debouncedCollectionSearchQuery}"` : 'No collections yet'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredCollections.map((collection) => (
                            <div key={collection.id}>
                              <button
                                onClick={() => handleCollectionClick(collection.id)}
                                className={cn(
                                  'w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left',
                                  expandedCollectionId === collection.id && 'bg-gray-50'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <FolderOpen className={cn(
                                    'w-4 h-4 flex-shrink-0',
                                    expandedCollectionId === collection.id ? 'text-orange-600' : 'text-gray-500'
                                  )} />
                                  <span className="truncate">{collection.name || 'Unnamed Collection'}</span>
                                  {collection.conversation_count !== undefined && collection.conversation_count > 0 && (
                                    <span className="text-xs text-gray-500 ml-auto">
                                      ({collection.conversation_count})
                                    </span>
                                  )}
                                </div>
                                {expandedCollectionId === collection.id ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )}
                              </button>
                              {expandedCollectionId === collection.id && (
                                <div className="ml-4 mt-1">
                                  <CollectionConversationsList
                                    collectionId={collection.id}
                                    onConversationSelect={(conversationId) => {
                                      selectConversation(conversationId);
                                      onTabChange('chat');
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Super Admin Section */}
          {user?.role === 'super_admin' && (
            <>
              <div className="my-2 border-t border-gray-200" />
              <div className="px-3 py-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Super Admin</span>
              </div>
              <button
                onClick={() => router.push('/dashboard/settings/super-admin')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <ShieldCheck className="w-5 h-5" />
                Super Admin
              </button>
            </>
          )}
        </nav>

      </div>

      {/* Settings - just above Account (easy to find) */}
      <div className="border-t border-gray-200 px-2 pt-2 pb-1 flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard/settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>

      {/* Bottom Section - Account Button (always visible; safe area on mobile) */}
      <div
        className="border-t border-gray-200 p-2 flex-shrink-0 relative"
        style={isMobile ? { paddingBottom: 'max(8px, env(safe-area-inset-bottom))' } : undefined}
      >
        <button
          ref={accountButtonRef}
          onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
            isAccountDropdownOpen
              ? 'bg-gray-100'
              : 'hover:bg-gray-50'
          )}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user?.full_name || user?.email || 'User'}
              className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
              {getUserInitials()}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.full_name || user?.email || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {getTierName(subscriptionTier)} Plan
            </p>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-gray-500 flex-shrink-0 transition-transform',
            isAccountDropdownOpen && 'rotate-180'
          )} />
        </button>

        {/* Account Dropdown */}
        <AccountDropdown
          isOpen={isAccountDropdownOpen}
          onClose={() => setIsAccountDropdownOpen(false)}
          subscriptionTier={subscriptionTier}
          anchorRef={accountButtonRef}
        />
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
