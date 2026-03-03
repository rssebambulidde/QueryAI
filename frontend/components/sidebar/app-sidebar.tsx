'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageSquare, Folder, ChevronLeft, ChevronRight, Plus, Search, X, FolderOpen, ChevronDown, ChevronUp, ShieldCheck, PanelLeftClose, PanelLeft, SquarePen, Pin, Sparkles, Check, Loader2 } from 'lucide-react';
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
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useMobile } from '@/lib/hooks/use-mobile';
import { ConversationSkeleton, CollectionSkeleton } from './skeleton-loader';
import { AccountDropdown } from './account-dropdown';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SwipeableItem } from '@/components/ui/swipeable-item';
import { useHaptics } from '@/lib/hooks/use-haptics';
// Topic filters retired in Phase 2 (v2 migration)
// import { SidebarTopicFilters } from './sidebar-topic-filters';

type TabType = 'chat' | 'collections';

function getDateGroup(dateString?: string): string {
  if (!dateString) return 'Older';
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'Previous 7 Days';
  if (date >= monthStart) return 'This Month';
  return 'Older';
}

interface AppSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onTabChange,
  subscriptionTier = 'free',
}) => {
  const { isMobile } = useMobile();
  const { vibrate } = useHaptics();
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
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [showInlineCollectionForm, setShowInlineCollectionForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const sidebarWidthRef = useRef(280);
  const newCollectionInputRef = useRef<HTMLInputElement>(null);
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

  // Load saved sidebar width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarWidth');
      if (saved) {
        const w = Math.max(240, Math.min(400, parseInt(saved)));
        setSidebarWidth(w);
        sidebarWidthRef.current = w;
      }
    }
  }, []);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(240, Math.min(400, startWidth + delta));
      sidebarWidthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('sidebarWidth', String(sidebarWidthRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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
      default: return 'Free';
    }
  };

  // Tier hierarchy: free < pro < enterprise
  const TIER_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };
  const currentRank = TIER_RANK[subscriptionTier] ?? 0;
  const hasHigherTier = currentRank < 2; // anything below enterprise can upgrade

  const getUpgradeText = () => {
    switch (subscriptionTier) {
      case 'free': return 'Upgrade to Pro or Enterprise';
      case 'pro': return 'Upgrade to Enterprise';
      default: return '';
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
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

  const handleInlineCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    try {
      setIsCreatingCollection(true);
      const response = await collectionApi.create({ name });
      if (response.success && response.data) {
        toast.success('Collection created');
        setNewCollectionName('');
        setShowInlineCollectionForm(false);
        await loadCollections();
      } else {
        toast.error('Failed to create collection');
      }
    } catch (error: any) {
      const code = error.response?.data?.error?.code;
      const msg = error.response?.data?.error?.message || error.message || 'Failed to create collection';
      if (code === 'COLLECTION_LIMIT_EXCEEDED') {
        toast.warning(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleCollectionClick = async (collectionId: string) => {
    setExpandedCollectionId(expandedCollectionId === collectionId ? null : collectionId);
  };

  // Filter, sort, and group conversations
  const { pinnedConvs, dateGroups, totalCount } = useMemo(() => {
    let filtered = conversations.filter((conv) =>
      conv.title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      conv.lastMessage?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
    const pinned = filtered.filter((conv) => pinnedConversations.has(conv.id));
    const unpinned = filtered.filter((conv) => !pinnedConversations.has(conv.id));
    pinned.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    unpinned.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'This Month', 'Older'];
    const grouped = new Map<string, typeof unpinned>();
    for (const conv of unpinned) {
      const group = getDateGroup(conv.lastMessageAt || conv.updated_at);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(conv);
    }
    const groups: { label: string; conversations: typeof unpinned }[] = [];
    for (const label of ORDER) {
      const convs = grouped.get(label);
      if (convs && convs.length > 0) groups.push({ label, conversations: convs });
    }

    return { pinnedConvs: pinned, dateGroups: groups, totalCount: filtered.length };
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
    // Clear selection to show the ModeSelector — DB conversation is created on first message
    selectConversation(null);
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
      <div className="flex flex-col h-full bg-white  border-r border-gray-100  w-14 flex-shrink-0">
        {/* Collapsed Header */}
        <div className="p-2 flex flex-col items-center gap-1 border-b border-gray-100 ">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white  text-xs font-bold">
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
            title="Collections"
          >
            <Folder className="w-5 h-5" />
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
          {/* Notification Bell (collapsed) */}
          <NotificationBell />
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
    <div
      className={cn(
        'flex flex-col bg-white  border-r border-gray-100  flex-shrink-0 relative',
        isMobile ? 'h-full min-h-0' : 'h-full'
      )}
      style={{ width: isMobile ? '100%' : `${sidebarWidth}px` }}
    >
      {/* ── Change 1: Branded header with action buttons ── */}
      {!isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100  flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white  text-xs font-bold">
              Q
            </div>
            <span className="text-base font-semibold text-gray-900  tracking-tight">QueryAI</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNewConversation}
              className="p-1.5 hover:bg-gray-100  rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="New conversation (⌘N)"
            >
              <SquarePen className="w-4 h-4 text-gray-500 " />
            </button>
            <NotificationBell />
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* ── Change 2: Flat vertical nav links ── */}
      {(!isMobile || user?.role === 'super_admin') && (
        <>
          <nav className="px-3 pt-3 pb-1 flex-shrink-0">
            <div className="space-y-0.5">
              {!isMobile && (
                <>
                  <button
                    onClick={() => onTabChange('chat')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                      activeTab === 'chat'
                        ? 'bg-gray-100  text-gray-900 '
                        : 'text-gray-600  hover:bg-gray-50  hover:text-gray-900 '
                    )}
                  >
                    <MessageSquare className="w-[18px] h-[18px]" />
                    Query Assistant
                  </button>
                  <button
                    onClick={() => onTabChange('collections')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                      activeTab === 'collections'
                        ? 'bg-gray-100  text-gray-900 '
                        : 'text-gray-600  hover:bg-gray-50  hover:text-gray-900 '
                    )}
                  >
                    <Folder className="w-[18px] h-[18px]" />
                    Collections
                  </button>
                </>
              )}
              {user?.role === 'super_admin' && (
                <button
                  onClick={() => router.push('/dashboard/settings/super-admin')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[44px]"
                >
                  <ShieldCheck className="w-[18px] h-[18px]" />
                  Super Admin
                </button>
              )}
            </div>
          </nav>

          {/* Divider */}
          <div className="mx-4 border-t border-gray-100 " />
        </>
      )}

      {/* ── Change 3 & 7: Content area — no nested collapsibles, search as icon toggle ── */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {activeTab === 'chat' && (
          <div className="py-2">
            {/* Topic filters retired in Phase 2 (v2 migration) */}

            {/* Section header with search toggle */}
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {totalCount > 0 ? `Conversations (${totalCount})` : 'Conversations'}
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
                  'p-1 rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
                  isSearchOpen
                    ? 'bg-gray-100  text-gray-700 '
                    : 'text-gray-400 hover:text-gray-600  hover:bg-gray-50 '
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
                    className="pl-8 pr-8 h-8 text-xs bg-gray-50  border-gray-200  focus:bg-white  text-gray-900 "
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

            {/* Conversation list with pinned section + date groups */}
            <div className="px-2">
              {isLoading ? (
                <ConversationSkeleton count={5} />
              ) : totalCount === 0 ? (
                <div className="px-3 py-8 text-center">
                  <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    {debouncedSearchQuery ? `No results for "${debouncedSearchQuery}"` : 'No conversations yet'}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    {debouncedSearchQuery ? 'Try a different search term' : 'Ask a question to get started'}
                  </p>
                  {debouncedSearchQuery ? (
                    <button
                      onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear search
                    </button>
                  ) : (
                    <button
                      onClick={handleNewConversation}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New conversation
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {/* Pinned conversations */}
                  {pinnedConvs.length > 0 && (
                    <>
                      <div className="px-3 pt-1 pb-0.5">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pinned</span>
                      </div>
                      {pinnedConvs.map((conversation) => (
                        <SwipeableItem
                          key={conversation.id}
                          onDelete={() => { vibrate('heavy'); handleDeleteConversation(conversation.id, { stopPropagation: () => { } } as React.MouseEvent); }}
                          deleteLabel="Delete"
                        >
                          <ConversationItemComponent
                            conversation={conversation}
                            isActive={conversation.id === currentConversationId}
                            onSelect={() => selectConversation(conversation.id)}
                            onDelete={(e) => handleDeleteConversation(conversation.id, e)}
                            onSaveToCollection={(conversationId) => {
                              setSelectedConversationForCollection(conversationId);
                              setShowSaveDialog(true);
                            }}
                            onPin={(conversationId) => {
                              handleTogglePin(conversationId, { stopPropagation: () => { } } as React.MouseEvent);
                            }}
                            isPinned={true}
                            formatTime={formatTime}
                          />
                        </SwipeableItem>
                      ))}
                      {dateGroups.length > 0 && (
                        <div className="mx-3 my-1.5 border-t border-gray-100" />
                      )}
                    </>
                  )}
                  {/* Date-grouped conversations */}
                  {dateGroups.map((group) => (
                    <React.Fragment key={group.label}>
                      <div className="sticky top-0 bg-white z-10 px-3 pt-2 pb-0.5">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.label}</span>
                      </div>
                      {group.conversations.map((conversation) => (
                        <SwipeableItem
                          key={conversation.id}
                          onDelete={() => { vibrate('heavy'); handleDeleteConversation(conversation.id, { stopPropagation: () => { } } as React.MouseEvent); }}
                          deleteLabel="Delete"
                        >
                          <ConversationItemComponent
                            conversation={conversation}
                            isActive={conversation.id === currentConversationId}
                            onSelect={() => selectConversation(conversation.id)}
                            onDelete={(e) => handleDeleteConversation(conversation.id, e)}
                            onSaveToCollection={(conversationId) => {
                              setSelectedConversationForCollection(conversationId);
                              setShowSaveDialog(true);
                            }}
                            onPin={(conversationId) => {
                              handleTogglePin(conversationId, { stopPropagation: () => { } } as React.MouseEvent);
                            }}
                            isPinned={false}
                            formatTime={formatTime}
                          />
                        </SwipeableItem>
                      ))}
                    </React.Fragment>
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
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {collections.length > 0 ? `Collections (${collections.length})` : 'Collections'}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => {
                    setIsCollectionSearchOpen(!isCollectionSearchOpen);
                    if (isCollectionSearchOpen) setCollectionSearchQuery('');
                  }}
                  className={cn(
                    'p-1 rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
                    isCollectionSearchOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  )}
                  title="Search collections (⌘K)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setShowInlineCollectionForm(!showInlineCollectionForm);
                    if (!showInlineCollectionForm) {
                      setTimeout(() => newCollectionInputRef.current?.focus(), 50);
                    } else {
                      setNewCollectionName('');
                    }
                  }}
                  className={cn(
                    'p-1 rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center',
                    showInlineCollectionForm ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  )}
                  title="New Collection"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline collection creation form */}
            {showInlineCollectionForm && (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    ref={newCollectionInputRef}
                    type="text"
                    placeholder="Collection name..."
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInlineCreateCollection();
                      if (e.key === 'Escape') {
                        setNewCollectionName('');
                        setShowInlineCollectionForm(false);
                      }
                    }}
                    className="h-8 text-xs bg-gray-50 border-gray-200 focus:bg-white flex-1"
                    disabled={isCreatingCollection}
                  />
                  <button
                    onClick={handleInlineCreateCollection}
                    disabled={!newCollectionName.trim() || isCreatingCollection}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    {isCreatingCollection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { setNewCollectionName(''); setShowInlineCollectionForm(false); }}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

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
                <div className="px-3 py-8 text-center">
                  <Folder className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    {debouncedCollectionSearchQuery ? `No results for "${debouncedCollectionSearchQuery}"` : 'No collections yet'}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    {debouncedCollectionSearchQuery ? 'Try a different search term' : 'Organize your conversations into collections'}
                  </p>
                  {!debouncedCollectionSearchQuery && (
                    <button
                      onClick={() => {
                        setShowInlineCollectionForm(true);
                        setTimeout(() => newCollectionInputRef.current?.focus(), 50);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create collection
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
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
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
                          <span className="text-xs text-gray-400">{collection.conversation_count}</span>
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

      </div>

      {/* ── Bottom section: Notifications, Upgrade, Account ── */}
      <div
        className="border-t border-gray-100 flex-shrink-0 relative"
        style={isMobile ? { paddingBottom: 'max(0px, env(safe-area-inset-bottom))' } : undefined}
      >
        {/* Upgrade CTA — show when any higher tier exists (desktop only; mobile has it in BottomNavigation account modal) */}
        {!isMobile && hasHigherTier && (
          <button
            onClick={handleUpgrade}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50/80 transition-colors border-b border-gray-100 group bg-gradient-to-r from-orange-50/60 to-transparent"
            style={{ borderLeft: '2px solid #fb923c' }}
          >
            <Sparkles className="w-4 h-4 text-orange-500 group-hover:text-orange-600" />
            <span className="flex-1 text-left">Upgrade</span>
            <span className="text-xs text-gray-400 group-hover:text-orange-500 transition-colors">{getUpgradeText()}</span>
          </button>
        )}

        {/* Account row — opens dropdown for private mode & profile (desktop only; mobile has BottomNavigation account modal) */}
        {!isMobile && (
          <>
            <button
              ref={accountButtonRef}
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors min-h-[44px]',
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
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.full_name || user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
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
          </>
        )}
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
          onSaved={() => { }}
        />
      )}

      {/* Resize handle */}
      {!isMobile && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 -right-0.5 w-1.5 h-full cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors z-10"
        />
      )}
    </div>
  );
};
