'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Folder, ChevronLeft, ChevronRight, Plus, Search, X, FolderOpen, ChevronDown, ChevronUp, ShieldCheck, PanelLeftClose, PanelLeft, SquarePen, Pin, Sparkles, BookOpen } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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
import { CitedSourcesPanel } from '@/components/research/cited-sources-panel';
import { SourceExplorerModal } from '@/components/research/source-explorer-modal';
// Topic filters retired in Phase 2 (v2 migration)
// import { SidebarTopicFilters } from './sidebar-topic-filters';
import type { CitedSource } from '@/lib/api';

type TabType = 'chat' | 'collections' | 'sources';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedConversationForCollection, setSelectedConversationForCollection] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(new Set());
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [isCollectionSearchOpen, setIsCollectionSearchOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [explorerSource, setExplorerSource] = useState<CitedSource | null>(null);
  const accountButtonRef = React.useRef<HTMLButtonElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  // Retired in Phase 2 (v2 migration)
  // const isWorkspacePage = pathname === '/workspace';

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

  const savePinnedConversations = (pinned: Set<string>) => {
    setPinnedConversations(pinned);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pinnedConversations', JSON.stringify(Array.from(pinned)));
    }
  };

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
      case 'enterprise': return 'Enterprise';
      case 'pro': return 'Pro';
      case 'premium': return 'Premium';
      case 'starter': return 'Starter';
      default: return 'Free';
    }
  };

  // Tier hierarchy: free < starter < premium < pro < enterprise
  const TIER_RANK: Record<string, number> = { free: 0, starter: 1, premium: 2, pro: 3, enterprise: 4 };
  const currentRank = TIER_RANK[subscriptionTier] ?? 0;
  const hasHigherTier = currentRank < 4; // anything below enterprise can upgrade

  const getUpgradeText = () => {
    switch (subscriptionTier) {
      case 'free': return 'Unlock premium features';
      case 'starter': return 'Upgrade to Premium, Pro, or Enterprise';
      case 'premium': return 'Upgrade to Pro or Enterprise';
      case 'pro': return 'Upgrade to Enterprise';
      default: return '';
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleUpgrade = () => {
    router.push('/dashboard/settings/subscription');
  };

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (activeTab === 'chat') {
          setIsSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        } else if (activeTab === 'collections') {
          setIsCollectionSearchOpen(true);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        if (activeTab === 'chat') {
          handleNewConversation();
        }
      }
      if (e.key === 'Escape') {
        if (document.activeElement?.tagName === 'INPUT') {
          setSearchQuery('');
          setCollectionSearchQuery('');
          setIsSearchOpen(false);
          setIsCollectionSearchOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

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
    setExpandedCollectionId(expandedCollectionId === collectionId ? null : collectionId);
  };

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter((conv) =>
      conv.title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      conv.lastMessage?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
    const pinned = filtered.filter((conv) => pinnedConversations.has(conv.id));
    const unpinned = filtered.filter((conv) => !pinnedConversations.has(conv.id));
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

  // ─── Collapsed sidebar ────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full bg-white border-r border-gray-100 w-14 flex-shrink-0">
        {/* Collapsed Header */}
        <div className="p-2 flex flex-col items-center gap-1 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-xs font-bold">
            Q
          </div>
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Collapsed Nav */}
        <nav className="flex-1 flex flex-col items-center py-3 gap-1">
          <button
            onClick={() => { onTabChange('chat'); setIsCollapsed(false); }}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
              activeTab === 'chat' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
            title="Query Assistant"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => { onTabChange('collections'); setIsCollapsed(false); }}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
              activeTab === 'collections' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
            title="Library"
          >
            <Folder className="w-5 h-5" />
          </button>
          <button
            onClick={() => { onTabChange('sources'); setIsCollapsed(false); }}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
              activeTab === 'sources' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}
            title="My Sources"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          {user?.role === 'super_admin' && (
            <button
              onClick={() => router.push('/dashboard/settings/super-admin')}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              title="Super Admin"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}
        </nav>

        {/* Collapsed Bottom — Account */}
        <div className="border-t border-gray-100 p-2 flex flex-col items-center gap-1 relative">
          <button
            ref={accountButtonRef}
            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
            className="relative"
            title={user?.full_name || user?.email || 'Account'}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-xs font-semibold">
                {getUserInitials()}
              </div>
            )}
          </button>
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

  // ── Expanded sidebar ─────────────────────────────────────────────
  return (
    <div className={cn(
      'flex flex-col bg-white border-r border-gray-100 w-[260px] flex-shrink-0',
      isMobile ? 'h-full min-h-0' : 'h-full'
    )}>
      {/* ── Change 1: Branded header with action buttons ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-[11px] font-bold">
            Q
          </div>
          <span className="text-[15px] font-semibold text-gray-900 tracking-tight">QueryAI</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleNewConversation}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="New conversation (⌘N)"
          >
            <SquarePen className="w-4 h-4 text-gray-500" />
          </button>
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* ── Change 2: Flat vertical nav links ── */}
      <nav className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="space-y-0.5">
          <button
            onClick={() => onTabChange('chat')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
              activeTab === 'chat'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <MessageSquare className="w-[18px] h-[18px]" />
            Query Assistant
          </button>
          <button
            onClick={() => onTabChange('collections')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
              activeTab === 'collections'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Folder className="w-[18px] h-[18px]" />
            Library
          </button>
          <button
            onClick={() => onTabChange('sources')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
              activeTab === 'sources'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <BookOpen className="w-[18px] h-[18px]" />
            My Sources
          </button>
          {user?.role === 'super_admin' && (
            <button
              onClick={() => router.push('/dashboard/settings/super-admin')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <ShieldCheck className="w-[18px] h-[18px]" />
              Super Admin
            </button>
          )}
        </div>
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-100" />

      {/* ── Change 3 & 7: Content area — no nested collapsibles, search as icon toggle ── */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {activeTab === 'chat' && (
          <div className="py-2">
            {/* Topic filters retired in Phase 2 (v2 migration) */}

            {/* Section header with search toggle */}
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Conversations
              </span>
              <button
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (!isSearchOpen) {
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  } else {
                    setSearchQuery('');
                  }
                }}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  isSearchOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                )}
                title="Search conversations (⌘K)"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search input — toggled by icon */}
            {isSearchOpen && (
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }
                    }}
                    className="pl-8 pr-8 h-8 text-xs bg-gray-50 border-gray-200 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Conversation list — shown directly, no collapsible wrapper */}
            <div className="px-2">
              {isLoading ? (
                <ConversationSkeleton count={5} />
              ) : filteredConversations.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-400">
                    {debouncedSearchQuery ? `No results for "${debouncedSearchQuery}"` : 'No conversations yet'}
                  </p>
                  {debouncedSearchQuery ? (
                    <button
                      onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                      className="mt-1.5 text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear search
                    </button>
                  ) : (
                    <button
                      onClick={handleNewConversation}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Start a new conversation
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
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

        {activeTab === 'collections' && (
          <div className="py-2">
            {/* Section header with search toggle */}
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Collections
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => {
                    setIsCollectionSearchOpen(!isCollectionSearchOpen);
                    if (isCollectionSearchOpen) setCollectionSearchQuery('');
                  }}
                  className={cn(
                    'p-1 rounded-md transition-colors',
                    isCollectionSearchOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  )}
                  title="Search collections (⌘K)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => router.push('/dashboard?tab=collections')}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                  title="New Collection"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Collection search — toggled */}
            {isCollectionSearchOpen && (
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={collectionSearchQuery}
                    onChange={(e) => setCollectionSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setCollectionSearchQuery('');
                        setIsCollectionSearchOpen(false);
                      }
                    }}
                    className="pl-8 pr-8 h-8 text-xs bg-gray-50 border-gray-200 focus:bg-white"
                    autoFocus
                  />
                  {collectionSearchQuery && (
                    <button
                      onClick={() => setCollectionSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Collections list — shown directly */}
            <div className="px-2">
              {isLoadingCollections ? (
                <CollectionSkeleton count={5} />
              ) : filteredCollections.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-400">
                    {debouncedCollectionSearchQuery ? `No results for "${debouncedCollectionSearchQuery}"` : 'No collections yet'}
                  </p>
                  {!debouncedCollectionSearchQuery && (
                    <button
                      onClick={() => router.push('/dashboard?tab=collections')}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Create your first collection
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredCollections.map((collection) => (
                    <div key={collection.id}>
                      <button
                        onClick={() => handleCollectionClick(collection.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors text-left',
                          expandedCollectionId === collection.id
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <FolderOpen className={cn(
                          'w-4 h-4 flex-shrink-0',
                          expandedCollectionId === collection.id ? 'text-gray-700' : 'text-gray-400'
                        )} />
                        <span className="truncate flex-1">{collection.name || 'Unnamed'}</span>
                        {collection.conversation_count !== undefined && collection.conversation_count > 0 && (
                          <span className="text-[11px] text-gray-400">{collection.conversation_count}</span>
                        )}
                        {expandedCollectionId === collection.id ? (
                          <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        )}
                      </button>
                      {expandedCollectionId === collection.id && (
                        <div className="ml-5 mt-0.5 border-l border-gray-100 pl-2">
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

        {activeTab === 'sources' && (
          <div className="py-2 h-full">
            <CitedSourcesPanel
              onSourceExplore={setExplorerSource}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* ── Bottom section: Upgrade, Account ── */}
      <div
        className="border-t border-gray-100 flex-shrink-0 relative"
        style={isMobile ? { paddingBottom: 'max(0px, env(safe-area-inset-bottom))' } : undefined}
      >
        {/* Upgrade CTA — show when any higher tier exists */}
        {hasHigherTier && (
          <button
            onClick={handleUpgrade}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors border-b border-gray-100 group"
          >
            <Sparkles className="w-4 h-4 text-orange-500 group-hover:text-orange-600" />
            <span className="flex-1 text-left">Upgrade</span>
            <span className="text-[11px] text-gray-400">{getUpgradeText()}</span>
          </button>
        )}

        {/* Account row — opens dropdown for private mode & profile */}
        <button
          ref={accountButtonRef}
          onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors',
            isAccountDropdownOpen ? 'bg-gray-50' : 'hover:bg-gray-50'
          )}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
              {getUserInitials()}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-medium text-gray-900 truncate">
              {user?.full_name || user?.email || 'User'}
            </p>
            <p className="text-[11px] text-gray-400 truncate">
              {getTierName(subscriptionTier)} Plan
            </p>
          </div>
          <ChevronDown className={cn(
            'w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform',
            isAccountDropdownOpen && 'rotate-180'
          )} />
        </button>

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
          onSaved={() => {}}
        />
      )}

      {/* Source Explorer Modal */}
      {explorerSource && (
        <SourceExplorerModal
          source={explorerSource}
          isOpen={!!explorerSource}
          onClose={() => setExplorerSource(null)}
          onNavigateToConversation={() => {
            onTabChange('chat');
            if (pathname !== '/dashboard') {
              router.push('/dashboard');
            }
          }}
        />
      )}
    </div>
  );
};
